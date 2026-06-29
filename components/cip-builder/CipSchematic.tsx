// CIP istasyonu P&ID şeması — Forward / Circulated.
// Süt Alım / Depolama modüllerindeki APV sembol setini (pidSymbols) yeniden kullanır,
// CIP'e özel dikey tank ve tubular ısı değiştirici sembollerini ekler.
//
// HEM-2005 (Forward) ve HEM-1016 (Circulated) çizimlerinin sadeleştirilmiş şematik karşılığı:
//   • Üstte tanklar + supply manifold (Forward) / supply+return manifold (Circulated)
//   • Discharge hatları: manifold → pompa → tubular (steam) → filter 500µ → flowmetre → conductivity → çıkış
//   • Return hatları: işlemden → flowmetre → conductivity → pompa → tanka dönüş (Circulated) / recovery (Forward)

import {
  PID_COLORS,
  SquareValve,
  HygienicPump,
  InlineFilter,
  FlowMeter,
  InstrumentBubble,
  FlowArrow,
} from '@/components/milk-reception/pidSymbols';

export type CipTankType = 'CAUSTIC' | 'ACID' | 'HOT_WATER' | 'RECOVERY' | 'FRESH_WATER';

interface TankData {
  tankType: CipTankType;
  label: string;
  capacity: number; // L
}
interface LineData {
  name: string;
  capacity: number; // L/h
  dn: string | null;
  pumpModel: string | null;
  pumpKw: number | null;
}

interface Props {
  standard: 'DIN' | 'SMS';
  systemType: 'FORWARD' | 'CIRCULATED';
  selectedDN: string | null;
  tanks: TankData[];
  dischargeLines: LineData[];
  returnLines: LineData[];
}

// Tank tipine göre renk (gövde dolgusu) — PDF'teki kimyasal renk koduna yakın.
const TANK_FILL: Record<CipTankType, string> = {
  CAUSTIC: '#fee2e2',
  ACID: '#fef9c3',
  HOT_WATER: '#ffedd5',
  RECOVERY: '#dbeafe',
  FRESH_WATER: '#dcfce7',
};

// === Dikey CIP tankı (konik tabanlı) ===
function CipTank({ cx, top, w, h, label, capacity, fill }: {
  cx: number; top: number; w: number; h: number; label: string; capacity: number; fill: string;
}) {
  const left = cx - w / 2;
  const bodyH = h - 12;
  const coneBottom = top + h;
  return (
    <g>
      {/* gövde */}
      <rect x={left} y={top} width={w} height={bodyH} rx={3} fill={fill} stroke={PID_COLORS.steel} strokeWidth="1.4" />
      {/* üst kapak çizgisi */}
      <line x1={left} y1={top + 5} x2={left + w} y2={top + 5} stroke={PID_COLORS.steel} strokeWidth="0.8" />
      {/* konik taban */}
      <polygon
        points={`${left},${top + bodyH} ${left + w},${top + bodyH} ${cx},${coneBottom}`}
        fill={fill}
        stroke={PID_COLORS.steel}
        strokeWidth="1.4"
      />
      {/* etiket */}
      <text x={cx} y={top + bodyH / 2 - 2} fontSize="8" textAnchor="middle" fill={PID_COLORS.steel} fontWeight="700">
        {label}
      </text>
      {capacity > 0 && (
        <text x={cx} y={top + bodyH / 2 + 9} fontSize="7" textAnchor="middle" fill={PID_COLORS.label}>
          {capacity.toLocaleString('tr-TR')} L
        </text>
      )}
    </g>
  );
}

// === Tubular ısı değiştirici + steam bağlantısı ===
function TubularHE({ cx, cy, w = 56 }: { cx: number; cy: number; w?: number }) {
  const h = 22;
  const left = cx - w / 2;
  // içe S kıvrımlı tüp
  const midY = cy;
  const path = `M ${left + 4} ${midY} C ${left + w * 0.3} ${midY - 9}, ${left + w * 0.45} ${midY + 9}, ${left + w * 0.6} ${midY} S ${left + w - 4} ${midY - 9}, ${left + w - 4} ${midY}`;
  return (
    <g>
      <rect x={left} y={cy - h / 2} width={w} height={h} rx={3} fill="white" stroke={PID_COLORS.steel} strokeWidth="1.3" />
      <path d={path} fill="none" stroke={PID_COLORS.process} strokeWidth="1.4" />
      {/* steam girişi (üstten, yeşil-kırmızı) */}
      <line x1={cx} y1={cy - h / 2} x2={cx} y2={cy - h / 2 - 12} stroke={PID_COLORS.air} strokeWidth="1.4" />
      <text x={cx} y={cy - h / 2 - 15} fontSize="6" textAnchor="middle" fill={PID_COLORS.air} fontWeight="600">STEAM</text>
      <text x={cx} y={cy + h / 2 + 9} fontSize="6.5" textAnchor="middle" fill={PID_COLORS.label} fontWeight="600">Tubular</text>
    </g>
  );
}

