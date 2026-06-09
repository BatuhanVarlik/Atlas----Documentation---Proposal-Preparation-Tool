/* eslint-disable no-console */
// HEM-PROJECT-NO.docx (kullanıcının hazırladığı tam teklif belgesi) içindeki sarı
// highlight'lı değişkenleri docxtemplater placeholder'larına çevirir; belgenin tüm
// tasarımını (header logoları, kapak mektubu, footer imzaları, tablolar) korur.
//
// Çalıştırma:
//   npx tsx scripts/build-quotation-template.ts
//
// Çıktı: public/uploads/templates/apv-teklif-genel.docx (+ lib/docx/templates kopyası)
// ve DocumentTemplate kaydı (moduleType: MILK_RECEPTION, aktif).
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { prisma } from '../lib/prisma';
import { extractPlaceholders, dotNotationParser } from '../lib/docx/renderTemplate';

const SOURCE = 'public/HEM-PROJECT-NO.docx';
const OUT_FILENAME_MILK = 'apv-teklif-genel.docx';
const OUT_FILENAME_STORAGE = 'apv-teklif-genel-depolama.docx';

// ---------- Düşük seviyeli yardımcılar ----------

/** `<w:t ...>OLD</w:t>` düğümünü tek seferde değiştirir; eşleşme sayısı beklenenden farklıysa hata verir. */
function replaceTextNode(xml: string, innerRegex: RegExp, newInner: string, label: string): string {
  const re = new RegExp(`<w:t[^>]*>${innerRegex.source}</w:t>`, 'g');
  const matches = xml.match(re);
  const count = matches ? matches.length : 0;
  if (count !== 1) {
    throw new Error(`[${label}] beklenen 1 eşleşme, bulunan ${count} (regex: ${re.source})`);
  }
  console.log(`  ✓ ${label}: "${matches![0]}" → {…}`);
  return xml.replace(re, `<w:t xml:space="preserve">${newInner}</w:t>`);
}

/** Bir aralık (substring) içindeki sarı highlight'lı run'ların metnini sırayla değiştirir. */
function replaceYellowRunsInRegion(region: string, tags: string[], label: string): string {
  let i = 0;
  const out = region.replace(/<w:r\b[\s\S]*?<\/w:r>/g, (run) => {
    if (!/<w:highlight w:val="yellow"\/>/.test(run)) return run;
    if (i >= tags.length) {
      throw new Error(`[${label}] beklenenden fazla sarı run (>${tags.length})`);
    }
    const tag = tags[i++];
    const replaced = run.replace(/<w:t[^>]*>[\s\S]*?<\/w:t>/, `<w:t xml:space="preserve">${tag}</w:t>`);
    return replaced;
  });
  if (i !== tags.length) {
    throw new Error(`[${label}] beklenen ${tags.length} sarı run, bulunan ${i}`);
  }
  console.log(`  ✓ ${label}: ${tags.length} sarı run dolduruldu → ${tags.join(', ')}`);
  return out;
}

function regionBetween(xml: string, startAnchor: string, endAnchor: string, label: string): [number, number] {
  const s = xml.indexOf(startAnchor);
  const e = xml.indexOf(endAnchor, s + startAnchor.length);
  if (s < 0 || e < 0) throw new Error(`[${label}] aralık bulunamadı (${startAnchor} … ${endAnchor})`);
  return [s, e];
}

