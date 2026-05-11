export interface DiameterInput {
  capacityLh: number;
  velocity: number;
}

export interface DiameterResult {
  diameterMm: number;
  flowM3h: number;
  flowM3s: number;
}

// D = sqrt(4Q / πV)  where Q in m³/s, V in m/s → D in m → convert to mm
export function calculatePipeDiameter(input: DiameterInput): DiameterResult {
  const flowM3h = input.capacityLh / 1000;
  const flowM3s = flowM3h / 3600;
  const D_m = Math.sqrt((4 * flowM3s) / (Math.PI * input.velocity));
  return {
    diameterMm: D_m * 1000,
    flowM3h,
    flowM3s,
  };
}