const labelPad = 200;
const symbolGap = 10;
const lineGap = 116;
const tankBandH = 96;
const topPad = 16;
const bottomPad = 48;

type Item = { id: string; cx: number; width: number };

function buildDischarge(): { items: Item[]; total: number } {
  const items: Item[] = [];
  let cursor = labelPad + 12;
  const push = (id: string, width: number) => {
    items.push({ id, cx: cursor + width / 2, width });
    cursor += width + symbolGap;
  };
  push('tap-valve', 24);
  push('pump', 40);
  push('tubular', 56);
  push('filter', 30);
  push('flowmeter', 28);
  push('conductivity', 26);
  push('outlet', 22);
  return { items, total: cursor };
}

function buildReturn(): { items: Item[]; total: number } {
  const items: Item[] = [];
  let cursor = labelPad + 12;
  const push = (id: string, width: number) => {
    items.push({ id, cx: cursor + width / 2, width });
    cursor += width + symbolGap;
  };
  push('inlet-arrow', 22);
  push('flowmeter', 28);
  push('conductivity', 26);
  push('pump', 40);
  push('return-valve', 24);
  push('return-arrow', 22);
  return { items, total: cursor };
}

export function CipSchematic({ standard, systemType, selectedDN, tanks, dischargeLines, returnLines }: Props) {
  if (tanks.length === 0 && dischargeLines.length === 0 && returnLines.length === 0) {
    return <p className="text-sm text-slate-500 italic">Diyagram için tank veya hat tanımlı değil.</p>;
  }

  const dLayout = buildDischarge();
  const rLayout = buildReturn();
  const maxWidth = Math.max(dLayout.total, rLayout.total, 760);

  const supplyColor = PID_COLORS.process; // discharge (besleme)
  const returnColor = PID_COLORS.cip;     // return (dönüş)

  // Üst tank bandı
  const tankTop = topPad + 18;
  const tankW = 64;
  const tankSlot = 110;
  const tanksStartX = labelPad + 20;
  const manifoldY = tankTop + tankBandH - 18; // tankların altından geçen supply manifold

  const lastTankCx = tanks.length > 0 ? tanksStartX + (tanks.length - 1) * tankSlot + tankW / 2 : labelPad + 6;
  const linesTop = topPad + tankBandH + 48;
  const totalLines = dischargeLines.length + returnLines.length;
  const totalHeight = linesTop + Math.max(totalLines, 1) * lineGap + bottomPad;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${maxWidth + 30} ${totalHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto"
      >
        {/* Başlık şeridi */}
        <g transform={`translate(12, ${topPad})`}>
          <rect x="0" y="0" width="270" height="22" rx="4" fill="#eff6ff" stroke="#3b82f6" strokeWidth="1.1" />
          <text x="9" y="14" fontSize="9" fill="#1e40af" fontWeight="700">
            CIP-2 Station · {systemType === 'FORWARD' ? 'Forward System' : 'Circulated System'}
          </text>
        </g>
        {selectedDN && (
          <text x={maxWidth} y={topPad + 14} fontSize="9" textAnchor="end" fill={PID_COLORS.label} fontWeight="600">
            Modül DN: {selectedDN}
          </text>
        )}

        {/* === Tank bandı === */}
        {tanks.length > 0 && (
          <g>
            {/* supply manifold — tankların altından boydan boya */}
            <line
              x1={labelPad + 6}
              y1={manifoldY}
              x2={lastTankCx}
              y2={manifoldY}
              stroke={supplyColor}
              strokeWidth="3"
            />
            {tanks.map((t, i) => {
              const cx = tanksStartX + i * tankSlot + tankW / 2;
              return (
                <g key={t.tankType}>
                  <CipTank
                    cx={cx}
                    top={tankTop}
                    w={tankW}
                    h={tankBandH - 24}
                    label={t.label.replace(' Tank', '')}
                    capacity={t.capacity}
                    fill={TANK_FILL[t.tankType]}
                  />
                  {/* tank konik tabanından manifolda iniş + çıkış vanası */}
                  <line x1={cx} y1={tankTop + tankBandH - 24} x2={cx} y2={manifoldY} stroke={supplyColor} strokeWidth="2" />
                  <SquareValve cx={cx} cy={(tankTop + tankBandH - 24 + manifoldY) / 2} color={supplyColor} label="ESV" />
                </g>
              );
            })}
            {/* manifoldun sol ucundan hatlara dağıtım (dikey iniş) */}
            <line x1={labelPad + 6} y1={manifoldY} x2={labelPad + 6} y2={linesTop} stroke={supplyColor} strokeWidth="2.5" />
          </g>
        )}

        {/* === Discharge hatları === */}
        {dischargeLines.map((line, idx) => {
          const y = linesTop + idx * lineGap;
          return (
            <DischargeRow key={`dl-${idx}`} y={y} line={line} layout={dLayout} color={supplyColor} standard={standard} />
          );
        })}

        {/* === Return hatları === */}
        {returnLines.map((line, idx) => {
          const y = linesTop + (dischargeLines.length + idx) * lineGap;
          return (
            <ReturnRow
              key={`rl-${idx}`}
              y={y}
              line={line}
              layout={rLayout}
              color={returnColor}
              systemType={systemType}
              standard={standard}
            />
          );
        })}

        {/* === Alt lejant === */}
        <g transform={`translate(12, ${totalHeight - 38})`}>
          <rect x="0" y="0" width={maxWidth} height="30" fill="#f8fafc" stroke="#e2e8f0" rx="3" />
          <g transform="translate(8, 8)">
            <line x1="0" y1="6" x2="22" y2="6" stroke={supplyColor} strokeWidth="2.5" />
            <text x="27" y="9" fontSize="8" fill="#334155">Besleme (Discharge)</text>
            <line x1="150" y1="6" x2="172" y2="6" stroke={returnColor} strokeWidth="2.5" strokeDasharray="5 3" />
            <text x="177" y="9" fontSize="8" fill="#334155">Dönüş (Return)</text>
            <line x1="290" y1="6" x2="312" y2="6" stroke={PID_COLORS.air} strokeWidth="2" />
            <text x="317" y="9" fontSize="8" fill="#334155">Steam</text>
            <rect x="362.5" y="0.5" width="11" height="11" fill="white" stroke={supplyColor} strokeWidth="1.6" />
            <text x="378" y="9" fontSize="8" fill="#334155">Vana (ESV)</text>
            <circle cx="470" cy="6" r="5.5" fill="white" stroke={PID_COLORS.stroke} strokeWidth="1.3" />
            <line x1="464.5" y1="6" x2="475.5" y2="6" stroke={PID_COLORS.stroke} strokeWidth="0.8" />
            <text x="480" y="9" fontSize="8" fill="#334155">Conductivity / Sensör</text>
          </g>
          <text x={maxWidth - 8} y="20" fontSize="8" fill={PID_COLORS.muted} textAnchor="end">APV P&amp;ID sembol seti</text>
        </g>
      </svg>
    </div>
  );
}