// Belgenin tablo stiline (KlavuzTablo1Ak, Times New Roman) uyan ortak inşa yardımcıları.
function descCell(inner: string, w: number, bold = false, jc = 'left'): string {
  return (
    `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>` +
    `<w:p><w:pPr><w:spacing w:after="31" w:line="259" w:lineRule="auto"/><w:jc w:val="${jc}"/></w:pPr>` +
    `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>${bold ? '<w:b/>' : ''}</w:rPr>` +
    `<w:t xml:space="preserve">${inner}</w:t></w:r></w:p></w:tc>`
  );
}
// Mavi (lacivert) başlık hücresi — belgenin orijinal Hat tablosu başlığıyla aynı
// (dolgu 1B2A52 + beyaz kalın metin). Reception'daki tablo başlık rengine uyar.
const HEADER_FILL = '1B2A52';
function descHeaderCell(inner: string, w: number, jc = 'left'): string {
  return (
    `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="${HEADER_FILL}"/><w:vAlign w:val="center"/></w:tcPr>` +
    `<w:p><w:pPr><w:spacing w:after="31" w:line="259" w:lineRule="auto"/><w:jc w:val="${jc}"/></w:pPr>` +
    `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:color w:val="FFFFFF"/></w:rPr>` +
    `<w:t xml:space="preserve">${inner}</w:t></w:r></w:p></w:tc>`
  );
}
function descTable(grid: number[], rowsXml: string): string {
  return (
    `<w:tbl><w:tblPr><w:tblStyle w:val="KlavuzTablo1Ak"/><w:tblW w:w="0" w:type="auto"/>` +
    `<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>` +
    `<w:tblGrid>${grid.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rowsXml}</w:tbl>`
  );
}
function descHeading(text: string): string {
  return (
    `<w:p><w:pPr><w:spacing w:before="160" w:after="60"/></w:pPr>` +
    `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>` +
    `<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`
  );
}
function spacerP(): string {
  return '<w:p><w:pPr><w:spacing w:after="60"/></w:pPr></w:p>';
}

/**
 * Teslimat/Geçerlilik bloğu — etiket [tab] değer şeklinde hizalı paragraflar.
 * Orijinalde etiketler 1 sütunlu tabloda iç içe, değerler altta serbest paragraflarda
 * ("sarkık") duruyordu. TABLO KULLANMIYORUZ: belge sonunda tablo, Word'ün eklediği
 * zorunlu boş paragraf + sayfa taşması yüzünden fazladan boş sayfa oluşturuyordu.
 */
function buildDeliveryBlock(): string {
  const tabStop = 3800; // twips — değerlerin hizalanacağı konum
  const line = (label: string, value: string) =>
    `<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="${tabStop}"/></w:tabs>` +
    `<w:spacing w:after="40" w:line="259" w:lineRule="auto"/></w:pPr>` +
    `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>` +
    `<w:t xml:space="preserve">${label}</w:t></w:r>` +
    `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>` +
    `<w:tab/><w:t xml:space="preserve">${value}</w:t></w:r></w:p>`;
  return (
    line('ESTIMATED DELIVERY WEEK:', 'Can be delivered within {quotation.deliveryWeeks} weeks') +
    line('DELIVERY PLACE:', '{quotation.deliveryPlace}') +
    line('OFFER VALIDITY DAYS:', '{quotation.offerValidityDays} days')
  );
}

/**
 * Dinamik P&ID diyagram bölümü. generate-doc, şablon `hasDiagram` placeholder'ı
 * içerdiğinde diyagramı (lib/docx/diagram.ts) üretip {@diagramXml} ile gömer.
 * {@diagramXml} kendi başına bir paragrafta olmalı (docxtemplater raw-xml kuralı).
 */
function buildDiagramSection(): string {
  // Başlığa w:keepNext → görselle aynı sayfada kalır (büyük görsel alta sığmazsa
  // başlık öksüz kalmaz, ikisi birlikte sonraki sayfaya geçer).
  const heading =
    '<w:p><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="160" w:after="60"/></w:pPr>' +
    '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>' +
    '<w:t xml:space="preserve">{#hasDiagram}P&amp;ID Şematik Diyagram</w:t></w:r></w:p>';
  return (
    heading +
    '<w:p><w:pPr><w:keepNext/><w:spacing w:after="60"/><w:jc w:val="center"/></w:pPr>' +
    '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr><w:t>{@diagramXml}</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr></w:pPr>' +
    '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr><w:t>{/hasDiagram}</w:t></w:r></w:p>'
  );
}

/**
 * Equipment/Purpose/Quantity tablosu — tek satırlık docxtemplater döngü tablosu.
 * Adetler context'teki `equipment[]`'ten gelir; 0 olan kalemler listeye eklenmez
 * → satır otomatik gizlenir (koşullu satır). Hem Süt Alım hem Depolama kullanır.
 */
