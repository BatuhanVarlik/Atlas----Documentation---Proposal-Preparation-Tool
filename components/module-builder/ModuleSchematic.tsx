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

  // Layout sabitleri (sığması için biraz daraltıldı)
  const tankW = 56;
  const tankH = 70;
  const tankGap = 18;
  const tankAreaTop = 24;
  const tankSpacing = tankW + tankGap;
  const labelPad = 80;                  // sol etiket alanı
  const preFixedPad = 90;               // boşaltım hattındaki sabit vana grubu için
  const leftPad = labelPad + preFixedPad; // tankların başladığı konum
  const rightFixedPad = 140;
  const lineGap = 42;
  const lineStartY = tankAreaTop + tankH + 30;

  const tanksCount = tanks.length;
  const totalLines = fillingLines.length + dischargeLines.length + tankCipLineCount;
  const tankAreaWidth = Math.max(tanksCount, 1) * tankSpacing;
  const width = leftPad + tankAreaWidth + rightFixedPad;
  const manifoldBottom = lineStartY + Math.max(totalLines, 1) * lineGap;
  const height = manifoldBottom + 50;

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
        {/* Tanklar */}
        {tanks.map((t, i) => {
          const cx = tankCenterX(i);
          return (
            <g key={i}>
              <path
                d={`M ${cx - tankW / 2} ${tankAreaTop + 8} A ${tankW / 2} 8 0 0 1 ${cx + tankW / 2} ${tankAreaTop + 8}`}
                fill="#1e293b"
                stroke="#475569"
              />
              <rect
                x={cx - tankW / 2}
                y={tankAreaTop + 8}
                width={tankW}
                height={tankH - 16}
                fill="#0f172a"
                stroke="#475569"
              />
              <path
                d={`M ${cx - tankW / 2} ${tankAreaTop + tankH - 8} A ${tankW / 2} 8 0 0 0 ${cx + tankW / 2} ${tankAreaTop + tankH - 8}`}
                fill="#0f172a"
                stroke="#475569"
              />
              <text
                x={cx}
                y={tankAreaTop + tankH / 2 - 2}
                textAnchor="middle"
                fill="#f8fafc"
                fontSize="10"
                fontWeight="600"
              >
                {t.name}
              </text>
              <text
                x={cx}
                y={tankAreaTop + tankH / 2 + 10}
                textAnchor="middle"
                fill="#cbd5e1"
                fontSize="8"
              >
                {t.volume.toLocaleString('tr-TR')} L
              </text>
              {/* Tank → manifold düşüş hattı (kesikli kılavuz) */}
              <line
                x1={cx}
                y1={tankAreaTop + tankH}
                x2={cx}
                y2={manifoldBottom - lineGap / 2}
                stroke="#475569"
                strokeWidth="1"
                strokeDasharray="2 3"
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

        {/* Lejant */}
        <g transform={`translate(10, ${height - 22})`}>
          <circle cx="6" cy="8" r="5" fill="white" stroke="#0ea5e9" strokeWidth="2" />
          <text x="16" y="11" fontSize="9" fill="#334155">Vana</text>

          <polygon points="52,3 64,8 52,13" fill="white" stroke="#475569" strokeWidth="1.5" />
          <text x="70" y="11" fontSize="9" fill="#334155">Pompa</text>

          <line x1="108" y1="8" x2="128" y2="8" stroke={fillingColor} strokeWidth="2.5" />
          <text x="132" y="11" fontSize="9" fill="#334155">Dolum</text>

          <line x1="172" y1="8" x2="192" y2="8" stroke={dischargeColor} strokeWidth="2.5" />
          <text x="196" y="11" fontSize="9" fill="#334155">Boşaltım</text>

          <line x1="246" y1="8" x2="266" y2="8" stroke={tankCipColor} strokeWidth="2.5" />
          <text x="270" y="11" fontSize="9" fill="#334155">Tank CIP Dönüş</text>

          {selectedDN && (
            <text x={width - 10} y="11" fontSize="9" fill="#64748b" textAnchor="end">
              Boru: <tspan fontWeight="600" fill="#0f172a">{selectedDN}</tspan>
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
  const fixedSpacing = 24;

  const startFixedStart = labelPad + 6;
  const endFixedStart = tankAreaEnd + 14;
  const endFixedEnd = endFixedStart + fixedValves * fixedSpacing;
  const pumpX = (fixedSide === 'end' ? endFixedEnd : tankAreaEnd + 14) + 12;
  const lineEndX = hasPump ? pumpX + 14 : (fixedSide === 'end' ? endFixedEnd + 4 : tankAreaEnd + 20);

  const fixedStartX = fixedSide === 'start' ? startFixedStart : endFixedStart;

  return (
    <g>
      {/* Sol etiket */}
      <text
        x={lineStartX - 4}
        y={y + 3}
        fontSize="9"
        fill="#334155"
        textAnchor="end"
        fontWeight="600"
      >
        {label}
      </text>
      {capacity != null && (
        <text x={lineStartX - 4} y={y + 14} fontSize="7" fill="#94a3b8" textAnchor="end">
          {capacity.toLocaleString('tr-TR')} L/h
        </text>
      )}

      {/* Manifold çizgisi */}
      <line x1={lineStartX} y1={y} x2={lineEndX} y2={y} stroke={color} strokeWidth="2.5" />

      {/* Tank altlarındaki bağlantı vanaları */}
      {Array.from({ length: connectedCount }).map((_, i) => {
        const cx = tankCenterX(i);
        return (
          <g key={i}>
            <line x1={cx} y1={y - 12} x2={cx} y2={y} stroke={color} strokeWidth="1.8" />
            <Valve cx={cx} cy={y - 12} color={color} />
          </g>
        );
      })}

      {/* Sabit vanalar */}
      {fixedLabels.slice(0, fixedValves).map((lbl, i) => {
        const cx = fixedStartX + i * fixedSpacing;
        return (
          <g key={`fx-${i}`}>
            <Valve cx={cx} cy={y} color={color} small />
            <text x={cx} y={y + 18} textAnchor="middle" fontSize="7" fill="#64748b">
              {lbl}
            </text>
          </g>
        );
      })}

      {/* Pompa */}
      {hasPump && (
        <g>
          <polygon
            points={`${pumpX - 7},${y - 7} ${pumpX + 8},${y} ${pumpX - 7},${y + 7}`}
            fill="white"
            stroke={color}
            strokeWidth="1.8"
          />
          <text x={pumpX} y={y + 18} textAnchor="middle" fontSize="7" fill="#64748b">
            Pompa
          </text>
        </g>
      )}

      {/* Yön oku */}
      {arrowDirection === 'right' && (
        <polygon
          points={`${lineEndX - 2},${y - 3} ${lineEndX + 5},${y} ${lineEndX - 2},${y + 3}`}
          fill={color}
        />
      )}
      {arrowDirection === 'left' && (
        <polygon
          points={`${lineStartX + 2},${y - 3} ${lineStartX - 5},${y} ${lineStartX + 2},${y + 3}`}
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
