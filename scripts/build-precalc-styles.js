/**
 * PRECALCULATION şablonundaki hücre YAZI biçimini (renk / kalın / italik)
 * workbook.json'a `fontStyles` olarak ekler.
 *
 * SheetJS topluluk sürümü yazı tipi biçimini okumadığı için kaynak .xlsm
 * doğrudan açılır: xl/styles.xml (fonts + cellXfs), xl/theme/theme1.xml
 * (tema renkleri) ve her sayfanın XML'indeki `s` (stil) özniteliği çözülür.
 *
 * Yalnızca varsayılandan farklı hücreler yazılır: siyah/otomatik renkli,
 * kalın ya da italik olmayan hücreler kayda girmez — UI onlarda kendi
 * varsayılan yazı rengini kullanır. Dolgu (arka plan) rengi bilerek alınmaz;
 * UI'nın formül (mor) / elle girildi (sarı) zeminleri anlam taşır.
 *
 * Kullanım:
 *   node scripts/build-precalc-styles.js ["kaynak.xlsm"] ["workbook.json"]
 * build-precalc.js her çalıştığında sonda bunu da çağırır.
 */

const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

/** Excel'in eski 64 renklik indeks paleti (indexed="n"). 64/65 = sistem/otomatik. */
const INDEXED = [
  '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
  '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
  '800000', '008000', '000080', '808000', '800080', '008080', 'C0C0C0', '808080',
  '9999FF', '993366', 'FFFFCC', 'CCFFFF', '660066', 'FF8080', '0066CC', 'CCCCFF',
  '000080', 'FF00FF', 'FFFF00', '00FFFF', '800080', '800000', '008080', '0000FF',
  '00CCFF', 'CCFFFF', 'CCFFCC', 'FFFF99', '99CCFF', 'FF99CC', 'CC99FF', 'FFCC99',
  '3366FF', '33CCCC', '99CC00', 'FFCC00', 'FF9900', 'FF6600', '666699', '969696',
  '003366', '339966', '003300', '333300', '993300', '993366', '333399', '333333',
];

/** Tema renk sırası: <color theme="n"> bu sırayla indekslenir (lt1/dk1 yer değiştirmiş). */
const THEME_ORDER = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3',
  'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];

function readThemeColors(themeXml) {
  return THEME_ORDER.map((name) => {
    const start = themeXml.indexOf('<a:' + name + '>');
    if (start < 0) return '000000';
    const block = themeXml.slice(start, themeXml.indexOf('</a:' + name + '>', start));
    const m = block.match(/(?:srgbClr val|lastClr)="([0-9A-Fa-f]{6})"/);
    return m ? m[1].toUpperCase() : '000000';
  });
}

/** Excel tint'i: HSL parlaklığını -1..1 oranında koyulaştırır/açar. */
function applyTint(hex, tint) {
  if (!tint) return hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  l = tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint;
  const hue = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let R, G, B;
  if (s === 0) { R = G = B = l; } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    R = hue(p, q, h + 1 / 3); G = hue(p, q, h); B = hue(p, q, h - 1 / 3);
  }
  return [R, G, B].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function attr(tag, name) {
  const m = tag.match(new RegExp('\\b' + name + '="([^"]*)"'));
  return m ? m[1] : null;
}

/** <color .../> etiketini 6 haneli hex'e çevirir; otomatik/sistem rengi null. */
function resolveColor(tag, themeColors) {
  if (!tag || attr(tag, 'auto')) return null;
  let hex = null;
  if (attr(tag, 'rgb')) hex = attr(tag, 'rgb').slice(-6).toUpperCase();
  else if (attr(tag, 'theme') !== null) hex = themeColors[Number(attr(tag, 'theme'))] ?? null;
  else if (attr(tag, 'indexed') !== null) hex = INDEXED[Number(attr(tag, 'indexed'))] ?? null;
  return hex ? applyTint(hex, Number(attr(tag, 'tint') || 0)) : null;
}

function section(xml, name) {
  const m = xml.match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)</' + name + '>'));
  return m ? m[1] : '';
}