function buildEquipmentTable(): string {
  const g = [3211, 4580, 1840];
  const header = `<w:tr>${descHeaderCell('Equipment', g[0])}${descHeaderCell('Purpose', g[1])}${descHeaderCell('Quantity', g[2], 'center')}</w:tr>`;
  const loop = `<w:tr>${descCell('{#equipment}{name}', g[0])}${descCell('{purpose}', g[1])}${descCell('{quantity}{/equipment}', g[2], false, 'center')}</w:tr>`;
  return descTable(g, header + loop);
}

/**
 * Depolama (STORAGE) DESCRIPTION gövdesi: Dolum Hatları + Boşaltım Hatları + Tanklar
 * + Equipment tabloları. Her tablo docxtemplater döngüsü; context buildContext.ts'ten gelir.
 */
function buildStorageDescription(): string {
  // Dolum Hatları
  const fG = [600, 3000, 2200, 1900, 1900];
  const fHead = `<w:tr>${descHeaderCell('#', fG[0], 'center')}${descHeaderCell('Hat', fG[1])}${descHeaderCell('Kapasite (L/h)', fG[2], 'right')}${descHeaderCell('Vana Tipi', fG[3])}${descHeaderCell('Seçilen DN', fG[4])}</w:tr>`;
  const fLoop = `<w:tr>${descCell('{#fillingLines}{sira}', fG[0], false, 'center')}${descCell('{name}', fG[1])}${descCell('{capacity}', fG[2], false, 'right')}${descCell('{valveType}', fG[3])}${descCell('{selectedDN}{/fillingLines}', fG[4])}</w:tr>`;
  // Boşaltım Hatları
  const dG = [600, 2600, 1800, 1300, 1900, 1400];
  const dHead = `<w:tr>${descHeaderCell('#', dG[0], 'center')}${descHeaderCell('Hat', dG[1])}${descHeaderCell('Kapasite (L/h)', dG[2], 'right')}${descHeaderCell('Basınç (Bar)', dG[3], 'right')}${descHeaderCell('Pompa', dG[4])}${descHeaderCell('Flow Meter', dG[5])}</w:tr>`;
  const dLoop = `<w:tr>${descCell('{#dischargeLines}{sira}', dG[0], false, 'center')}${descCell('{name}', dG[1])}${descCell('{capacity}', dG[2], false, 'right')}${descCell('{pressure}', dG[3], false, 'right')}${descCell('{pumpModel}', dG[4])}${descCell('{flowMeterDN}{/dischargeLines}', dG[5])}</w:tr>`;
  // Tanklar
  const tG = [600, 3000, 1900, 2600, 1500];
  const tHead = `<w:tr>${descHeaderCell('#', tG[0], 'center')}${descHeaderCell('Tank', tG[1])}${descHeaderCell('Hacim (L)', tG[2], 'right')}${descHeaderCell('Sensörler', tG[3])}${descHeaderCell('Agitatör', tG[4])}</w:tr>`;
  const tLoop = `<w:tr>${descCell('{#tanks}{sira}', tG[0], false, 'center')}${descCell('{name}', tG[1])}${descCell('{volume}', tG[2], false, 'right')}${descCell('{sensors}', tG[3])}${descCell('{agitatorLabel}{/tanks}', tG[4])}</w:tr>`;
  return (
    descHeading('Dolum Hatları') + descTable(fG, fHead + fLoop) + spacerP() +
    descHeading('Boşaltım Hatları') + descTable(dG, dHead + dLoop) + spacerP() +
    descHeading('Tanklar') + descTable(tG, tHead + tLoop) + spacerP() +
    descHeading('Ekipman') + buildEquipmentTable() + spacerP() +
    buildDiagramSection()
  );
}

/** Bir metni içeren paragrafın [start,end) indekslerini döndürür. */
function paragraphRange(xml: string, anchor: string, label: string): [number, number] {
  const idx = xml.indexOf(anchor);
  if (idx < 0) throw new Error(`[${label}] paragraf bulunamadı (${anchor})`);
  const start = xml.lastIndexOf('<w:p ', idx);
  const end = xml.indexOf('</w:p>', idx) + 6;
  if (start < 0 || end < 6) throw new Error(`[${label}] paragraf sınırları bulunamadı`);
  return [start, end];
}

