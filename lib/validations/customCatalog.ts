import { z } from 'zod';

export const createCustomCatalogSchema = z.object({
  kind: z.enum(['MILK_CLARIFIER', 'PHE', 'PUMP', 'AGITATOR', 'OTHER']),
  name: z.string().min(1, 'Ürün adı zorunludur').max(300),
  standard: z.enum(['', 'DIN', 'SMS']).default(''),
  size: z.string().max(60).nullable().optional(),
  listPrice: z.number().positive().max(100_000_000),
  discount: z.number().min(0).max(0.99).default(0),
});

export type CreateCustomCatalogInput = z.infer<typeof createCustomCatalogSchema>;
