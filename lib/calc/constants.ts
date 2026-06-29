export const VELOCITY = {
  FILLING: 2.0,
  DISCHARGE: 1.5,
  FLOW_METER: 2.75,
  FLOW_METER_MIN: 2.5,
  FLOW_METER_MAX: 3.0,
} as const;

export const LEAKAGE_CHAMBER_MM = 25;

// CIP modülü hat hızları (m/s) — kapasite m³/h cinsindendir.
export const CIP_VELOCITY = {
  DISCHARGE: 1.5,
  RETURN: 2.0,
} as const;
