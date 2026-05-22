type Tank = { name: string; volume: number };
type FLine = { name: string; capacity: number; connectedTankCount: number };
type DLine = {
  name: string;
  capacity: number;
  connectedTankCount: number;
  hasPump: boolean;
};
type TankCipReturn = {
  manifoldExists: boolean;
  lineCount: number;
  hasPump: boolean;
};

interface Props {
  tanks: Tank[];
  fillingLines: FLine[];
  dischargeLines: DLine[];
  fixedFillingValves: number;
  fixedDischargeValves: number;
  selectedDN?: string;
  tankCipReturn?: TankCipReturn | null;
}

export function ModuleSchematic({
  tanks,
  fillingLines,
  dischargeLines,
  fixedFillingValves,
  fixedDischargeValves,
  selectedDN,
  tankCipReturn,
}: Props) {
  if (tanks.length === 0 && fillingLines.length === 0 && dischargeLines.length === 0) {
    return (
      <p className="text-sm text-slate-500 italic">
        Diyagram için tank veya hat tanımlı değil.
      </p>
    );
  }

  const tankCipLineCount =
    tankCipReturn && !tankCipReturn.manifoldExists ? tankCipReturn.lineCount : 0;

  // Layout sabitleri
  const tankW = 64;
  const tankH = 84;
  const tankGap = 22;
  const tankAreaTop = 36;
  const tankSpacing = tankW + tankGap;
  const labelPad = 100;                 // sol etiket alanı
  const preFixedPad = 100;              // boşaltım hattındaki sabit vana grubu için
  const leftPad = labelPad + preFixedPad; // tankların başladığı konum
  const rightFixedPad = 150;
  const lineGap = 52;
  const lineStartY = tankAreaTop + tankH + 36;

  const tanksCount = tanks.length;
  const totalLines = fillingLines.length + dischargeLines.length + tankCipLineCount;
  const tankAreaWidth = Math.max(tanksCount, 1) * tankSpacing;
  const width = leftPad + tankAreaWidth + rightFixedPad;
  const manifoldBottom = lineStartY + Math.max(totalLines, 1) * lineGap;
  const height = manifoldBottom + 60;

  const tankCenterX = (i: number) => leftPad + i * tankSpacing + tankW / 2;

  // Renkler
  const fillingColor = '#0ea5e9';   // sky
  const dischargeColor = '#f97316'; // orange
  const tankCipColor = '#a855f7';   // purple

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto"
      >
        {/* Paslanmaz çelik gradient (tank dış gövde) */}
        <defs>
          <linearGradient id="tank-body" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#cbd5e1" />
            <stop offset="35%" stopColor="#f1f5f9" />
            <stop offset="65%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          <linearGradient id="tank-cap" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
        </defs>

        {/* Tanklar */}
        {tanks.map((t, i) => {
          const cx = tankCenterX(i);
          const top = tankAreaTop;
          const bodyTop = top + 10;
          const bodyBottom = top + tankH - 10;
          return (
            <g key={i}>
              {/* Üst kapak (yarım elips) */}
              <path
                d={`M ${cx - tankW / 2} ${bodyTop} A ${tankW / 2} 10 0 0 1 ${cx + tankW / 2} ${bodyTop} Z`}
                fill="url(#tank-cap)"
                stroke="#64748b"
                strokeWidth="1"
              />
              {/* Manhole — üst kapağın ortasında */}
              <rect
                x={cx - 4}
                y={top - 2}
                width="8"
                height="6"
                rx="1"
                fill="#475569"
                stroke="#334155"
                strokeWidth="0.8"
              />
              {/* Gövde — paslanmaz gradient */}
              <rect
                x={cx - tankW / 2}
                y={bodyTop}
                width={tankW}
                height={bodyBottom - bodyTop}
                fill="url(#tank-body)"
                stroke="#64748b"
                strokeWidth="1"
              />
              {/* Konik alt (V şeklinde) */}
              <path
                d={`M ${cx - tankW / 2} ${bodyBottom} L ${cx} ${top + tankH} L ${cx + tankW / 2} ${bodyBottom} Z`}
                fill="url(#tank-cap)"
                stroke="#64748b"
                strokeWidth="1"
              />
              {/* Yansıma çubuğu (paslanmaz çelik vurgusu) */}
              <line
                x1={cx - tankW / 2 + 4}
                y1={bodyTop + 4}
                x2={cx - tankW / 2 + 4}
                y2={bodyBottom - 4}
                stroke="white"
                strokeWidth="1.5"
                opacity="0.7"
              />
              {/* Tank etiketi — koyu metin, açık tank üzerinde */}
              <text
                x={cx}
                y={bodyTop + (bodyBottom - bodyTop) / 2 - 1}
                textAnchor="middle"
                fill="#0f172a"
                fontSize="11"
                fontWeight="700"
              >
                {t.name}
              </text>
              <text
                x={cx}
                y={bodyTop + (bodyBottom - bodyTop) / 2 + 12}
                textAnchor="middle"
                fill="#475569"
                fontSize="8.5"
                fontWeight="500"
              >
                {t.volume.toLocaleString('tr-TR')} L
              </text>
              {/* Tank → manifold düşüş hattı (proses çıkışı) */}
              <line
                x1={cx}
                y1={top + tankH}
                x2={cx}
                y2={manifoldBottom - lineGap / 2}
                stroke="#94a3b8"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
            </g>
          );
        })}

        {/* Dolum hatları */}
        {fillingLines.map((line, idx) => {
          const y = lineStartY + idx * lineGap;
          return (
            <LineRow
              key={`fl-${idx}`}
              y={y}
              label={line.name}
              capacity={line.capacity}
              color={fillingColor}
              labelPad={labelPad}
              leftPad={leftPad}
              tankCenterX={tankCenterX}
              connectedCount={Math.min(line.connectedTankCount, tanksCount)}
              tankAreaWidth={tankAreaWidth}
              fixedValves={fixedFillingValves}
              hasPump={false}
              fixedLabels={['Drain', 'Lkg', 'CIP↩']}
              fixedSide="end"
              arrowDirection="right"
            />
          );
        })}

        {/* Boşaltım hatları */}
        {dischargeLines.map((line, idx) => {
          const y = lineStartY + (fillingLines.length + idx) * lineGap;
          const labels = ['CIP→', 'Lkg'];
          if (fixedDischargeValves === 3) labels.push('Su');
          return (
            <LineRow
              key={`dl-${idx}`}
              y={y}
              label={line.name}
              capacity={line.capacity}
              color={dischargeColor}
              labelPad={labelPad}
              leftPad={leftPad}
              tankCenterX={tankCenterX}
              connectedCount={Math.min(line.connectedTankCount, tanksCount)}
              tankAreaWidth={tankAreaWidth}
              fixedValves={fixedDischargeValves}
              hasPump={!!line.hasPump}
              fixedLabels={labels}
              fixedSide="start"
              arrowDirection="right"
            />
          );
        })}

        {/* Tank CIP Dönüş hatları (manifoldda yoksa) */}
        {Array.from({ length: tankCipLineCount }).map((_, idx) => {
          const y =
            lineStartY +
            (fillingLines.length + dischargeLines.length + idx) * lineGap;
          return (
            <LineRow
              key={`tcr-${idx}`}
              y={y}
              label={`Tank CIP Dönüş ${tankCipLineCount > 1 ? idx + 1 : ''}`.trim()}
              capacity={null}
              color={tankCipColor}
              labelPad={labelPad}
              leftPad={leftPad}
              tankCenterX={tankCenterX}
              connectedCount={tanksCount}
              tankAreaWidth={tankAreaWidth}
              fixedValves={2}
              hasPump={!!tankCipReturn?.hasPump}
              fixedLabels={['Drain', 'Çek']}
              fixedSide="end"
              arrowDirection="right"
            />
          );
        })}

        {/* Manifold mevcut bilgi rozeti */}
        {tankCipReturn?.manifoldExists && (
          <g transform={`translate(${leftPad}, ${manifoldBottom + 4})`}>
            <rect
              x="0"
              y="0"
              width="260"
              height="18"
              rx="3"
              fill="#faf5ff"
              stroke={tankCipColor}
              strokeDasharray="3 3"
            />
            <text x="8" y="12" fontSize="9" fill="#6b21a8">
              Tank CIP Dönüş: mevcut manifold kullanılacak
            </text>
          </g>
        )}

        {/* Lejant — arka planlı kart */}
        <g transform={`translate(10, ${height - 36})`}>
          <rect x="0" y="0" width={width - 20} height="30" rx="4" fill="#f8fafc" stroke="#e2e8f0" />
          <g transform="translate(10, 8)">
            <circle cx="6" cy="7" r="5.5" fill="white" stroke="#475569" strokeWidth="1.8" />
            <text x="18" y="10" fontSize="9" fill="#1e293b" fontWeight="500">Vana</text>

            <polygon points="58,1 70,7 58,13" fill="white" stroke="#475569" strokeWidth="1.8" />
            <text x="78" y="10" fontSize="9" fill="#1e293b" fontWeight="500">Pompa</text>

            <line x1="120" y1="7" x2="142" y2="7" stroke={fillingColor} strokeWidth="2.8" strokeLinecap="round" />
            <text x="148" y="10" fontSize="9" fill="#1e293b" fontWeight="500">Dolum hattı</text>

            <line x1="208" y1="7" x2="230" y2="7" stroke={dischargeColor} strokeWidth="2.8" strokeLinecap="round" />
            <text x="236" y="10" fontSize="9" fill="#1e293b" fontWeight="500">Boşaltım hattı</text>

            <line x1="306" y1="7" x2="328" y2="7" stroke={tankCipColor} strokeWidth="2.8" strokeLinecap="round" />
            <text x="334" y="10" fontSize="9" fill="#1e293b" fontWeight="500">Tank CIP Dönüş</text>
          </g>
          {selectedDN && (
            <text x={width - 30} y="19" fontSize="10" fill="#475569" textAnchor="end">
              Seçilen boru çapı: <tspan fontWeight="700" fill="#0f172a">{selectedDN}</tspan>
            </text>
          )}
        </g>
      </svg>
    </div>
  );
}

