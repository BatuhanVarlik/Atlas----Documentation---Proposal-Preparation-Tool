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
const OUT_FILENAME = 'apv-teklif-genel.docx';

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

/** Bir metni içeren paragrafın [start,end) indekslerini döndürür. */
function paragraphRange(xml: string, anchor: string, label: string): [number, number] {
  const idx = xml.indexOf(anchor);
  if (idx < 0) throw new Error(`[${label}] paragraf bulunamadı (${anchor})`);
  const start = xml.lastIndexOf('<w:p ', idx);
  const end = xml.indexOf('</w:p>', idx) + 6;
  if (start < 0 || end < 6) throw new Error(`[${label}] paragraf sınırları bulunamadı`);
  return [start, end];
}

// ---------- Ana dönüşüm ----------
function convertDocumentXml(xml: string): string {
  console.log('\nDönüşüm başlıyor:');

  // 1) Başlık {…} placeholder'ları (boşluk/Türkçe içerdiği için docxtemplater'ı bozarlar)
  xml = replaceTextNode(xml, /\{Date variable\}/, '{quotation.date}', 'Tarih');
  xml = replaceTextNode(xml, /\{Teklif No\}/, '{quotation.no}', 'Teklif No');
  xml = replaceTextNode(xml, /\{Customer Name\}/, '{module.customerName}', 'Müşteri adı');
  xml = replaceTextNode(xml, /\{Teklifi Oluşturan kişi\}/, '{creator.name}', 'Hazırlayan');

  // 2) Modül başlığı (DESCRIPTION)
  xml = replaceTextNode(xml, /RAW MILK RECEPTION/, '{module.nameUpper}', 'Modül başlığı');

  // 3) Toplam fiyat
  xml = replaceTextNode(xml, /2\.765\.000/, '{pricing.totalPrice}', 'Toplam fiyat');

  // 4) Teslimat yeri / geçerlilik / revizyon tarihi
  xml = replaceTextNode(xml, /Customer Factory\s*/, '{quotation.deliveryPlace}', 'Teslim yeri');
  xml = replaceTextNode(xml, /30 days/, '{quotation.offerValidityDays} days', 'Teklif geçerliliği');
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

  // 7) Hat (DESCRIPTION) tablosu → satır döngüsü. Tek örnek satırı {#receptionLines}…{/receptionLines}
  {
    const anchor = 'Raw Milk Reception 1';
    const idx = xml.indexOf(anchor);
    const rowStart = xml.lastIndexOf('<w:tr', idx);
    const rowEnd = xml.indexOf('</w:tr>', idx) + 7;
    let row = xml.slice(rowStart, rowEnd);
    // Önce isim (sondaki "1" çakışmasını ortadan kaldırır), sonra # hücresindeki "1"
    row = row.replace('<w:t>Raw Milk Reception 1</w:t>', '<w:t xml:space="preserve">{name}</w:t>');
    row = row.replace('<w:t>1</w:t>', '<w:t xml:space="preserve">{#receptionLines}{sira}</w:t>');
    row = row.replace('<w:t>30.000</w:t>', '<w:t xml:space="preserve">{capacity}</w:t>');
    row = row.replace('<w:t>2</w:t>', '<w:t xml:space="preserve">{pressure}</w:t>');
    row = row.replace('<w:t>76 SMS (3")</w:t>', '<w:t xml:space="preserve">{dn}</w:t>');
    row = row.replace('<w:t>W+35/55</w:t>', '<w:t xml:space="preserve">{pumpModel}{/receptionLines}</w:t>');
    xml = xml.slice(0, rowStart) + row + xml.slice(rowEnd);
    console.log('  ✓ Hat tablosu: satır döngüsü kuruldu ({#receptionLines}…{/receptionLines})');
  }

  // 8) Equipment / Quantity tablosu — yalnızca adetler (Valves, Degasser, Filter, PHE)
  {
    const [s, e] = regionBetween(
      xml,
      'To control and direct',
      'RAW MILK TRUCKS CIP STATION',
      'Ekipman adetleri',
    );
    let slice = xml.slice(s, e);
    slice = replaceYellowRunsInRegion(
      slice,
      ['{valveCount}', '{degasserCount}', '{totals.filterUnitTotal}', '{totals.pheCount}'],
      'Ekipman adetleri',
    );
    xml = xml.slice(0, s) + slice + xml.slice(e);
  }

  // 9) Sensors satırı — adet hücresi boş; {sensorCount} run'ı enjekte et
  {
    const a = xml.indexOf('To monitor process');
    const rowStart = xml.lastIndexOf('<w:tr', a);
    const rowEnd = xml.indexOf('</w:tr>', a) + 7;
    let row = xml.slice(rowStart, rowEnd);
    // Son hücrenin boş paragrafına run ekle (</w:pPr></w:p></w:tc></w:tr> sonundaki son </w:p>)
    const lastTcStart = row.lastIndexOf('<w:tc>');
    let lastTc = row.slice(lastTcStart);
    const runXml =
      '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr>' +
      '<w:t xml:space="preserve">{sensorCount}</w:t></w:r>';
    lastTc = lastTc.replace('</w:p>', `${runXml}</w:p>`);
    row = row.slice(0, lastTcStart) + lastTc;
    xml = xml.slice(0, rowStart) + row + xml.slice(rowEnd);
    console.log('  ✓ Sensors adedi: boş hücreye {sensorCount} eklendi');
  }

  // 10) Teslim süresi "Can be delivered within -- weeks" — yalnızca "--"
  {
    const [s, e] = paragraphRange(xml, 'Can be delivered within', 'Teslim süresi');
    let slice = xml.slice(s, e);
    slice = slice.replace(/<w:t[^>]*>--<\/w:t>/, '<w:t xml:space="preserve">{quotation.deliveryWeeks}</w:t>');
    xml = xml.slice(0, s) + slice + xml.slice(e);
    console.log('  ✓ Teslim süresi: "--" → {quotation.deliveryWeeks}');
  }

  // 11) Tanker CIP tablosu — Kapasite / Basınç / CIP Çapı / Pompa
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

  // 12) Kalan tüm sarı highlight'ları temizle (artık hepsi placeholder; çıktı sararmasın)
  const before = (xml.match(/<w:highlight w:val="yellow"\/>/g) || []).length;
  xml = xml.replace(/<w:highlight w:val="yellow"\/>/g, '');
  console.log(`  ✓ ${before} sarı highlight temizlendi`);

  return xml;
}

