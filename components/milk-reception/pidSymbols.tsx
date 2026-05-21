// APV P&ID sembol kütüphanesi — Süt Alım modülü diyagramında kullanılır.
// Tüm semboller (cx, cy) merkez koordinatlarını alır. Sabit boyutlu çizimler.

export const PID_COLORS = {
  process: '#ea580c',    // turuncu (süt/ürün hattı)
  cip: '#0ea5e9',        // mavi (CIP/water)
  air: '#16a34a',        // yeşil (basınçlı hava)
  steel: '#1e293b',      // koyu (ekipman gövdesi)
  stroke: '#334155',     // gri çizgi
  label: '#334155',      // etiket
  muted: '#94a3b8',      // soluk yardımcı
};

// === Instrument bubble (sensör/ölçer) ===
// type=local → düz çizgili; type=remote → çizgisiz; type=plc → çift çizgili
export function InstrumentBubble({
  cx,
  cy,
  topText,
  bottomText,
  type = 'local',
  r = 11,
}: {
  cx: number;
  cy: number;
  topText: string;
  bottomText?: string;
  type?: 'local' | 'remote' | 'plc';
  r?: number;
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="white" stroke={PID_COLORS.stroke} strokeWidth="1.3" />
      {type === 'local' && (
        <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke={PID_COLORS.stroke} strokeWidth="0.9" />
      )}
      {type === 'plc' && (
        <>
          <line x1={cx - r} y1={cy - 1.5} x2={cx + r} y2={cy - 1.5} stroke={PID_COLORS.stroke} strokeWidth="0.9" />
          <line x1={cx - r} y1={cy + 1.5} x2={cx + r} y2={cy + 1.5} stroke={PID_COLORS.stroke} strokeWidth="0.9" />
        </>
      )}
      <text x={cx} y={cy - 2} fontSize="6.5" textAnchor="middle" fill={PID_COLORS.label} fontWeight="600">
        {topText}
      </text>
      {bottomText && (
        <text x={cx} y={cy + 7} fontSize="6" textAnchor="middle" fill={PID_COLORS.label}>
          {bottomText}
        </text>
      )}
    </g>
  );
}

// === Vana sembolü — basit yuvarlak (Storage modülüyle tutarlı) ===
// actuated parametresi imza uyumluluğu için tutuluyor ama görsel etkisi yok.
export function ButterflyValve({
  cx,
  cy,
  color = PID_COLORS.process,
  label,
}: {
  cx: number;
  cy: number;
  color?: string;
  actuated?: boolean;
  label?: string;
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={5.5} fill="white" stroke={color} strokeWidth="1.8" />
      {label && (
        <text x={cx} y={cy + 16} fontSize="6.5" textAnchor="middle" fill={PID_COLORS.label}>
          {label}
        </text>
      )}
    </g>
  );
}

// === Single seat valve (SW-CIP, SW41, SW43) — yuvarlak (Storage tutarlı) ===
export function SingleSeatValve({
  cx,
  cy,
  color = PID_COLORS.cip,
  label,
}: {
  cx: number;
  cy: number;
  color?: string;
  actuated?: boolean;
  label?: string;
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={5.5} fill="white" stroke={color} strokeWidth="1.8" />
      {label && (
        <text x={cx} y={cy + 16} fontSize="6.5" textAnchor="middle" fill={PID_COLORS.label}>
          {label}
        </text>
      )}
    </g>
  );
}

// === Check valve (VPN — Non-return) — yuvarlak (ortası dolu) ===
export function CheckValve({
  cx,
  cy,
  color = PID_COLORS.process,
  label = 'VPN',
}: {
  cx: number;
  cy: number;
  color?: string;
  label?: string;
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={5.5} fill="white" stroke={color} strokeWidth="1.8" />
      {/* Yön belirten dolu merkez (check / non-return ayrımı için) */}
      <circle cx={cx} cy={cy} r={2.2} fill={color} />
      {label && (
        <text x={cx} y={cy + 16} fontSize="6.5" textAnchor="middle" fill={PID_COLORS.label}>
          {label}
        </text>
      )}
    </g>
  );
}

