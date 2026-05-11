import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole, apiError, apiSuccess } from '@/lib/auth-middleware';
import { extractPlaceholders } from '@/lib/docx/renderTemplate';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function GET(_req: Request) {
  try {
    await requireAuth();
    const templates = await prisma.documentTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return apiSuccess(templates);
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole(['ADMIN']);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const name = (formData.get('name') as string | null)?.trim();
    const description = (formData.get('description') as string | null)?.trim() || null;

    if (!file || !name) return apiError('Dosya ve şablon adı gerekli');
    if (!file.name.endsWith('.docx')) return apiError('Yalnızca .docx dosyası yüklenebilir');

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filename = `template_${Date.now()}_${file.name.replace(/\s/g, '_')}`;
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'templates');
    const filepath = path.join(uploadsDir, filename);
    await writeFile(filepath, buffer);

    const placeholders = extractPlaceholders(buffer);

    const template = await prisma.documentTemplate.create({
      data: {
        name,
        description,
        filename,
        filepath: `/uploads/templates/${filename}`,
        placeholders,
      },
    });

    return apiSuccess(template, 'Şablon yüklendi', 201);
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