// ---------- Ortak dönüşümler (her iki şablon) ----------
// Kapak mektubu, başlık, genel bilgi ve fiyatlandırma alanları her iki modül tipinde
// aynıdır; yalnızca DESCRIPTION gövdesi farklıdır.
function applyCommonOps(xml: string): string {
  // 1) Başlık {…} placeholder'ları (boşluk/Türkçe içerdiği için docxtemplater'ı bozarlar)
  xml = replaceTextNode(xml, /\{Date variable\}/, '{quotation.date}', 'Tarih');
  xml = replaceTextNode(xml, /\{Teklif No\}/, '{quotation.no}', 'Teklif No');
  xml = replaceTextNode(xml, /\{Customer Name\}/, '{module.customerName}', 'Müşteri adı');
  xml = replaceTextNode(xml, /\{Teklifi Oluşturan kişi\}/, '{creator.name}', 'Hazırlayan');

  // 2) Modül başlığı (DESCRIPTION)
  xml = replaceTextNode(xml, /RAW MILK RECEPTION/, '{module.nameUpper}', 'Modül başlığı');

  // 3) Toplam fiyat
  xml = replaceTextNode(xml, /2\.765\.000/, '{pricing.totalPrice}', 'Toplam fiyat');

  // 4) Revizyon tarihi (teslim yeri/geçerlilik değerleri aşağıda temiz tabloya taşınır)
  xml = replaceTextNode(xml, /01\/07\/2025/, '{quotation.date}', 'Revizyon tarihi');

  // 5) Müşteri ilgili kişisi — paragraf "For the Attention of Mr|s Customer Contact |Person"
  //    araya giren sarı-olmayan metin (Mr/Person) yüzünden paragrafı bütünüyle yeniden yazıyoruz.
  {
    const [s, e] = paragraphRange(xml, 'For the Attention of', 'İlgili kişi');
    const rpr =
      '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>' +
      '<w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>';
    const newPara =
      `<w:p><w:pPr><w:pStyle w:val="Balk2"/>${rpr}</w:pPr>` +
      `<w:r>${rpr}<w:t xml:space="preserve">For the Attention of </w:t></w:r>` +
      `<w:r>${rpr}<w:t xml:space="preserve">{quotation.contactPerson}</w:t></w:r></w:p>`;
    xml = xml.slice(0, s) + newPara + xml.slice(e);
    console.log('  ✓ İlgili kişi: paragraf yeniden yazıldı → {quotation.contactPerson}');
  }

  // 6) Kabul süresi "…period of 30 calendar days…" (paragraf-scope, tek sarı run)
  {
    const [s, e] = paragraphRange(xml, 'calendar days from the date', 'Kabul süresi');
    let slice = xml.slice(s, e);
    slice = replaceYellowRunsInRegion(slice, ['{quotation.offerValidityDays}'], 'Kabul süresi');
    xml = xml.slice(0, s) + slice + xml.slice(e);
  }

  // 7) Teslimat/Geçerlilik bloğu → temiz 2 sütunlu tablo. Orijinalde etiketler
  //    1 sütunlu tabloda iç içe, değerler altta serbest paragraflarda ("sarkık").
  {
    const wi = xml.indexOf('DELIVERY WEEK');
    const di = xml.indexOf('30 days');
    if (wi < 0 || di < 0) throw new Error('[Teslimat bloğu] sınır bulunamadı');
    const tblStart = xml.lastIndexOf('<w:tbl>', wi);
    const blockEnd = xml.indexOf('</w:p>', di) + 6;
    if (tblStart < 0 || blockEnd < 6) throw new Error('[Teslimat bloğu] tablo/paragraf sınırı bulunamadı');
    xml = xml.slice(0, tblStart) + buildDeliveryBlock() + xml.slice(blockEnd);
    console.log('  ✓ Teslimat/Geçerlilik bloğu hizalı paragraflara dönüştürüldü');
  }

  return xml;
}