/** 0 (siyah) – 1 (beyaz) arası algılanan parlaklık. */
function luminance(hex) {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * UI'ya taşınacak renk mi. Siyaha çok yakın renkler varsayılan sayılır.
 * Çok açık renkler (ör. DDD9C3 zemin üstünde DDD9C3 yazı) Excel'de yazıyı
 * zemine gömüp gizlemek için kullanılmış; UI'nın beyaz zemininde okunmaz
 * hale gelirdi — bunlar da alınmaz.
 */
function keepColor(hex) {
  if (!hex) return false;
  const lum = luminance(hex);
  return lum > 0.06 && lum < 0.75;
}

/** cellXfs indeksi → { c?, b?, i? } (varsayılansa null). */
function readCellFonts(stylesXml, themeColors) {
  const fonts = (section(stylesXml, 'fonts').match(/<font>[\s\S]*?<\/font>|<font\/>/g) || []).map((f) => {
    const color = resolveColor((f.match(/<color [^>]*\/>/) || [])[0], themeColors);
    return {
      c: keepColor(color) ? color : undefined,
      b: /<b\/>|<b val="(1|true)"\/>/.test(f) ? 1 : undefined,
      i: /<i\/>|<i val="(1|true)"\/>/.test(f) ? 1 : undefined,
    };
  });
  return (section(stylesXml, 'cellXfs').match(/<xf [^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g) || []).map((xf) => {
    const font = fonts[Number(attr(xf, 'fontId') || 0)] || {};
    return font.c || font.b || font.i ? font : null;
  });
}

/** Sayfa adı → zip içindeki XML yolu. */
function sheetFiles(zip) {
  const wb = zip.file('xl/workbook.xml').asText();
  const rels = zip.file('xl/_rels/workbook.xml.rels').asText();
  const out = {};
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = attr(m[0], 'name');
    const rid = attr(m[0], 'r:id');
    const rel = (rels.match(/<Relationship\b[^>]*>/g) || []).find((r) => attr(r, 'Id') === rid);
    if (!name || !rel) continue;
    const target = attr(rel, 'Target').replace(/^\/?xl\//, '');
    out[name.replace(/&amp;/g, '&')] = 'xl/' + target;
  }
  return out;
}

function extractFontStyles(sourcePath) {
  const zip = new PizZip(fs.readFileSync(sourcePath));
  const themeColors = readThemeColors(zip.file('xl/theme/theme1.xml')?.asText() ?? '');
  const xfFonts = readCellFonts(zip.file('xl/styles.xml').asText(), themeColors);

  const palette = [];
  const paletteIndex = new Map();
  const cells = {};
  for (const [name, file] of Object.entries(sheetFiles(zip))) {
    const xml = zip.file(file)?.asText();
    if (!xml) continue;
    const map = {};
    for (const m of xml.matchAll(/<c r="([A-Z]+\d+)"([^>]*?)\/?>/g)) {
      const s = attr(m[2], 's');
      const font = s === null ? null : xfFonts[Number(s)];
      if (!font) continue;
      const key = JSON.stringify(font);
      let idx = paletteIndex.get(key);
      if (idx === undefined) { idx = palette.length; palette.push(font); paletteIndex.set(key, idx); }
      map[m[1]] = idx;
    }
    if (Object.keys(map).length > 0) cells[name] = map;
  }
  return { palette, cells };
}

function run(sourcePath, workbookPath) {
  const fontStyles = extractFontStyles(sourcePath);
  const workbook = JSON.parse(fs.readFileSync(workbookPath, 'utf8'));
  workbook.fontStyles = fontStyles;
  fs.writeFileSync(workbookPath, JSON.stringify(workbook));
  const total = Object.values(fontStyles.cells).reduce((s, m) => s + Object.keys(m).length, 0);
  console.log('  ' + path.basename(workbookPath) + ': ' + total + ' biçimli hücre, '
    + fontStyles.palette.length + ' yazı stili (fontStyles)');
}

module.exports = { extractFontStyles, applyTint, run };

if (require.main === module) {
  run(
    process.argv[2] || 'data/templates/ORNEK PRECALCULATION 36.10.xlsm',
    process.argv[3] || 'lib/precalc/workbook.json',
  );
}
