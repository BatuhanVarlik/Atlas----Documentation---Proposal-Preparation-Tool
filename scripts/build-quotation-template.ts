/* eslint-disable no-console */
// REFERANS şablon: data/reference/apv-teklif-birlesik.docx  (tasarım/tablolar/placeholder'lar
// Word'de bakımı yapılır — tek birleşik şablon: Süt Alım + Depolama, {#isReception}/
// {#isStorage} ile koşullu bölümler).
//
// Bu script ŞABLONU ÜRETMEZ; sadece referansı alıp Word'ün bozabildiği iki şeyi GARANTİ
// ALTINA ALIR, doğrular ve DocumentTemplate olarak kaydeder:
//   1. Kök <w:document>'e xmlns:a / xmlns:pic  (diyagram gömme a:/pic: prefix'i kullanır).
//   2. "3. PRICING" paragrafına pageBreakBefore + keepNext (her zaman yeni sayfada başlar,
//      önceki sayfaya kaymaz). Diyagram artık sayfa kırmadığı için tek temiz kırılma olur.
// Ardından her iki modül context'iyle render-test eder (placeholder/koşul bozulmasını
// build-time yakalar) ve kaydeder; eski iki ayrı şablonu pasifleştirir.
//
// Çalıştırma: npx tsx scripts/build-quotation-template.ts

import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { prisma } from '../lib/prisma';
import { extractPlaceholders, dotNotationParser } from '../lib/docx/renderTemplate';

const SOURCE = 'data/reference/apv-teklif-birlesik.docx';
const OUT_FILENAME = 'apv-teklif-birlesik.docx';
const TEMPLATE_NAME = 'APV Hemisan Teklif (Birleşik)';
const OLD_TEMPLATE_NAMES = [
  'APV Hemisan Teklif (HEM-PROJECT-NO)',
  'APV Hemisan Teklif (HEM-PROJECT-NO) — Depolama',
];