function LineLabel({ x, y, name, capacity, dn, color }: { x: number; y: number; name: string; capacity: number; dn: string | null; color: string }) {
  return (
    <g>
      <text x={x} y={y - 22} fontSize="11" fill="#0f172a" fontWeight="700">{name}</text>
      <text x={x} y={y - 10} fontSize="8.5" fill={PID_COLORS.muted}>
        {capacity > 0 ? `${capacity.toLocaleString('tr-TR')} L/h` : '— L/h'}
      </text>
      {dn && <text x={x} y={y + 2} fontSize="8.5" fill={color} fontWeight="600">⌀ {dn}</text>}
    </g>
  );
}

function DischargeRow({ y, line, layout, color, standard }: {
  y: number; line: LineData; layout: { items: Item[]; total: number }; color: string; standard: 'DIN' | 'SMS';
}) {
  const startX = labelPad + 6;
  const endX = layout.total - 6;
  return (
    <g>
      <LineLabel x={20} y={y} name={line.name} capacity={line.capacity} dn={line.dn} color={color} />
      {/* manifold dağıtım dikeyinden bu hatta bağlantı */}
      <line x1={startX} y1={y} x2={endX} y2={y} stroke={color} strokeWidth="3" />
      <FlowArrow cx={startX + 40} cy={y} color={color} direction="right" size={4} />
      {layout.items.map((it) => {
        switch (it.id) {
          case 'tap-valve':
            return <SquareValve key={it.id} cx={it.cx} cy={y} color={color} label="ESV" />;
          case 'pump':
            return (
              <HygienicPump
                key={it.id}
                cx={it.cx}
                cy={y}
                label="Pompa"
                subLabel={line.pumpModel ? `${line.pumpModel}${line.pumpKw ? ` · ${line.pumpKw}kW` : ''}` : undefined}
              />
            );
          case 'tubular':
            return <TubularHE key={it.id} cx={it.cx} cy={y} />;
          case 'filter':
            return <InlineFilter key={it.id} cx={it.cx} cy={y} label="500 µ" />;
          case 'flowmeter':
            return <FlowMeter key={it.id} cx={it.cx} cy={y} size={line.dn ?? undefined} />;
          case 'conductivity':
            return (
              <g key={it.id}>
                <line x1={it.cx} y1={y} x2={it.cx} y2={y - 16} stroke={color} strokeWidth="1" />
                <InstrumentBubble cx={it.cx} cy={y - 26} topText="QT" bottomText="JUMO" type="local" r={10} />
              </g>
            );
          case 'outlet':
            return (
              <g key={it.id}>
                <FlowArrow cx={it.cx} cy={y} color={color} direction="right" size={6} />
                <text x={it.cx + 4} y={y + 12} fontSize="6.5" fill={PID_COLORS.muted}>supply</text>
              </g>
            );
        }
        return null;
      })}
      <text x={startX + 2} y={y - 4} fontSize="6.5" fill={PID_COLORS.muted}>{standard}</text>
    </g>
  );
}