// === Pompa — ok şeklinde üçgen (Storage modülüyle tutarlı) ===
export function HygienicPump({
  cx,
  cy,
  color = PID_COLORS.stroke,
  label,
  subLabel,
}: {
  cx: number;
  cy: number;
  color?: string;
  label?: string;
  subLabel?: string;
}) {
  return (
    <g>
      <polygon
        points={`${cx - 7},${cy - 7} ${cx + 8},${cy} ${cx - 7},${cy + 7}`}
        fill="white"
        stroke={color}
        strokeWidth="1.8"
      />
      {label && (
        <text x={cx} y={cy + 16} fontSize="6.5" textAnchor="middle" fill={PID_COLORS.label} fontWeight="600">
          {label}
        </text>
      )}
      {subLabel && (
        <text x={cx} y={cy + 24} fontSize="5.5" textAnchor="middle" fill={PID_COLORS.muted}>
          {subLabel}
        </text>
      )}
    </g>
  );
}

// === In-line filter / strainer ===
export function InlineFilter({
  cx,
  cy,
  color = PID_COLORS.stroke,
  label,
}: {
  cx: number;
  cy: number;
  color?: string;
  label?: string;
}) {
  return (
    <g>
      {/* Dikey kapsül */}
      <rect x={cx - 9} y={cy - 22} width="18" height="44" rx="9" fill="white" stroke={color} strokeWidth="1.4" />
      {/* İç eleman (filtre madyası — diyagonal çizgiler) */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line
          key={i}
          x1={cx - 7}
          y1={cy - 18 + i * 7}
          x2={cx + 7}
          y2={cy - 15 + i * 7}
          stroke="#cbd5e1"
          strokeWidth="0.8"
        />
      ))}
      {/* Tahliye (drain) */}
      <line x1={cx} y1={cy + 22} x2={cx} y2={cy + 28} stroke={color} strokeWidth="1.2" />
      <line x1={cx - 4} y1={cy + 28} x2={cx + 4} y2={cy + 28} stroke={color} strokeWidth="1.4" />
      {label && (
        <text x={cx} y={cy + 38} fontSize="7" textAnchor="middle" fill={PID_COLORS.label} fontWeight="600">
          {label}
        </text>
      )}
    </g>
  );
}

// === Degazör (yatay vakum degazör tankı) ===
export function Degazor({
  cx,
  cy,
  width = 80,
  color = PID_COLORS.stroke,
  hasLsh = true,
  hasLsl = true,
  exhaustValveLabel,
}: {
  cx: number;
  cy: number;
  width?: number;
  color?: string;
  hasLsh?: boolean;
  hasLsl?: boolean;
  exhaustValveLabel?: string;
}) {
  const h = 36;
  const w = width;
  return (
    <g>
      {/* Yatay silindir gövde */}
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill="#f1f5f9" stroke={color} strokeWidth="1.4" />
      {/* Sol/sağ kapaklar — yarım daire */}
      <path d={`M ${cx - w / 2} ${cy - h / 2} A ${h / 2} ${h / 2} 0 0 0 ${cx - w / 2} ${cy + h / 2}`} fill="#e2e8f0" stroke={color} strokeWidth="1.4" />
      <path d={`M ${cx + w / 2} ${cy - h / 2} A ${h / 2} ${h / 2} 0 0 1 ${cx + w / 2} ${cy + h / 2}`} fill="#e2e8f0" stroke={color} strokeWidth="1.4" />

      {/* Üst air exhaust çıkışı + vana */}
      <line x1={cx} y1={cy - h / 2} x2={cx} y2={cy - h / 2 - 14} stroke={color} strokeWidth="1.4" />
      <ButterflyValve cx={cx} cy={cy - h / 2 - 22} color={PID_COLORS.air} actuated label={exhaustValveLabel} />

      {/* LSH / LSL sensör bubble'ları */}
      {hasLsh && (
        <g>
          <line x1={cx - w / 2 + 15} y1={cy - h / 2} x2={cx - w / 2 + 15} y2={cy - h / 2 - 14} stroke={color} strokeWidth="1" />
          <InstrumentBubble cx={cx - w / 2 + 15} cy={cy - h / 2 - 24} topText="LSH" />
        </g>
      )}
      {hasLsl && (
        <g>
          <line x1={cx + w / 2 - 15} y1={cy - h / 2} x2={cx + w / 2 - 15} y2={cy - h / 2 - 14} stroke={color} strokeWidth="1" />
          <InstrumentBubble cx={cx + w / 2 - 15} cy={cy - h / 2 - 24} topText="LSL" />
        </g>
      )}

      <text x={cx} y={cy + h / 2 + 11} fontSize="7" textAnchor="middle" fill={PID_COLORS.label} fontWeight="600">
        Degazör
      </text>
    </g>
  );
}