// "3. PRICING" başlığının sayfa özelliklerini ayarlar. pageBreak yalnızca Süt Alım'da
// true: milk diyagramı sayfa kırmaz, PRICING'i taze sayfaya almak için gerekir. Depolama'da
// diyagram zaten pageBreakAfter ile kırıyor; PRICING'e de pageBreakBefore koyunca aradaki
// boş paragraflar tek başına bir sayfada kalıp BOŞ SAYFA oluşturuyordu → storage'da false.
function setPricingPageProps(xml: string, pageBreak: boolean): string {
  const i = xml.indexOf('3. PRICING');
  if (i < 0) throw new Error('[PRICING] başlık bulunamadı');
  const ps = xml.lastIndexOf('<w:p ', i);
  const pe = xml.indexOf('</w:p>', i) + 6;
  const props = (pageBreak ? '<w:pageBreakBefore/>' : '') + '<w:keepNext/>';
  const para = xml.slice(ps, pe).replace('<w:pPr>', `<w:pPr>${props}`);
  console.log(`  ✓ 3. PRICING: ${pageBreak ? 'pageBreakBefore + ' : ''}keepNext`);
  return xml.slice(0, ps) + para + xml.slice(pe);
}

function stripHighlight(xml: string): string {
  const before = (xml.match(/<w:highlight w:val="yellow"\/>/g) || []).length;
  console.log(`  ✓ ${before} sarı highlight temizlendi`);
  return xml.replace(/<w:highlight w:val="yellow"\/>/g, '');
}

// ---------- Süt Alım varyantı ----------
function convertMilk(xml: string): string {
  console.log('\n[Süt Alım] dönüşüm:');
  xml = applyCommonOps(xml);

  // Hat (DESCRIPTION) tablosu → satır döngüsü ({#receptionLines}…{/receptionLines})
  {
    const idx = xml.indexOf('Raw Milk Reception 1');
    const rowStart = xml.lastIndexOf('<w:tr', idx);
    const rowEnd = xml.indexOf('</w:tr>', idx) + 7;
    let row = xml.slice(rowStart, rowEnd);
    row = row.replace('<w:t>Raw Milk Reception 1</w:t>', '<w:t xml:space="preserve">{name}</w:t>');
    row = row.replace('<w:t>1</w:t>', '<w:t xml:space="preserve">{#receptionLines}{sira}</w:t>');
    row = row.replace('<w:t>30.000</w:t>', '<w:t xml:space="preserve">{capacity}</w:t>');
    row = row.replace('<w:t>2</w:t>', '<w:t xml:space="preserve">{pressure}</w:t>');
    row = row.replace('<w:t>76 SMS (3")</w:t>', '<w:t xml:space="preserve">{dn}</w:t>');
    row = row.replace('<w:t>W+35/55</w:t>', '<w:t xml:space="preserve">{pumpModel}{/receptionLines}</w:t>');
    xml = xml.slice(0, rowStart) + row + xml.slice(rowEnd);
    console.log('  ✓ Hat tablosu: satır döngüsü kuruldu ({#receptionLines})');
  }

  // Equipment tablosu → tek döngü tablosu ({#equipment}, koşullu satır)
  {
    const headerIdx = xml.indexOf('>Equipment<');
    const cipIdx = xml.indexOf('RAW MILK TRUCKS CIP STATION');
    const eqStart = xml.lastIndexOf('<w:tbl>', headerIdx);
    const eqEnd = xml.lastIndexOf('</w:tbl>', cipIdx) + '</w:tbl>'.length;
    if (headerIdx < 0 || cipIdx < 0 || eqStart < 0) throw new Error('[Ekipman] tablo sınırları bulunamadı');
    xml = xml.slice(0, eqStart) + buildEquipmentTable() + xml.slice(eqEnd);
    console.log('  ✓ Ekipman tablosu: {#equipment} döngüsüne yeniden inşa edildi');
  }

  // Tanker CIP tablosu — Kapasite / Basınç / CIP Çapı / Pompa
  {
    const [s, e] = regionBetween(xml, 'RAW MILK TRUCKS CIP STATION', '3. PRICING', 'Tanker CIP');
    let slice = xml.slice(s, e);
    slice = replaceYellowRunsInRegion(
      slice,
      ['{tankerCip.capacity}', '{tankerCip.pressure}', '{tankerCip.dn}', '{tankerCip.pumpModel}'],
      'Tanker CIP',
    );
    xml = xml.slice(0, s) + slice + xml.slice(e);
  }

  // Örnek diyagram görselini (DESCRIPTION içindeki statik "Diyagram") dinamik diyagram
  // bölümüyle ({#hasDiagram}{@diagramXml}{/hasDiagram}) değiştir.
  {
    const dIdx = xml.indexOf('name="Diyagram"');
    if (dIdx < 0) throw new Error('[Diyagram] örnek diyagram bulunamadı');
    const pStart = xml.lastIndexOf('<w:p ', dIdx);
    const pEnd = xml.indexOf('</w:p>', dIdx) + 6;
    xml = xml.slice(0, pStart) + buildDiagramSection() + xml.slice(pEnd);
    console.log('  ✓ Örnek diyagram → dinamik {#hasDiagram}{@diagramXml} bölümü');
  }

  xml = setPricingPageProps(xml, true); // milk diyagramı sayfa kırmaz → PRICING'i taze sayfaya al
  return stripHighlight(xml);
}

