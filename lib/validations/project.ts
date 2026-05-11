import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Proje adı zorunludur').max(255),
  customerName: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
  code: z.string().min(1, 'Proje kodu zorunludur').max(50),
  departmentId: z.string().cuid('Geçersiz departman'),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  status: z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
