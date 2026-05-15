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
  valveType: z.enum(['SDE44', 'D44', 'D44SL', 'DA44']).nullable().optional(),
  valveControlUnit: z.enum(['NONE', 'AS_I', 'DC']).nullable().optional(),
  cipReturnValveType: z.enum(['SW_CIP41', 'SD41']).nullable().optional(),
  waterInletValveType: z.enum(['SW_CIP42', 'SD42']).nullable().optional(),
  tankCipInletValveType: z.enum(['SW43', 'SW44']).nullable().optional(),
  tankCipInletDiameter: z.string().max(50).nullable().optional(),
  tankCipReturnManifoldExists: z.boolean().optional(),
  tankCipReturnLineCount: z.number().int().min(1).max(2).optional(),
  tankCipReturnPumpModel: z.string().max(255).nullable().optional(),
  tankCipReturnPumpKw: z.number().positive().nullable().optional(),
  tankCipReturnPumpImpellerSize: z.number().positive().nullable().optional(),
  status: z
    .enum(['DRAFT', 'IN_PROGRESS', 'REVIEW', 'APPROVED', 'DOCUMENT_GENERATED', 'ARCHIVED', 'CANCELLED'])
    .optional(),
});

export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;
