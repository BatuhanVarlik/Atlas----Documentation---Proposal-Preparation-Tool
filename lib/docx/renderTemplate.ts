import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import fs from 'fs';

export function renderTemplate(templatePath: string, context: unknown): Buffer {
  const content = fs.readFileSync(templatePath);
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  doc.render(context as Record<string, unknown>);
  return doc.getZip().generate({ type: 'nodebuffer' }) as Buffer;
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