// ---------- Depolama varyantı ----------
function convertStorage(xml: string): string {
  console.log('\n[Depolama] dönüşüm:');
  xml = applyCommonOps(xml);

  // DESCRIPTION gövdesini (modül başlığından "3. PRICING"e kadar — Hat tablosu, Equipment,
  // Tanker CIP) depolama tablolarıyla (Dolum/Boşaltım/Tank + Equipment) tamamen değiştir.
  {
    const titleIdx = xml.indexOf('{module.nameUpper}');
    const descStart = xml.indexOf('</w:p>', titleIdx) + 6;
    const [pricingStart] = paragraphRange(xml, '3. PRICING', 'PRICING');
    if (titleIdx < 0 || descStart < 6 || pricingStart < 0) throw new Error('[Depolama] DESCRIPTION sınırları bulunamadı');
    xml = xml.slice(0, descStart) + spacerP() + buildStorageDescription() + spacerP() + xml.slice(pricingStart);
    console.log('  ✓ DESCRIPTION gövdesi depolama tablolarıyla değiştirildi');
  }

  xml = setPricingPageProps(xml, false); // diyagram zaten pageBreakAfter → ikinci kırılma boş sayfa yapardı
  return stripHighlight(xml);
}

// ---------- Render-test mock'ları ----------
// Gerçekçi diyagram XML'i — a:/pic:/wp:/r: prefix'leri kullanır ki render sonrası
// strict XML kontrolü kök namespace eksikliğini yakalayabilsin.
const MOCK_DIAGRAM =
  '<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
  '<wp:extent cx="100" cy="100"/><wp:docPr id="2" name="Diyagram"/>' +
  '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
  '<pic:pic><pic:nvPicPr><pic:cNvPr id="2" name="d"/><pic:cNvPicPr/></pic:nvPicPr>' +
  '<pic:blipFill><a:blip r:embed="rIdDiagram1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
  '<pic:spPr/></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';

const MILK_MOCK = {
  quotation: { no: 'HEM-2026-001', date: '08.06.2026', contactPerson: 'Mrs Jane Doe', deliveryWeeks: '16', deliveryPlace: 'Customer Factory', offerValidityDays: '30' },
  module: { name: 'Raw Milk Reception', nameUpper: 'RAW MILK RECEPTION', customerName: 'ABC Süt A.Ş.' },
  creator: { name: 'Elvan Gürsu' },
  receptionLines: [
    { sira: 1, name: 'Raw Milk Reception 1', capacity: '30.000', pressure: '2', dn: '76 SMS (3")', pumpModel: 'W+35/55' },
    { sira: 2, name: 'Raw Milk Reception 2', capacity: '20.000', pressure: '2', dn: '63 SMS (2"1/2)', pumpModel: 'W+22/20' },
  ],
  equipment: [
    { name: 'Valves', purpose: 'To control and direct the product flow throughout the process line.', quantity: 13 },
    { name: 'Degasser', purpose: 'To continuously remove dissolved air from the milk without introducing additional air.', quantity: 1 },
    { name: 'Filter Unit', purpose: 'To remove unwanted particles and impurities from the milk.', quantity: 2 },
    { name: 'Sensors', purpose: 'To monitor process parameters such as pressure, temperature, and flow rate.', quantity: 4 },
  ],
  tankerCip: { capacity: '30.000', pressure: '2', dn: '76 SMS (3")', pumpModel: 'W+22/20' },
  pricing: { currency: 'EURO', totalPrice: '2.765.000' },
  hasDiagram: true,
  diagramXml: MOCK_DIAGRAM,
};

