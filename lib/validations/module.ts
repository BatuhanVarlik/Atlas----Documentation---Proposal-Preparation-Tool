import { z } from 'zod';

export const createModuleSchema = z.object({
  name: z.string().min(1, 'Modül adı zorunludur').max(255),
  customerName: z.string().max(255).optional(),
  projectCode: z.string().max(100).optional(),
  standard: z.enum(['DIN', 'SMS']),
  productType: z.enum(['HYGIENIC', 'ULTRA_HYGIENIC']),
});

export const updateModuleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  customerName: z.string().max(255).nullable().optional(),
  projectCode: z.string().max(100).nullable().optional(),
  standard: z.enum(['DIN', 'SMS']).optional(),
  productType: z.enum(['HYGIENIC', 'ULTRA_HYGIENIC']).optional(),
  status: z
    .enum(['DRAFT', 'IN_PROGRESS', 'REVIEW', 'APPROVED', 'DOCUMENT_GENERATED', 'ARCHIVED', 'CANCELLED'])
    .optional(),
});

export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;
