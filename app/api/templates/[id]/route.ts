import { prisma } from '@/lib/prisma';
import { requireRole, apiError, apiSuccess } from '@/lib/auth-middleware';
import { unlink } from 'fs/promises';
import path from 'path';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    await requireRole(['ADMIN']);
    const { id } = await params;
    const body = await req.json() as { isActive?: boolean };
    const template = await prisma.documentTemplate.update({
      where: { id },
      data: { isActive: body.isActive },
    });
    return apiSuccess(template);
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requireRole(['ADMIN']);
    const { id } = await params;

    const template = await prisma.documentTemplate.findUnique({ where: { id } });
    if (!template) return apiError('Şablon bulunamadı', 404);

    // Dosyayı diskten sil
    try {
      await unlink(path.join(process.cwd(), 'public', template.filepath));
    } catch {
      // Dosya zaten yoksa devam et
    }

    await prisma.documentTemplate.delete({ where: { id } });
    return apiSuccess(null, 'Şablon silindi');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
