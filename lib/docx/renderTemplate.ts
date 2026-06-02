import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import fs from 'fs';

// Nokta-notasyonlu (ör. {module.name}, {pricing.totalPrice}) placeholder'ları
// çözer. Bu docxtemplater sürümünün varsayılan parser'ı yalnızca düz anahtar
// çözdüğü için iç içe alanlar boş kalıyordu. Scope-walking (loop içinden
// kök alanlara erişim) docxtemplater tarafından yapılır.
function dotNotationParser(tag: string) {
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
    const relsPath = 'word/_rels/document.xml.rels';
    const rels = outZip.file(relsPath)?.asText();
    if (rels) {
      const additions = media
        .map(
          (m) =>
            `<Relationship Id="${m.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.filename}"/>`,
        )
        .join('');
      outZip.file(relsPath, rels.replace('</Relationships>', `${additions}</Relationships>`));
    }
    for (const m of media) {
      outZip.file(`word/media/${m.filename}`, m.data);
    }
  }

  return outZip.generate({ type: 'nodebuffer' }) as Buffer;
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
