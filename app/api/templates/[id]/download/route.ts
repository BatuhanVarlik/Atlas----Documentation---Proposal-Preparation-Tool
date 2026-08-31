import { readFile } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { requireAuth, apiError } from '@/lib/auth-middleware';
import { resolveDataPath } from '@/lib/storage';

type Params = { params: Promise<{ id: string }> };

// Şablon .docx dosyasını diskten okuyup indirir.
// (UI'dan yüklenen şablonlar build sonrası public/ altına yazıldığından
//  statik link yerine bu route üzerinden servis edilir.)
export async function GET(_req: Request, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const template = await prisma.documentTemplate.findUnique({ where: { id } });
    if (!template) return apiError('Şablon bulunamadı', 404);

    const abs = resolveDataPath(template.filepath);
    let data: Buffer;
    try {
      data = await readFile(abs);
    } catch {
      return apiError('Dosya diskte bulunamadı', 404);
    }

    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(template.filename)}`,
        'Content-Length': String(data.length),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