// === Plate Heat Exchanger (PHE) ===
export function PlateHeatExchanger({
  cx,
  cy,
  width = 70,
  color = PID_COLORS.stroke,
  label = 'PHE',
  capacity,
  iceColor = PID_COLORS.cip,
}: {
  cx: number;
  cy: number;
  width?: number;
  color?: string;
  label?: string;
  capacity?: number | null;
  iceColor?: string;
}) {
  const h = 38;
  const w = width;
  const plateStart = cx - w / 2 + 6;
  const plateWidth = w - 12;
  const numPlates = 7;
  const step = plateWidth / numPlates;
  return (
    <g>
      {/* Dış çerçeve */}
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill="white" stroke={color} strokeWidth="1.4" />
      {/* Yan flanşlar — koyu */}
      <rect x={cx - w / 2} y={cy - h / 2} width="4" height={h} fill="#cbd5e1" stroke={color} strokeWidth="1" />
      <rect x={cx + w / 2 - 4} y={cy - h / 2} width="4" height={h} fill="#cbd5e1" stroke={color} strokeWidth="1" />
      {/* Plakalar (dikey çizgiler) */}
      {Array.from({ length: numPlates }).map((_, i) => (
        <line
          key={i}
          x1={plateStart + i * step}
          y1={cy - h / 2 + 4}
          x2={plateStart + i * step}
          y2={cy + h / 2 - 4}
          stroke={color}
          strokeWidth="0.8"
        />
      ))}
      {/* Ice water giriş (alt) ve dönüş (üst) bağlantı kanalları */}
      <line x1={cx - w / 2 + 8} y1={cy + h / 2} x2={cx - w / 2 + 8} y2={cy + h / 2 + 10} stroke={iceColor} strokeWidth="1.6" strokeDasharray="3 2" />
      <text x={cx - w / 2 + 8} y={cy + h / 2 + 18} fontSize="5.5" textAnchor="middle" fill={iceColor}>Ice→</text>
      <line x1={cx + w / 2 - 8} y1={cy - h / 2} x2={cx + w / 2 - 8} y2={cy - h / 2 - 10} stroke={iceColor} strokeWidth="1.6" strokeDasharray="3 2" />
      <text x={cx + w / 2 - 8} y={cy - h / 2 - 13} fontSize="5.5" textAnchor="middle" fill={iceColor}>←Ice</text>

      <text x={cx} y={cy + h / 2 + 28} fontSize="7" textAnchor="middle" fill={PID_COLORS.label} fontWeight="600">
        {label}
      </text>
      {capacity != null && capacity > 0 && (
        <text x={cx} y={cy + h / 2 + 36} fontSize="5.5" textAnchor="middle" fill={PID_COLORS.muted}>
          {capacity.toLocaleString('tr-TR')} L/h
        </text>
      )}
    </g>
  );
}

// === Milk Clarifier (separatör) ===
export function MilkClarifier({
  cx,
  cy,
  color = PID_COLORS.stroke,
  bypassLabel,
}: {
  cx: number;
  cy: number;
  color?: string;
  bypassLabel?: string;
}) {
  return (
    <g>
      {/* Trapezoid gövde (separatör tipi) */}
      <polygon
        points={`${cx - 13},${cy - 14} ${cx + 13},${cy - 14} ${cx + 16},${cy + 14} ${cx - 16},${cy + 14}`}
        fill="white"
        stroke={color}
        strokeWidth="1.4"
      />
      {/* Dönen disk — iç yatay çizgiler */}
      <line x1={cx - 12} y1={cy - 6} x2={cx + 12} y2={cy - 6} stroke={color} strokeWidth="0.8" />
      <line x1={cx - 13} y1={cy} x2={cx + 13} y2={cy} stroke={color} strokeWidth="0.8" />
      <line x1={cx - 14} y1={cy + 6} x2={cx + 14} y2={cy + 6} stroke={color} strokeWidth="0.8" />
      {/* Üst mil (rotor) */}
      <line x1={cx} y1={cy - 14} x2={cx} y2={cy - 20} stroke={color} strokeWidth="1.4" />
      <circle cx={cx} cy={cy - 23} r="2.5" fill={color} />

      <text x={cx} y={cy + 24} fontSize="7" textAnchor="middle" fill={PID_COLORS.label} fontWeight="600">
        Clarifier
      </text>
      {bypassLabel && (
        <text x={cx} y={cy + 32} fontSize="5.5" textAnchor="middle" fill={PID_COLORS.muted}>
          Bypass: {bypassLabel}
        </text>
      )}
    </g>
  );
}

