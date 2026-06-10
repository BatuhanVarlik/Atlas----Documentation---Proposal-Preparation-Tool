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

    // Bu şablonla üretilmiş belgeler FK ile bağlı → önce onları sil, yoksa
    // documentTemplate.delete kısıtlamaya takılıp "silinmiyor" hatası verir.
    const [storageDocs, milkDocs] = await Promise.all([
      prisma.generatedDocument.findMany({ where: { templateId: id }, select: { filepath: true } }),
      prisma.milkReceptionGeneratedDocument.findMany({ where: { templateId: id }, select: { filepath: true } }),
    ]);

    await prisma.$transaction([
      prisma.generatedDocument.deleteMany({ where: { templateId: id } }),
      prisma.milkReceptionGeneratedDocument.deleteMany({ where: { templateId: id } }),
      prisma.documentTemplate.delete({ where: { id } }),
    ]);

    // Diskten dosyaları sil (şablon + üretilmiş belgeler) — best-effort
    const files = [template.filepath, ...storageDocs.map((d) => d.filepath), ...milkDocs.map((d) => d.filepath)];
    await Promise.all(files.map((fp) => unlink(path.join(process.cwd(), 'public', fp)).catch(() => {})));

    return apiSuccess(null, 'Şablon silindi');
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