// Diyagram çizimi a:/pic: prefix'leri kullanır; Word kök <w:document>'e bunları eklemez →
// gömünce "prefix is non-null and namespace is null" → bozuk .docx. Köke ekleyerek çözeriz.
function ensureDrawingNamespaces(xml: string): string {
  return xml.replace(/<w:document\b([^>]*)>/, (_m, attrs: string) => {
    let add = '';
    if (!/\sxmlns:a=/.test(attrs)) add += ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
    if (!/\sxmlns:pic=/.test(attrs)) add += ' xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
    if (add) console.log('  ✓ Kök namespace eklendi:' + add.replace(/="[^"]*"/g, ''));
    return `<w:document${attrs}${add}>`;
  });
}

// "3. PRICING" paragrafına pageBreakBefore + keepNext. pageBreakBefore boş sayfa YARATMAZ
// (manuel page-break run'ından farklı): paragraf zaten sayfa başındaysa etkisizdir, değilse
// yeni sayfaya iter → PRICING her zaman kendi sayfasında, asla önceki sayfaya kaymaz.
function setPricingPageProps(xml: string): string {
  const i = xml.indexOf('3. PRICING');
  if (i < 0) throw new Error('[PRICING] "3. PRICING" başlığı bulunamadı (şablon değişmiş olabilir)');
  const ps = xml.lastIndexOf('<w:p ', i);
  const pe = xml.indexOf('</w:p>', i) + 6;
  let para = xml.slice(ps, pe);
  // Önceki kalıntıları temizle, yeniden ekle (idempotent)
  para = para.replace(/<w:pageBreakBefore\/>/g, '').replace(/<w:keepNext\/>/g, '');
  if (para.includes('<w:pPr>')) {
    para = para.replace('<w:pPr>', '<w:pPr><w:pageBreakBefore/><w:keepNext/>');
  } else {
    para = para.replace(/<w:p\b([^>]*)>/, '<w:p$1><w:pPr><w:pageBreakBefore/><w:keepNext/></w:pPr>');
  }
  console.log('  ✓ 3. PRICING: pageBreakBefore + keepNext (her zaman yeni sayfa)');
  return xml.slice(0, ps) + para + xml.slice(pe);
}

function processTemplate(srcBuf: Buffer): Buffer {
  const zip = new PizZip(srcBuf);
  const docXml = zip.file('word/document.xml')?.asText();
  if (!docXml) throw new Error('word/document.xml okunamadı');
  let xml = ensureDrawingNamespaces(docXml);
  xml = setPricingPageProps(xml);
  zip.file('word/document.xml', xml);
  return zip.generate({ type: 'nodebuffer' }) as Buffer;
}

// ---------- Render-test ----------
// Gerçekçi diyagram XML'i — a:/pic:/wp:/r: prefix'leri kullanır ki render sonrası strict XML
// kontrolü kök namespace eksikliğini yakalayabilsin.
const MOCK_DIAGRAM =
  '<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
  '<wp:extent cx="100" cy="100"/><wp:docPr id="2" name="Diyagram"/>' +
  '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
  '<pic:pic><pic:nvPicPr><pic:cNvPr id="2" name="d"/><pic:cNvPicPr/></pic:nvPicPr>' +
  '<pic:blipFill><a:blip r:embed="rIdDiagram1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
  '<pic:spPr/></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';

const COMMON = {
  quotation: { no: 'HEM-2026-001', date: '08.06.2026', contactPerson: 'Mrs Jane Doe', deliveryWeeks: '16', deliveryPlace: 'Customer Factory', offerValidityDays: '30' },
  creator: { name: 'Elvan Gürsu' },
  pricing: { currency: 'EURO', totalPrice: '2.765.000' },
  hasDiagram: true,
  diagramXml: MOCK_DIAGRAM,
};

const MILK_MOCK = {
  ...COMMON,
  isReception: true,
  isStorage: false,
  module: { name: 'Raw Milk Reception', nameUpper: 'RAW MILK RECEPTION', customerName: 'ABC Süt A.Ş.' },
  receptionLines: [
    { sira: 1, name: 'Raw Milk Reception 1', capacity: '30.000', pressure: '2', dn: '76 SMS (3")', pumpModel: 'W+35/55' },
    { sira: 2, name: 'Raw Milk Reception 2', capacity: '20.000', pressure: '2', dn: '63 SMS (2"1/2)', pumpModel: 'W+22/20' },
  ],
  equipment: [
    { name: 'Valves', purpose: 'To control and direct the product flow.', quantity: 13 },
    { name: 'Sensors', purpose: 'To monitor process parameters.', quantity: 4 },
  ],
  tankerCip: { capacity: '30.000', pressure: '2', dn: '76 SMS (3")', pumpModel: 'W+22/20' },
};

const STORAGE_MOCK = {
  ...COMMON,
  isReception: false,
  isStorage: true,
  module: { name: 'Raw Milk Storage', nameUpper: 'RAW MILK STORAGE', customerName: 'ABC Süt A.Ş.' },
  fillingLines: [
    { sira: 1, name: 'Filling 1', capacity: '25.000', valveType: 'SDE44', selectedDN: '51 SMS (2")' },
  ],
  dischargeLines: [
    { sira: 1, name: 'Pasteurizer 1', capacity: '20.000', pressure: '3', pumpModel: 'W+20/...', flowMeterDN: '38 SMS (1"1/2)' },
  ],
  tanks: [
    { sira: 1, name: 'RMT 1', volume: '80.000', sensors: 'LSH, LSL, TT', agitatorLabel: 'Var (5.5 kW, 30 rpm, Yan)' },
  ],
  equipment: [
    { name: 'Storage Tanks', purpose: 'To store the product under hygienic conditions.', quantity: 2 },
    { name: 'Agitators', purpose: 'To keep the product homogeneous.', quantity: 1 },
  ],
};

// document.xml'i strict XML parser'la doğrular (kök namespace eksikliği, dengesiz etiket →
// Word'ün "belge açılamadı" hatasını build-time yakalar).
function strictXmlCheck(xmlText: string, label: string): void {
  let DOMParser: (new (opts?: unknown) => { parseFromString: (s: string, t: string) => unknown }) | undefined;
  try {
    DOMParser = (require('@xmldom/xmldom') as { DOMParser: typeof DOMParser }).DOMParser;
  } catch {
    return;
  }
  if (!DOMParser) return;
  try {
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
    filepath: `templates/${opts.filename}`,
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

async function main() {
  const root = process.cwd();
  const srcPath = path.join(root, SOURCE);
  if (!fs.existsSync(srcPath)) throw new Error(`Referans şablon bulunamadı: ${SOURCE}`);
  const srcBuf = fs.readFileSync(srcPath);
  const outDir = path.join(root, 'data', 'templates');
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`Referans: ${SOURCE}`);
  const buf = processTemplate(srcBuf);

  console.log('\nDoğrulama (tek şablon · iki modül context\'i):');
  renderTest(buf, MILK_MOCK, 'Birleşik · Süt Alım');
  renderTest(buf, STORAGE_MOCK, 'Birleşik · Depolama');
  fs.writeFileSync(path.join(outDir, OUT_FILENAME), buf);

  await upsertTemplate({
    name: TEMPLATE_NAME,
    description: 'Tek teklif belgesi — Süt Alım + Depolama (modüle göre koşullu bölümler).',
    filename: OUT_FILENAME,
    buffer: buf,
    moduleType: 'GENERIC',
  });

  // Eski iki ayrı şablon (varsa) pasifleştir → dialoglarda görünmez, geçmiş FK'sı korunur.
  const deact = await prisma.documentTemplate.updateMany({
    where: { name: { in: OLD_TEMPLATE_NAMES } },
    data: { isActive: false },
  });
  if (deact.count > 0) console.log(`  ✓ Eski ${deact.count} ayrı şablon pasifleştirildi`);

  await prisma.$disconnect();
  console.log('\nTamamlandı. Referans şablon işlendi, doğrulandı ve kaydedildi (GENERIC).');
}

main().catch(async (e) => {
  console.error('\nHATA:', e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
