import { z } from 'zod';

export const createCipModuleSchema = z.object({
  name: z.string().min(1, 'Modül adı zorunludur').max(255),
  customerName: z.string().max(255).optional(),
  projectCode: z.string().max(100).optional(),
  standard: z.enum(['DIN', 'SMS']),
  systemType: z.enum(['FORWARD', 'CIRCULATED']),
});

export const updateCipModuleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  customerName: z.string().max(255).nullable().optional(),
  projectCode: z.string().max(100).nullable().optional(),
  standard: z.enum(['DIN', 'SMS']).optional(),
  systemType: z.enum(['FORWARD', 'CIRCULATED']).optional(),
  valveControlUnit: z.enum(['NONE', 'AS_I', 'DC']).optional(),
  status: z
    .enum(['DRAFT', 'IN_PROGRESS', 'REVIEW', 'APPROVED', 'DOCUMENT_GENERATED', 'ARCHIVED', 'CANCELLED'])
    .optional(),

  // Tank-ortak seçimler
  samplingValve: z.enum(['NONE', 'MANUAL', 'WITH_ACTUATOR']).optional(),
  hasManholeSwitch: z.boolean().optional(),

  // Teklif (commercial) bilgileri — HEM-PROJECT-NO şablonu için
  quotationNo: z.string().max(50).nullable().optional(),
  customerContactPerson: z.string().max(255).nullable().optional(),
  deliveryWeeks: z.number().int().min(0).max(520).nullable().optional(),
  deliveryPlace: z.string().max(255).nullable().optional(),
  offerValidityDays: z.number().int().min(0).max(3650).nullable().optional(),
});

// Tank tipini aç/kapa + alanlarını güncelle.
// present=false → ilgili tank tipi varsa silinir.
export const upsertCipTankSchema = z.object({
  tankType: z.enum(['CAUSTIC', 'ACID', 'HOT_WATER', 'RECOVERY', 'FRESH_WATER']),
  present: z.boolean(),
  capacity: z.number().min(0).max(1_000_000).nullable().optional(),
  material: z.enum(['AISI_304', 'AISI_316']).optional(),
  insulation: z.enum(['INSULATED', 'UNINSULATED']).optional(),
  hasLSH: z.boolean().optional(),
  hasLSL: z.boolean().optional(),
  hasExternalSensor: z.boolean().optional(),
  hasPressureTransmitter: z.boolean().optional(),
});

// Yeni hat EKLEME — kind başına (DISCHARGE veya RETURN).
// addCount kadar yeni hat sona eklenir; verilen ortak detay yalnızca YENİ hatlara uygulanır.
// Mevcut hatlar değiştirilmez.
export const addCipLinesSchema = z.object({
  lineKind: z.enum(['DISCHARGE', 'RETURN']),
  addCount: z.number().int().min(1).max(20),

  // Yalnızca yeni eklenen hatlara uygulanacak detay (opsiyonel)
  capacity: z.number().min(0).max(1_000_000).nullable().optional(), // L/h
  pressure: z.number().min(0).max(100).nullable().optional(),       // bar
  pumpModel: z.string().max(255).nullable().optional(),
  pumpKw: z.number().positive().nullable().optional(),
  pumpImpellerSize: z.number().positive().nullable().optional(),
});

export const upsertCipLineSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  capacity: z.number().min(0).max(1_000_000).nullable().optional(), // L/h
  pressure: z.number().min(0).max(100).nullable().optional(),       // bar

  pumpModel: z.string().max(255).nullable().optional(),
  pumpKw: z.number().positive().nullable().optional(),
  pumpImpellerSize: z.number().positive().nullable().optional(),
});

export type CreateCipModuleInput = z.infer<typeof createCipModuleSchema>;
export type UpdateCipModuleInput = z.infer<typeof updateCipModuleSchema>;
export type UpsertCipTankInput = z.infer<typeof upsertCipTankSchema>;
export type UpsertCipLineInput = z.infer<typeof upsertCipLineSchema>;