const STORAGE_MOCK = {
  quotation: { no: 'HEM-2026-002', date: '08.06.2026', contactPerson: 'Mrs Jane Doe', deliveryWeeks: '18', deliveryPlace: 'Customer Factory', offerValidityDays: '30' },
  module: { name: 'Raw Milk Storage', nameUpper: 'RAW MILK STORAGE', customerName: 'ABC Süt A.Ş.' },
  creator: { name: 'Elvan Gürsu' },
  fillingLines: [
    { sira: 1, name: 'Filling 1', capacity: '25.000', valveType: 'SDE44', selectedDN: '51 SMS (2")' },
    { sira: 2, name: 'Filling 2', capacity: '20.000', valveType: 'SDE44', selectedDN: '51 SMS (2")' },
  ],
  dischargeLines: [
    { sira: 1, name: 'Pasteurizer 1', capacity: '20.000', pressure: '3', pumpModel: 'W+20/...', flowMeterDN: '38 SMS (1"1/2)' },
  ],
  tanks: [
    { sira: 1, name: 'RMT 1', volume: '80.000', sensors: 'LSH, LSL, TT', agitatorLabel: 'Var (5.5 kW, 30 rpm, Yan)' },
    { sira: 2, name: 'RMT 2', volume: '80.000', sensors: 'LSH, LSL', agitatorLabel: 'Yok' },
  ],
  equipment: [
    { name: 'Valves', purpose: 'To control and direct the product flow throughout the process line.', quantity: 18 },
    { name: 'Storage Tanks', purpose: 'To store the product under hygienic conditions.', quantity: 2 },
    { name: 'Agitators', purpose: 'To keep the product homogeneous inside the tanks.', quantity: 1 },
    { name: 'Sensors', purpose: 'To monitor process parameters such as level, pressure, and temperature.', quantity: 5 },
  ],
  pricing: { currency: 'EURO', totalPrice: '2.300.000' },
  hasDiagram: true,
  diagramXml: MOCK_DIAGRAM,
};

// document.xml'i strict XML parser'la doğrular (kök namespace eksikliği, dengesiz
// etiket vb. → Word'ün "belge açılamadı" hatasını build-time'da yakalar).
function strictXmlCheck(xmlText: string, label: string): void {
  let DOMParser: (new (opts?: unknown) => { parseFromString: (s: string, t: string) => unknown }) | undefined;
  try {
    DOMParser = (require('@xmldom/xmldom') as { DOMParser: typeof DOMParser }).DOMParser;
  } catch {
    return; // parser yoksa atla
  }
  if (!DOMParser) return;
  try {
    // Namespace/well-formedness hataları parseFromString sırasında ParseError fırlatır.
    new DOMParser({ onError: () => {} }).parseFromString(xmlText, 'text/xml');
  } catch (e) {
    throw new Error(`[${label}] document.xml geçersiz XML: ${(e instanceof Error ? e.message : String(e)).slice(0, 160)}`);
  }
}

function renderTest(buffer: Buffer, mock: unknown, label: string): void {
  const zip = new PizZip(buffer);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, parser: dotNotationParser, nullGetter: () => '' });
  doc.render(mock as Record<string, unknown>);
  const out = doc.getZip();
  out.generate({ type: 'nodebuffer' });
  strictXmlCheck((out.file('word/document.xml') as { asText: () => string }).asText(), label);
  console.log(`  ✓ render-test geçti (XML doğrulandı): ${label}`);
}

