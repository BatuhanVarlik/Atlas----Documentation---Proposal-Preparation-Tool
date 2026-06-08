import { z } from 'zod';

export const createMilkReceptionModuleSchema = z.object({
  name: z.string().min(1, 'Modül adı zorunludur').max(255),
  customerName: z.string().max(255).optional(),
  projectCode: z.string().max(100).optional(),
  standard: z.enum(['DIN', 'SMS']),
});

export const updateMilkReceptionModuleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  customerName: z.string().max(255).nullable().optional(),
  projectCode: z.string().max(100).nullable().optional(),
  standard: z.enum(['DIN', 'SMS']).optional(),
  valveControlUnit: z.enum(['NONE', 'AS_I', 'DC']).optional(),
  status: z
    .enum(['DRAFT', 'IN_PROGRESS', 'REVIEW', 'APPROVED', 'DOCUMENT_GENERATED', 'ARCHIVED', 'CANCELLED'])
    .optional(),

  // Tanker CIP
  hasTankerCip: z.boolean().optional(),
  tankerCipCapacity: z.number().positive().nullable().optional(),
  tankerCipPressure: z.number().positive().nullable().optional(),
  tankerCipPumpModel: z.string().max(255).nullable().optional(),
  tankerCipPumpKw: z.number().positive().nullable().optional(),
  tankerCipPumpImpellerSize: z.number().positive().nullable().optional(),

  // Teklif (commercial) bilgileri — HEM-PROJECT-NO şablonu için
  quotationNo: z.string().max(50).nullable().optional(),
  customerContactPerson: z.string().max(255).nullable().optional(),
  deliveryWeeks: z.number().int().min(0).max(520).nullable().optional(),
  deliveryPlace: z.string().max(255).nullable().optional(),
  offerValidityDays: z.number().int().min(0).max(3650).nullable().optional(),
});

export const setLineCountSchema = z.object({
  count: z.number().int().min(1).max(20),
  names: z.array(z.string().min(1).max(255)).optional(),
});

export const upsertLineSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  capacity: z.number().positive().nullable().optional(),
  pressure: z.number().positive().nullable().optional(),

  pumpModel: z.string().max(255).nullable().optional(),
  pumpKw: z.number().positive().nullable().optional(),
  pumpImpellerSize: z.number().positive().nullable().optional(),

  filterUnitCount: z.number().int().min(1).max(2).optional(),
  pressureMeterType: z.enum(['MANOMETER', 'PRESSURE_TRANSMITTER']).optional(),

  hasMilkClarifier: z.boolean().optional(),
  clarifierBypassValveType: z.enum(['SW44', 'SW41']).nullable().optional(),

  hasPhe: z.boolean().optional(),
  pheCapacity: z.number().positive().nullable().optional(),
  pheIceWaterTempSensorType: z.enum(['PT100', 'THERMOMETER']).nullable().optional(),
  pheIceWaterPressureMeterType: z.enum(['MANOMETER', 'PRESSURE_TRANSMITTER']).nullable().optional(),

  hasSamplingValve: z.boolean().optional(),
  samplingValveType: z.enum(['MANUAL', 'WITH_ACTUATOR']).nullable().optional(),
});

export type CreateMilkReceptionModuleInput = z.infer<typeof createMilkReceptionModuleSchema>;
export type UpdateMilkReceptionModuleInput = z.infer<typeof updateMilkReceptionModuleSchema>;
export type UpsertLineInput = z.infer<typeof upsertLineSchema>;
