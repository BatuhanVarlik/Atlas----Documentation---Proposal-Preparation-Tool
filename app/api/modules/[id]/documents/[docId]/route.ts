import { readFile, unlink } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { requireAuth, apiError } from '@/lib/auth-middleware';

type Params = { params: Promise<{ id: string; docId: string }> };

// Üretilen .docx dosyasını diskten okuyup indirir.
// (Next.js `next start`, build sonrası public/ altına yazılan dosyaları
//  servis etmediği için statik link yerine bu route kullanılır.)
export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id, docId } = await params;

    const doc = await prisma.generatedDocument.findUnique({
      where: { id: docId },
      include: { module: { select: { creatorId: true } } },
    });
    if (!doc || doc.moduleId !== id) return apiError('Belge bulunamadı', 404);
    if (user.role === 'MEMBER' && doc.module.creatorId !== user.id) return apiError('Forbidden', 403);

    const abs = path.join(process.cwd(), 'public', doc.filepath);
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
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
        'Content-Length': String(data.length),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}

// Üretilen belgeyi siler: DB kaydı + diskteki dosya.
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id, docId } = await params;

    const doc = await prisma.generatedDocument.findUnique({
      where: { id: docId },
      include: { module: { select: { creatorId: true } } },
    });
    if (!doc || doc.moduleId !== id) return apiError('Belge bulunamadı', 404);
    if (user.role === 'MEMBER' && doc.module.creatorId !== user.id) return apiError('Forbidden', 403);

    await prisma.generatedDocument.delete({ where: { id: docId } });
    try {
      await unlink(path.join(process.cwd(), 'public', doc.filepath));
    } catch {
      // Dosya zaten yoksa sorun değil — DB kaydı silindi.
    }

    return Response.json({ success: true, message: 'Belge silindi' });
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
