import { z } from 'zod';
import { requireAuth, apiError, apiSuccess } from '@/lib/auth-middleware';
import { sizePumps, impellerDetails, type PumpResult } from '@/lib/pumps/sizing';

const schema = z.object({
  q: z.number().positive().max(100_000),
  bar: z.number().positive().max(100),
});

// PumpResult'tan eğri verilerini atıp UI için hafif DTO üretir.
// q/bar verilince her pompa için impeller detayları da eklenir.
function toDto(r: PumpResult, q: number, bar: number) {
  return {
    name: r.pump.name,
    ok: r.ok,
    reason: r.reason ?? null,
    minP: r.minP ?? null,
    maxP: r.maxP ?? null,
    d: r.d ?? null,
    p: r.p ?? null,
    signed: r.signed ?? null,
    kw: r.kw ?? null,
    npshText: r.npshText ?? null,
    calcD: r.calcD ?? null,
    safeD: r.safeD ?? null,
    nearestD: r.nearestD ?? null,
    mode: r.mode ?? null,
    lowPressure: r.lowPressure ?? false,
    recommendedD: r.d ?? null,            // önerilen (yuvarlanmış) impeller çapı
    impellers: impellerDetails(r.pump, q, bar),
  };
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    const body: unknown = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError('Geçersiz veri (Q ve basınç pozitif olmalı)', 400, parsed.error.flatten());

    const { q, bar } = parsed.data;
    const { results, rank, best } = sizePumps(q, bar);

    return apiSuccess({
      best: best ? toDto(best, q, bar) : null,
      rank: rank.map((r) => toDto(r, q, bar)),
      results: results.map((r) => toDto(r, q, bar)),
    });
  } catch (e: unknown) {
    if (e instanceof Error && 'status' in e) return apiError(e.message, (e as { status: number }).status);
    return apiError('Sunucu hatası', 500);
  }
}
