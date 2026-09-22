import PizZip from 'pizzip';

/**
 * Üretilen .xlsx dosyasına SheetJS'in yazamadığı parçaları ekler.
 *
 * SheetJS sayfa düzenini (kâğıt boyu, sığdırma) ve grafikleri yazmaz.
 * Dosya burada açılır, ilgili sayfanın XML'ine düğümler eklenir ve yeniden
 * paketlenir. XML metin olarak işlenir: kaynak SheetJS'in kendi çıktısıdır,
 * biçimi bilinir ve dar kapsamlıdır — tam bir XML ayrıştırıcısı taşımaya
 * değmez.
 *
 * Şema sırası önemlidir: <sheetPr> belgenin ilk çocuğu olmalı, <pageSetup>
 * ise <sheetData>'dan sonra gelmeli. Sıra bozulursa Excel dosyayı
 * "onarılması gerekiyor" diye açar.
 */

export interface SheetSetup {
  /** Kitaptaki sayfa adı. */
  sheet: string;
  /** A4 dikey, genişliği tek sayfaya sığdır. */
  a4FitToWidth?: boolean;
}

/** XML metnindeki öznitelik değerini okur. */
function attr(xml: string, tag: string, name: string): string | null {
  const open = xml.indexOf('<' + tag);
  if (open < 0) return null;
  const end = xml.indexOf('>', open);
  const m = new RegExp(`${name}="([^"]*)"`).exec(xml.slice(open, end));
  return m ? m[1] : null;
}

/**
 * Sayfa adından worksheet XML parçasının yolunu çözer.
 *
 * Sıra workbook.xml'deki <sheet> düğümlerinden, dosya adı da r:id üzerinden
 * workbook.xml.rels'ten gelir — "sheetN.xml, N'inci sayfadır" varsayımı her
 * zaman doğru değil.
 */
export function sheetPartName(zip: PizZip, sheetName: string): string | null {
  const wb = zip.file('xl/workbook.xml')?.asText();
  const rels = zip.file('xl/_rels/workbook.xml.rels')?.asText();
  if (!wb || !rels) return null;

  const escaped = sheetName
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  const node = new RegExp(`<sheet[^>]*name="${escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*/>`).exec(wb);
  if (!node) return null;

  const rid = /r:id="([^"]+)"/.exec(node[0])?.[1];
  if (!rid) return null;

  const rel = new RegExp(`<Relationship[^>]*Id="${rid}"[^>]*/>`).exec(rels);
  const target = rel && /Target="([^"]+)"/.exec(rel[0])?.[1];
  if (!target) return null;

  const path = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
  return zip.file(path) ? path : null;
}

/** <sheetPr> düğümünü belgenin ilk çocuğu olarak ekler ya da tazeler. */
function withSheetPr(xml: string, inner: string): string {
  if (xml.includes('<sheetPr')) {
    // Var olan sheetPr'ı kendi kendine kapanıyorsa aç, içine ekle.
    return xml
      .replace('<sheetPr/>', `<sheetPr>${inner}</sheetPr>`)
      .replace(/<sheetPr>(?!.*?<pageSetUpPr)/, `<sheetPr>${inner}`);
  }
  const close = xml.indexOf('>', xml.indexOf('<worksheet ')) + 1;
  return xml.slice(0, close) + `<sheetPr>${inner}</sheetPr>` + xml.slice(close);
}

/**
 * <pageSetup> düğümünü şema sırasına uygun yere koyar: <pageMargins> varsa
 * hemen ardına, yoksa </sheetData>'dan sonraki ilk uygun noktaya.
 */
function withPageSetup(xml: string, node: string): string {
  if (xml.includes('<pageSetup ')) return xml;

  const margins = xml.indexOf('<pageMargins');
  if (margins >= 0) {
    const end = xml.indexOf('>', margins) + 1;
    return xml.slice(0, end) + node + xml.slice(end);
  }

  // pageMargins yoksa Excel varsayılanını da yazarız; pageSetup tek başına
  // duran bir düğüm olarak kabul edilse de ikisi birlikte daha güvenli.
  const defaults = '<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5"'
    + ' header="0.3" footer="0.3"/>';
  const anchor = xml.indexOf('<ignoredErrors');
  const at = anchor >= 0 ? anchor : xml.lastIndexOf('</worksheet>');
  return xml.slice(0, at) + defaults + node + xml.slice(at);
}

/** Verilen sayfalara sayfa düzeni uygular; dosyayı yeniden paketleyip döner. */
export function applySheetSetup(buffer: Buffer, setups: SheetSetup[]): Buffer {
  const zip = new PizZip(buffer);

  for (const setup of setups) {
    const part = sheetPartName(zip, setup.sheet);
    if (!part) continue;                       // sayfa yoksa sessizce geç

    let xml = zip.file(part)!.asText();
    if (setup.a4FitToWidth) {
      xml = withSheetPr(xml, '<pageSetUpPr fitToPage="1"/>');
      xml = withPageSetup(
        xml,
        '<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>',
      );
    }
    zip.file(part, xml);
  }

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
}

/** Testlerde ve hata ayıklamada işe yarar: bir sayfanın öznitelik okuması. */
export const __internal = { attr };
