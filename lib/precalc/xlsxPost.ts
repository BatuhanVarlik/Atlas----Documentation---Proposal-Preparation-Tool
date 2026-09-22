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

export interface ChartSeries {
  /** Seri adının okunacağı hücre ("CASHFLOW!$D$16"). */
  nameRef: string;
  valRef: string;
  /** Çizgi rengi, altı haneli RGB (ör. turuncu "ED7D31"). */
  colorRGB: string;
}

export interface LineChartSpec {
  sheet: string;
  title: string;
  /** Kategori (X) ekseninin aralığı. */
  catRef: string;
  series: ChartSeries[];
  /** Grafiğin oturacağı hücre dikdörtgeni (0 tabanlı). */
  anchor: { fromCol: number; fromRow: number; toCol: number; toRow: number };
}

const CHART_NS = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XDR_NS = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';

/** İki eksen kimliği; dosyada benzersiz olmaları yeterli. */
const CAT_AX = '811811811';
const VAL_AX = '822822822';

function chartXml(spec: LineChartSpec): string {
  const sers = spec.series.map((s, i) => `<c:ser>`
    + `<c:idx val="${i}"/><c:order val="${i}"/>`
    + `<c:tx><c:strRef><c:f>${s.nameRef}</c:f></c:strRef></c:tx>`
    + `<c:spPr><a:ln w="28575" cap="rnd">`
    + `<a:solidFill><a:srgbClr val="${s.colorRGB}"/></a:solidFill><a:round/></a:ln></c:spPr>`
    + `<c:marker><c:symbol val="none"/></c:marker>`
    + `<c:cat><c:numRef><c:f>${spec.catRef}</c:f></c:numRef></c:cat>`
    + `<c:val><c:numRef><c:f>${s.valRef}</c:f></c:numRef></c:val>`
    + `<c:smooth val="0"/>`
    + `</c:ser>`).join('');

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + `<c:chartSpace xmlns:c="${CHART_NS}" xmlns:a="${A_NS}" xmlns:r="${R_NS}">`
    + '<c:chart>'
    + `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r>`
    + `<a:t>${spec.title}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`
    + '<c:autoTitleDeleted val="0"/>'
    + '<c:plotArea><c:layout/>'
    + `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers}`
    + `<c:marker val="0"/><c:axId val="${CAT_AX}"/><c:axId val="${VAL_AX}"/></c:lineChart>`
    + `<c:catAx><c:axId val="${CAT_AX}"/><c:scaling><c:orientation val="minMax"/></c:scaling>`
    + `<c:delete val="0"/><c:axPos val="b"/><c:crossAx val="${VAL_AX}"/></c:catAx>`
    + `<c:valAx><c:axId val="${VAL_AX}"/><c:scaling><c:orientation val="minMax"/></c:scaling>`
    + '<c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/>'
    + '<c:numFmt formatCode="#,##0" sourceLinked="0"/>'
    + `<c:crossAx val="${CAT_AX}"/></c:valAx>`
    + '</c:plotArea>'
    + '<c:legend><c:legendPos val="r"/><c:overlay val="0"/></c:legend>'
    + '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>'
    + '</c:chart></c:chartSpace>';
}

function drawingXml(spec: LineChartSpec): string {
  const { fromCol, fromRow, toCol, toRow } = spec.anchor;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + `<xdr:wsDr xmlns:xdr="${XDR_NS}" xmlns:a="${A_NS}" xmlns:r="${R_NS}">`
    + '<xdr:twoCellAnchor>'
    + `<xdr:from><xdr:col>${fromCol}</xdr:col><xdr:colOff>0</xdr:colOff>`
    + `<xdr:row>${fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>`
    + `<xdr:to><xdr:col>${toCol}</xdr:col><xdr:colOff>0</xdr:colOff>`
    + `<xdr:row>${toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>`
    + '<xdr:graphicFrame macro="">'
    + '<xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Cashflow"/>'
    + '<xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>'
    + '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>'
    + `<a:graphic><a:graphicData uri="${CHART_NS}">`
    + `<c:chart xmlns:c="${CHART_NS}" xmlns:r="${R_NS}" r:id="rId1"/>`
    + '</a:graphicData></a:graphic>'
    + '</xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>';
}

/**
 * CASHFLOW sayfasına Excel'in kendi çizgi grafiğini ekler.
 *
 * Seriler hücre aralıklarına bağlanır — grafik gömülü bir resim değil, canlı
 * bir Excel nesnesidir: kullanıcı rakamı değiştirdiğinde çizgi de değişir,
 * biçimini kendi düzenleyebilir.
 *
 * Grafik parçaları SheetJS'in ürettiği pakette hiç yok; hepsi burada
 * oluşturulup ilişki ve içerik tipi kayıtlarıyla birlikte eklenir.
 */
export function injectLineChart(buffer: Buffer, spec: LineChartSpec): Buffer {
  const zip = new PizZip(buffer);

  const part = sheetPartName(zip, spec.sheet);
  if (!part) return buffer;                    // sayfa yoksa dosyaya dokunma

  zip.file('xl/charts/chart1.xml', chartXml(spec));
  zip.file('xl/drawings/drawing1.xml', drawingXml(spec));
  zip.file(
    'xl/drawings/_rels/drawing1.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + `<Relationship Id="rId1" Type="${R_NS}/chart" Target="../charts/chart1.xml"/>`
    + '</Relationships>',
  );

  // Sayfa → çizim ilişkisi. SheetJS bu sayfa için rels dosyası üretmediği
  // için ilk ilişki rId1 olur.
  const relPart = part.replace('xl/worksheets/', 'xl/worksheets/_rels/') + '.rels';
  zip.file(
    relPart,
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + `<Relationship Id="rId1" Type="${R_NS}/drawing" Target="../drawings/drawing1.xml"/>`
    + '</Relationships>',
  );

  // <drawing> şema sırasında en sonda durur.
  const sheetXml = zip.file(part)!.asText();
  zip.file(part, sheetXml.replace('</worksheet>', '<drawing r:id="rId1"/></worksheet>'));

  // İçerik tipleri
  const typesPath = '[Content_Types].xml';
  const types = zip.file(typesPath)!.asText();
  zip.file(typesPath, types.replace(
    '</Types>',
    '<Override PartName="/xl/charts/chart1.xml"'
    + ' ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>'
    + '<Override PartName="/xl/drawings/drawing1.xml"'
    + ' ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>'
    + '</Types>',
  ));

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
}
