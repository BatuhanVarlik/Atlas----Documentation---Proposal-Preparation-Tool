// Pompa modellerine göre çark (impeller) seçenekleri.
// PUMPS_WITHOUT_IMPELLER listesindeki pompalarda çark seçimi yapılmaz.

export const PUMP_IMPELLERS_BY_MODEL: Record<string, readonly number[]> = {
  'W+10/8':      [90, 95, 100, 105, 110],
  'W+22/20':     [95, 100, 105, 110, 115, 120, 125, 130, 135, 142],
  'W+25/210':    [210, 220, 230, 240, 250, 260, 270, 280, 290],
  'W+30/80':     [110, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170],
  'W+30/120':    [135, 140, 145, 150, 155, 160, 165, 170, 175],
  'W+35/35':     [125, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175],
  'W+35/55':     [120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180],
  'W+50/8':      [140, 145, 150, 155, 160, 165, 170, 175, 180, 185, 190, 195, 200],
  'W+50/600':    [280, 290, 300, 310, 320, 330, 340, 350, 360, 370, 380, 390, 400, 410, 420],
  'W+55/35':     [160, 165, 170, 175, 180, 185, 190, 195, 200, 205, 210],
  'W+55/60':     [160, 165, 170, 175, 180, 185, 190, 195, 200, 205, 210, 215, 220],
  'W+60/110':    [160, 165, 170, 175, 180, 185, 190, 195, 200, 205, 210, 215, 220, 225, 230],
  'W+65/350':    [190, 195, 200, 205, 210, 215, 220, 225, 230, 235, 240, 245, 250, 255, 260],
  'W+70/40':     [190, 195, 200, 205, 210, 215, 220, 225, 230, 235, 240],
  'W+80/80':     [195, 200, 205, 210, 215, 220, 225, 230, 235, 240, 245, 250, 255],
  'W+110/130':   [210, 215, 220, 225, 230, 235, 240, 245, 250, 255, 260, 265, 270, 275, 280, 285, 290],
  'W+140/50/2':  [160, 180, 200],
  'W+140/50/3':  [160, 180, 200],
};

export const PUMPS_WITHOUT_IMPELLER: readonly string[] = [
  'DW1/004/15',
  'DW1/007/7',
  'DW1/007/15_600',
  'DW2/007/20',
  'DW2/013/10',
  'DW2/013/15_600',
  'DW3/017/20',
  'DW3/030/10',
  'DW3/030/15_600',
  'DW3/050/5',
  'DW4/039/20',
  'DW4/073/10',
  'DW4/073/15_600',
  'DW4/125/5',
  'DW4/125/7_600',
  'DW5/093/25',
  'DW5/142/15',
  'DW5/256/7',
  'DW6/198/30',
  'DW6/308/15',
  'DW6/519/7',
  'DW7/420/30',
  'DW7/725/15',
  'DW7/1016/7',
];

export const PUMP_MODELS: readonly string[] = [
  ...Object.keys(PUMP_IMPELLERS_BY_MODEL),
  ...PUMPS_WITHOUT_IMPELLER,
];

// Tüm çarklar — geriye dönük uyumluluk + bilinmeyen pompalar için yedek.
export const PUMP_IMPELLER_SIZES = Array.from(
  new Set(Object.values(PUMP_IMPELLERS_BY_MODEL).flat())
).sort((a, b) => a - b);

export function pumpHasImpeller(model: string): boolean {
  if (!model.trim()) return true;
  return !PUMPS_WITHOUT_IMPELLER.includes(model.trim());
}

export function getImpellersForPump(model: string): readonly number[] {
  const key = model.trim();
  if (!key) return [];
  if (PUMP_IMPELLERS_BY_MODEL[key]) return PUMP_IMPELLERS_BY_MODEL[key];
  if (PUMPS_WITHOUT_IMPELLER.includes(key)) return [];
  return []; // bilinmeyen pompa — kullanıcı serbest yazabilir
}
