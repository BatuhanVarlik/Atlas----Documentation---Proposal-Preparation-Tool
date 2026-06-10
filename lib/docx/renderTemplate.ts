import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import fs from 'fs';

// Nokta-notasyonlu (ör. {module.name}, {pricing.totalPrice}) placeholder'ları
// çözer. Bu docxtemplater sürümünün varsayılan parser'ı yalnızca düz anahtar
// çözdüğü için iç içe alanlar boş kalıyordu. Scope-walking (loop içinden
// kök alanlara erişim) docxtemplater tarafından yapılır.
export function dotNotationParser(tag: string) {
  return {
    get(scope: unknown): unknown {
      if (tag === '.') return scope;
      return tag
        .split('.')
        .reduce<unknown>((obj, key) => (obj == null ? undefined : (obj as Record<string, unknown>)[key]), scope);
    },
  };
}

export interface MediaImage {
  relId: string;
  filename: string; // word/media/<filename>
  data: Buffer;
}

const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
};

/** Gömülen görsel uzantıları için [Content_Types].xml içinde Default kaydı bulunmasını sağlar. */
function ensureContentTypes(zip: PizZip, media: MediaImage[]): void {
  const ctPath = '[Content_Types].xml';
  let ct = zip.file(ctPath)?.asText();
  if (!ct) return; // her .docx'te bulunur; yoksa şablon zaten geçersiz, dokunma
  for (const m of media) {
    const ext = m.filename.split('.').pop()?.toLowerCase();
    const mime = ext ? IMAGE_MIME[ext] : undefined;
    if (!ext || !mime) continue;
    if (new RegExp(`<Default[^>]*Extension="${ext}"`, 'i').test(ct)) continue;
    ct = ct.replace(/(<Types[^>]*>)/, `$1<Default Extension="${ext}" ContentType="${mime}"/>`);
  }
  zip.file(ctPath, ct);
}

/**
 * Şablonu doldurur ve isteğe bağlı olarak PNG görselleri belgeye gömer.
 * Görsel, şablonda `{@diagramXml}` gibi raw-xml ile yerleştirilen drawing'in
 * referans verdiği ilişki (relId) ve media dosyası olarak zip'e eklenir.
 */
export function renderTemplateWithMedia(
  templatePath: string,
  context: unknown,
  media: MediaImage[] = [],
): Buffer {
  const content = fs.readFileSync(templatePath);
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    parser: dotNotationParser,
    nullGetter: () => '',
  });
  doc.render(context as Record<string, unknown>);
  const outZip = doc.getZip();

  if (media.length > 0) {
    // 1) İlişki kayıtları — rels dosyası varsa içine ekle, yoksa sıfırdan oluştur
    //    (rels eksikken görsel yazılırsa drawing'in r:embed referansı askıda kalır → bozuk .docx).
    const relsPath = 'word/_rels/document.xml.rels';
    const additions = media
      .map(
        (m) =>
          `<Relationship Id="${m.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.filename}"/>`,
      )
      .join('');
    const existingRels = outZip.file(relsPath)?.asText();
    if (existingRels) {
      outZip.file(relsPath, existingRels.replace('</Relationships>', `${additions}</Relationships>`));
    } else {
      outZip.file(
        relsPath,
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          `${additions}</Relationships>`,
      );
    }

    // 2) [Content_Types].xml — gömülen her görsel uzantısı için Default kaydı garanti et.
    //    Şablon (örn. resimsiz, elle yüklenmiş .docx) png Default'unu içermiyorsa, content type'sız
    //    bir media part eklemek OPC paketini geçersiz kılar → Word "onarılamaz içerik" der.
    ensureContentTypes(outZip, media);

    // 3) Görsel verilerini yaz
    for (const m of media) {
      outZip.file(`word/media/${m.filename}`, m.data);
    }

    // 4) Gömülen drawing a:/pic: prefix'lerini kullanır. Kök <w:document> bunları (özellikle
    //    UI'dan yüklenen şablonlarda) tanımlamayabilir → "prefix is non-null and namespace is
    //    null" → Word açamaz. Kökte garanti et.
    ensureDrawingNamespaces(outZip);
  }

  return outZip.generate({ type: 'nodebuffer' }) as Buffer;
}

/** word/document.xml kök öğesine eksikse xmlns:a ve xmlns:pic ekler (çizim gömme için gerekli). */
function ensureDrawingNamespaces(zip: PizZip): void {
  const path = 'word/document.xml';
  const xml = zip.file(path)?.asText();
  if (!xml) return;
  const fixed = xml.replace(/<w:document\b([^>]*)>/, (_m, attrs: string) => {
    let add = '';
    if (!/\sxmlns:a=/.test(attrs)) add += ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
    if (!/\sxmlns:pic=/.test(attrs)) add += ' xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
    return `<w:document${attrs}${add}>`;
  });
  if (fixed !== xml) zip.file(path, fixed);
}

export function renderTemplate(templatePath: string, context: unknown): Buffer {
  return renderTemplateWithMedia(templatePath, context, []);
}

export function extractPlaceholders(docxBuffer: Buffer): string[] {
  const zip = new PizZip(docxBuffer);
  const found = new Set<string>();
  for (const filename of Object.keys(zip.files)) {
    if (!filename.endsWith('.xml')) continue;
    const text = zip.files[filename].asText();
    const matches = text.match(/\{[#/]?[\w.[\]]+\}/g) ?? [];
    for (const m of matches) found.add(m);
  }
  return Array.from(found).sort();
}
