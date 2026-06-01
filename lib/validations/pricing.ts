import { z } from 'zod';

/**
 * Önizleme ekranındaki Fiyatlandırma kartı için manuel düzenleme yükü.
 * - multiplier: genel toplam çarpanı (Total = Σ(birim×adet) × multiplier)
 * - overrides:  satır anahtarı → manuel birim net fiyat (EUR)
 */
export const updatePricingSchema = z.object({
  multiplier: z.number().positive().max(1000),
  overrides: z.record(z.string(), z.number().min(0).max(100_000_000)),
});

export type UpdatePricingInput = z.infer<typeof updatePricingSchema>;