// ---------- Render-test mock (buildMilkReceptionContext + quotation eklerine uyumlu) ----------
const MOCK = {
  quotation: {
    no: 'HEM-2026-001',
    date: '08.06.2026',
    contactPerson: 'Mrs Jane Doe',
    deliveryWeeks: '16',
    deliveryPlace: 'Customer Factory',
    offerValidityDays: '30',
  },
  module: { name: 'Raw Milk Reception', nameUpper: 'RAW MILK RECEPTION', customerName: 'ABC Süt A.Ş.' },
  creator: { name: 'Elvan Gürsu' },
  receptionLines: [
    { sira: 1, name: 'Raw Milk Reception 1', capacity: '30.000', pressure: '2', dn: '76 SMS (3")', pumpModel: 'W+35/55' },
    { sira: 2, name: 'Raw Milk Reception 2', capacity: '20.000', pressure: '2', dn: '63 SMS (2"1/2)', pumpModel: 'W+22/20' },
  ],
  valveCount: 13,
  degasserCount: 1,
  sensorCount: 4,
  totals: { filterUnitTotal: 2, pheCount: 1 },
  tankerCip: { capacity: '30.000', pressure: '2', dn: '76 SMS (3")', pumpModel: 'W+22/20' },
  pricing: { currency: 'EURO', totalPrice: '2.765.000' },
};

function renderTest(buffer: Buffer): void {
  const zip = new PizZip(buffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    parser: dotNotationParser,
    nullGetter: () => '',
  });
  doc.render(MOCK as Record<string, unknown>);
  doc.getZip().generate({ type: 'nodebuffer' });
  console.log('  ✓ render-test geçti (mock context)');
}

async function upsertTemplate(filename: string, buffer: Buffer): Promise<void> {
  const placeholders = extractPlaceholders(buffer);
  const name = 'APV Hemisan Teklif (HEM-PROJECT-NO)';
  const existing = await prisma.documentTemplate.findFirst({ where: { name } });
  const data = {
    name,
    description: 'Kullanıcının hazırladığı tam teklif belgesi (kapak mektubu, genel bilgi, açıklama, fiyatlandırma).',
    filename,
    filepath: `/uploads/templates/${filename}`,
    placeholders,
    moduleType: 'MILK_RECEPTION',
    isActive: true,
  };
  if (existing) {
    await prisma.documentTemplate.update({ where: { id: existing.id }, data });
    console.log(`  ✓ Şablon güncellendi (${placeholders.length} placeholder)`);
  } else {
    await prisma.documentTemplate.create({ data });
    console.log(`  ✓ Şablon oluşturuldu (${placeholders.length} placeholder)`);
  }
}

async function main() {
  const root = process.cwd();
  const srcBuf = fs.readFileSync(path.join(root, SOURCE));
  const zip = new PizZip(srcBuf);
  const docXml = zip.file('word/document.xml')?.asText();
  if (!docXml) throw new Error('word/document.xml okunamadı');

  const converted = convertDocumentXml(docXml);
  zip.file('word/document.xml', converted);
  const outBuf = zip.generate({ type: 'nodebuffer' }) as Buffer;

  console.log('\nDoğrulama:');
  renderTest(outBuf);

  const outDir = path.join(root, 'public', 'uploads', 'templates');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, OUT_FILENAME), outBuf);
  console.log(`\n  ✓ Yazıldı: public/uploads/templates/${OUT_FILENAME}`);

  console.log('\nPlaceholder listesi:');
  console.log('  ' + extractPlaceholders(outBuf).join('\n  '));

  await upsertTemplate(OUT_FILENAME, outBuf);
  await prisma.$disconnect();
  console.log('\nTamamlandı.');
}

main().catch(async (e) => {
  console.error('\nHATA:', e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