function LineRow({
  y,
  label,
  capacity,
  color,
  labelPad,
  leftPad,
  tankCenterX,
  connectedCount,
  tankAreaWidth,
  fixedValves,
  hasPump,
  fixedLabels,
  fixedSide,
  arrowDirection,
}: {
  y: number;
  label: string;
  capacity: number | null;
  color: string;
  labelPad: number;
  leftPad: number;
  tankCenterX: (i: number) => number;
  connectedCount: number;
  tankAreaWidth: number;
  fixedValves: number;
  hasPump: boolean;
  fixedLabels: string[];
  fixedSide: 'start' | 'end';
  arrowDirection: 'left' | 'right';
}) {
  const lineStartX = labelPad - 4;
  const tankAreaEnd = leftPad + tankAreaWidth;

  // Yeni sabit vana yerleşimi: tek bir noktada T-yıldız (top + right + bottom)
  // 3 vana → üst/sağ/alt, 2 vana → üst/alt, 1 vana → üst
  const fixedAreaWidth = fixedValves >= 3 ? 30 : 0;
  const startFixedX = labelPad + 18;
  const endFixedX = tankAreaEnd + 22;
  const fixedX = fixedSide === 'start' ? startFixedX : endFixedX;
  const fixedRightEdge = fixedX + fixedAreaWidth;

  const pumpX = (fixedSide === 'end' ? fixedRightEdge : tankAreaEnd + 18) + 14;
  const lineEndX = hasPump ? pumpX + 16 : (fixedSide === 'end' ? fixedRightEdge + 14 : tankAreaEnd + 26);

  return (
    <g>
      {/* Sol etiket — hat ismi + kapasite */}
      <text
        x={lineStartX - 6}
        y={y + 2}
        fontSize="10"
        fill="#0f172a"
        textAnchor="end"
        fontWeight="700"
      >
        {label}
      </text>
      {capacity != null && (
        <text x={lineStartX - 6} y={y + 14} fontSize="8" fill="#64748b" textAnchor="end">
          {capacity.toLocaleString('tr-TR')} L/h
        </text>
      )}

      {/* Manifold çizgisi */}
      <line x1={lineStartX} y1={y} x2={lineEndX} y2={y} stroke={color} strokeWidth="2.8" strokeLinecap="round" />

      {/* Tank altlarındaki bağlantı vanaları */}
      {Array.from({ length: connectedCount }).map((_, i) => {
        const cx = tankCenterX(i);
        return (
          <g key={i}>
            <line x1={cx} y1={y - 14} x2={cx} y2={y} stroke={color} strokeWidth="2" />
            <Valve cx={cx} cy={y - 14} color={color} />
          </g>
        );
      })}

      {/* Sabit vanalar — tek bir noktada üst/sağ/alt yıldız yerleşimi */}
      {(() => {
        const labels = fixedLabels.slice(0, fixedValves);
        const offset = 18; // hat çizgisinden vana merkezine dikey mesafe
        const rightOffset = 22; // sağdaki vana için yatay mesafe
        // i=0 üst, i=1 sağ (3 vana ise) veya alt (2 vana ise), i=2 alt
        return labels.map((lbl, i) => {
          let cx: number, cy: number, textX: number, textY: number, textAnchor: 'middle' | 'start';
          if (i === 0) {
            // ÜST
            cx = fixedX; cy = y - offset;
            textX = cx; textY = y - offset - 10; textAnchor = 'middle';
          } else if (labels.length === 3 && i === 1) {
            // SAĞ — hat hizasında
            cx = fixedX + rightOffset; cy = y;
            textX = cx + 9; textY = y - 5; textAnchor = 'start';
          } else {
            // ALT
            cx = fixedX; cy = y + offset;
            textX = cx; textY = y + offset + 15; textAnchor = 'middle';
          }
          // Hattan vanaya bağlantı mili (sağ vana için yok, manifold zaten geçiyor)
          const showMil = cy !== y;
          const milY2 = cy > y ? cy - 5 : cy + 5; // vana kenarına kadar
          return (
            <g key={`fx-${i}`}>
              {showMil && (
                <line x1={cx} y1={y} x2={cx} y2={milY2} stroke={color} strokeWidth="2" />
              )}
              <Valve cx={cx} cy={cy} color={color} small />
              <text
                x={textX}
                y={textY}
                textAnchor={textAnchor}
                fontSize="8"
                fill={color}
                fontWeight="600"
              >
                {lbl}
              </text>
            </g>
          );
        });
      })()}

      {/* Pompa */}
      {hasPump && (
        <g>
          <polygon
            points={`${pumpX - 8},${y - 8} ${pumpX + 9},${y} ${pumpX - 8},${y + 8}`}
            fill="white"
            stroke={color}
            strokeWidth="2"
          />
          <text x={pumpX} y={y + 20} textAnchor="middle" fontSize="8" fill={color} fontWeight="600">
            P
          </text>
        </g>
      )}

      {/* Yön oku */}
      {arrowDirection === 'right' && (
        <polygon
          points={`${lineEndX - 2},${y - 5} ${lineEndX + 7},${y} ${lineEndX - 2},${y + 5}`}
          fill={color}
        />
      )}
      {arrowDirection === 'left' && (
        <polygon
          points={`${lineStartX + 2},${y - 5} ${lineStartX - 7},${y} ${lineStartX + 2},${y + 5}`}
          fill={color}
        />
      )}
    </g>
  );
}

function Valve({ cx, cy, color, small = false }: { cx: number; cy: number; color: string; small?: boolean }) {
  const r = small ? 4.5 : 5.5;
  return <circle cx={cx} cy={cy} r={r} fill="white" stroke={color} strokeWidth="1.8" />;
}