// === Flow meter (electromagnetic) ===
export function FlowMeter({
  cx,
  cy,
  color = PID_COLORS.stroke,
  size,
}: {
  cx: number;
  cy: number;
  color?: string;
  size?: string;
}) {
  return (
    <g>
      {/* Dikdörtgen gövde */}
      <rect x={cx - 12} y={cy - 9} width="24" height="18" fill="white" stroke={color} strokeWidth="1.4" />
      {/* İç bobinler (iki yan çizgi) */}
      <line x1={cx - 8} y1={cy - 9} x2={cx - 8} y2={cy + 9} stroke={color} strokeWidth="0.8" />
      <line x1={cx + 8} y1={cy - 9} x2={cx + 8} y2={cy + 9} stroke={color} strokeWidth="0.8" />
      {/* Üst yandan FT bubble bağlantısı */}
      <line x1={cx} y1={cy - 9} x2={cx} y2={cy - 16} stroke={color} strokeWidth="1" />
      <InstrumentBubble cx={cx} cy={cy - 26} topText="FT" type="local" r={10} />
      <text x={cx} y={cy + 18} fontSize="6.5" textAnchor="middle" fill={PID_COLORS.label} fontWeight="600">
        Krohne
      </text>
      {size && (
        <text x={cx} y={cy + 26} fontSize="5.5" textAnchor="middle" fill={PID_COLORS.muted}>
          {size}
        </text>
      )}
    </g>
  );
}

// === Manuel sampling valve (numune) ===
export function SamplingValve({
  cx,
  cy,
  color = PID_COLORS.process,
  isActuated,
}: {
  cx: number;
  cy: number;
  color?: string;
  isActuated?: boolean;
}) {
  return (
    <g>
      {/* Hattan aşağı sapan kısa hat */}
      <line x1={cx} y1={cy} x2={cx} y2={cy + 12} stroke={color} strokeWidth="2" />
      {/* Vana */}
      <ButterflyValve cx={cx} cy={cy + 16} color={color} actuated={!!isActuated} />
      {/* Numune kabı */}
      <line x1={cx} y1={cy + 24} x2={cx} y2={cy + 30} stroke={color} strokeWidth="1.4" />
      <polygon points={`${cx - 4},${cy + 30} ${cx + 4},${cy + 30} ${cx + 2},${cy + 36} ${cx - 2},${cy + 36}`} fill="white" stroke={color} strokeWidth="1" />
      <text x={cx + 9} y={cy + 24} fontSize="6" fill={PID_COLORS.muted}>
        Smp{isActuated ? '⚙' : ''}
      </text>
    </g>
  );
}

// === Tanker (kamyon) sembolü — /public/tank.png görselini kullanır ===
export function Tanker({ cx, cy, width = 72 }: { cx: number; cy: number; width?: number }) {
  // /tank.png ~2.6:1 en/boy oranlı
  const height = width / 2.6;
  return (
    <image
      href="/tank.png"
      x={cx - width / 2}
      y={cy - height / 2}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

// === Çıkış noktası (ok) ===
export function FlowArrow({
  cx,
  cy,
  color,
  direction = 'right',
  size = 6,
}: {
  cx: number;
  cy: number;
  color: string;
  direction?: 'right' | 'left';
  size?: number;
}) {
  const pts = direction === 'right'
    ? `${cx - size},${cy - size} ${cx + size},${cy} ${cx - size},${cy + size}`
    : `${cx + size},${cy - size} ${cx - size},${cy} ${cx + size},${cy + size}`;
  return <polygon points={pts} fill={color} />;
}
