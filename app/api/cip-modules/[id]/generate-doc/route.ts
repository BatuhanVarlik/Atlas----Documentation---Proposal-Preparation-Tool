import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';
import { buildCipContext } from '@/lib/docx/buildCipContext';
import { renderTemplateWithMedia } from '@/lib/docx/renderTemplate';
import { renderCipDiagram, DIAGRAM_REL_ID, DIAGRAM_FILENAME } from '@/lib/docx/diagram';
import { getCustomPricingItems } from '@/lib/pricing/customCatalogServer';
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
      prisma.cipModule.findUnique({
        where: { id: moduleId },
        include: {
          creator: { select: { name: true } },
          tanks: { orderBy: { order: 'asc' } },
          lines: { orderBy: [{ lineKind: 'asc' }, { order: 'asc' }] },
        },
      }),
      prisma.documentTemplate.findUnique({ where: { id: parsed.data.templateId } }),
    ]);

    if (!module) return apiError('Modül bulunamadı', 404);
    if (!template || !template.isActive) return apiError('Şablon bulunamadı veya aktif değil', 404);
    if (user.role === 'MEMBER' && module.creatorId !== user.id) return apiError('Forbidden', 403);

    const templatePath = path.join(process.cwd(), 'public', template.filepath);
    const customItems = await getCustomPricingItems();
    const baseContext = buildCipContext(module, customItems);
    // Diyagramı yalnızca şablon {hasDiagram}/{@diagramXml} referansı veriyorsa üret/göm.
    const usesDiagram =
      Array.isArray(template.placeholders) &&
      (template.placeholders as string[]).some((p) => typeof p === 'string' && p.includes('hasDiagram'));
    const diagram = usesDiagram ? await renderCipDiagram(module) : null;
    const context = { ...baseContext, hasDiagram: !!diagram, diagramXml: diagram?.drawingXml ?? '' };
    const media = diagram ? [{ relId: DIAGRAM_REL_ID, filename: DIAGRAM_FILENAME, data: diagram.png }] : [];
    const docBuffer = renderTemplateWithMedia(templatePath, context, media);

    const safeModuleName = module.name.replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ\s-]/g, '').trim().replace(/\s+/g, '_');
    const filename = `${safeModuleName}_${Date.now()}.docx`;
    const outDir = path.join(process.cwd(), 'public', 'uploads', 'generated');
    await writeFile(path.join(outDir, filename), docBuffer);

    const docRecord = await prisma.cipGeneratedDocument.create({
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
      await prisma.cipModule.update({ where: { id: moduleId }, data: { status: 'DOCUMENT_GENERATED' } });
    }

    return apiSuccess(
      { ...docRecord, downloadUrl: `/api/cip-modules/${moduleId}/documents/${docRecord.id}` },
      'Belge oluşturuldu',
    );
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    console.error('generate-doc (cip) error:', e);
    return apiError('Belge oluşturulamadı', 500);
  }
}
