import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';
import { buildMilkReceptionContext } from '@/lib/docx/buildMilkReceptionContext';
import { renderTemplate } from '@/lib/docx/renderTemplate';
import { writeFile } from 'fs/promises';
import path from 'path';

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({ templateId: z.string().cuid() });

export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id: moduleId } = await params;
    const body: unknown = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return apiError('Geçersiz veri', 400, parsed.error.flatten());

    const [module, template] = await Promise.all([
      prisma.milkReceptionModule.findUnique({
        where: { id: moduleId },
        include: {
          creator: { select: { name: true } },
          receptionLines: { orderBy: { order: 'asc' } },
        },
      }),
      prisma.documentTemplate.findUnique({ where: { id: parsed.data.templateId } }),
    ]);

    if (!module) return apiError('Modül bulunamadı', 404);
    if (!template || !template.isActive) return apiError('Şablon bulunamadı veya aktif değil', 404);
    if (user.role === 'MEMBER' && module.creatorId !== user.id) return apiError('Forbidden', 403);

    const templatePath = path.join(process.cwd(), 'public', template.filepath);
    const context = buildMilkReceptionContext(module);
    const docBuffer = renderTemplate(templatePath, context);

    const safeModuleName = module.name.replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ\s-]/g, '').trim().replace(/\s+/g, '_');
    const filename = `${safeModuleName}_${Date.now()}.docx`;
    const outDir = path.join(process.cwd(), 'public', 'uploads', 'generated');
    await writeFile(path.join(outDir, filename), docBuffer);

    const docRecord = await prisma.milkReceptionGeneratedDocument.create({
      data: {
        moduleId,
        templateId: template.id,
        filename,
        filepath: `/uploads/generated/${filename}`,
        size: docBuffer.length,
        generatedById: user.id,
      },
    });

    if (module.status === 'APPROVED') {
      await prisma.milkReceptionModule.update({
        where: { id: moduleId },
        data: { status: 'DOCUMENT_GENERATED' },
      });
    }

    return apiSuccess(
      { ...docRecord, downloadUrl: `/uploads/generated/${filename}` },
      'Belge oluşturuldu',
    );
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    console.error('generate-doc (milk-reception) error:', e);
    return apiError('Belge oluşturulamadı', 500);
  }
}