async function upsertTemplate(opts: { name: string; description: string; filename: string; buffer: Buffer; moduleType: string }): Promise<void> {
  const placeholders = extractPlaceholders(opts.buffer);
  const existing = await prisma.documentTemplate.findFirst({ where: { name: opts.name } });
  const data = {
    name: opts.name,
    description: opts.description,
    filename: opts.filename,
    filepath: `/uploads/templates/${opts.filename}`,
    placeholders,
    moduleType: opts.moduleType,
    isActive: true,
  };
  if (existing) {
    await prisma.documentTemplate.update({ where: { id: existing.id }, data });
    console.log(`  ✓ Şablon güncellendi: ${opts.name} (${placeholders.length} placeholder)`);
  } else {
    await prisma.documentTemplate.create({ data });
    console.log(`  ✓ Şablon oluşturuldu: ${opts.name} (${placeholders.length} placeholder)`);
  }
}

// Diyagram çizimi a:/pic: prefix'leri kullanır. HEM-PROJECT-NO kök <w:document>'i
// bunları (orijinal görseller satır-içi tanımladığı için) köke EKLEMEZ; biz gömünce
// "prefix is non-null and namespace is null" → bozuk .docx olur. Köke ekleyerek çözeriz.
function ensureDrawingNamespaces(xml: string): string {
  return xml.replace(/<w:document\b([^>]*)>/, (_m, attrs: string) => {
    let add = '';
    if (!/\sxmlns:a=/.test(attrs)) add += ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
    if (!/\sxmlns:pic=/.test(attrs)) add += ' xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
    if (add) console.log('  ✓ Kök namespace eklendi:' + add.replace(/="[^"]*"/g, ''));
    return `<w:document${attrs}${add}>`;
  });
}

function buildVariant(srcBuf: Buffer, convert: (xml: string) => string): Buffer {
  const zip = new PizZip(srcBuf);
  const docXml = zip.file('word/document.xml')?.asText();
  if (!docXml) throw new Error('word/document.xml okunamadı');
  zip.file('word/document.xml', ensureDrawingNamespaces(convert(docXml)));
  return zip.generate({ type: 'nodebuffer' }) as Buffer;
}

async function main() {
  const root = process.cwd();
  const srcBuf = fs.readFileSync(path.join(root, SOURCE));
  const outDir = path.join(root, 'public', 'uploads', 'templates');
  fs.mkdirSync(outDir, { recursive: true });

  // Süt Alım varyantı
  const milkBuf = buildVariant(srcBuf, convertMilk);
  console.log('\nDoğrulama:');
  renderTest(milkBuf, MILK_MOCK, 'Süt Alım');
  fs.writeFileSync(path.join(outDir, OUT_FILENAME_MILK), milkBuf);

  // Depolama varyantı
  const storageBuf = buildVariant(srcBuf, convertStorage);
  renderTest(storageBuf, STORAGE_MOCK, 'Depolama');
  fs.writeFileSync(path.join(outDir, OUT_FILENAME_STORAGE), storageBuf);

  await upsertTemplate({
    name: 'APV Hemisan Teklif (HEM-PROJECT-NO)',
    description: 'Tam teklif belgesi — Süt Alım (kapak mektubu, genel bilgi, açıklama, fiyatlandırma).',
    filename: OUT_FILENAME_MILK, buffer: milkBuf, moduleType: 'MILK_RECEPTION',
  });
  await upsertTemplate({
    name: 'APV Hemisan Teklif (HEM-PROJECT-NO) — Depolama',
    description: 'Tam teklif belgesi — Depolama (dolum/boşaltım hatları, tanklar, ekipman).',
    filename: OUT_FILENAME_STORAGE, buffer: storageBuf, moduleType: 'STORAGE',
  });

  await prisma.$disconnect();
  console.log('\nTamamlandı. İki şablon (Süt Alım + Depolama) yazıldı ve aktif kaydedildi.');
}

main().catch(async (e) => {
  console.error('\nHATA:', e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