function ReturnRow({ y, line, layout, color, systemType, standard }: {
  y: number; line: LineData; layout: { items: Item[]; total: number }; color: string; systemType: 'FORWARD' | 'CIRCULATED'; standard: 'DIN' | 'SMS';
}) {
  const startX = labelPad + 6;
  const endX = layout.total - 6;
  return (
    <g>
      <LineLabel x={20} y={y} name={line.name} capacity={line.capacity} dn={line.dn} color={color} />
      <line x1={startX} y1={y} x2={endX} y2={y} stroke={color} strokeWidth="3" strokeDasharray="6 4" />
      {layout.items.map((it) => {
        switch (it.id) {
          case 'inlet-arrow':
            return (
              <g key={it.id}>
                <FlowArrow cx={it.cx} cy={y} color={color} direction="right" size={5} />
                <text x={it.cx - 6} y={y + 12} fontSize="6.5" fill={PID_COLORS.muted}>process</text>
              </g>
            );
          case 'flowmeter':
            return <FlowMeter key={it.id} cx={it.cx} cy={y} size={line.dn ?? undefined} />;
          case 'conductivity':
            return (
              <g key={it.id}>
                <line x1={it.cx} y1={y} x2={it.cx} y2={y - 16} stroke={color} strokeWidth="1" />
                <InstrumentBubble cx={it.cx} cy={y - 26} topText="QT" bottomText="JUMO" type="local" r={10} />
              </g>
            );
          case 'pump':
            return (
              <HygienicPump
                key={it.id}
                cx={it.cx}
                cy={y}
                label="Pompa"
                subLabel={line.pumpModel ? `${line.pumpModel}${line.pumpKw ? ` · ${line.pumpKw}kW` : ''}` : undefined}
              />
            );
          case 'return-valve':
            return <SquareValve key={it.id} cx={it.cx} cy={y} color={color} label="ESV" />;
          case 'return-arrow':
            return (
              <g key={it.id}>
                <FlowArrow cx={it.cx} cy={y} color={color} direction="right" size={6} />
                <text x={it.cx - 6} y={y + 12} fontSize="6.5" fill={color}>
                  {systemType === 'CIRCULATED' ? '↻ tank' : 'recovery'}
                </text>
              </g>
            );
        }
        return null;
      })}
      <text x={startX + 2} y={y - 4} fontSize="6.5" fill={PID_COLORS.muted}>{standard}</text>
    </g>
  );
}
