import {
  PID_COLORS,
  InstrumentBubble,
  ButterflyValve,
  SingleSeatValve,
  CheckValve,
  HygienicPump,
  InlineFilter,
  Degazor,
  PlateHeatExchanger,
  MilkClarifier,
  FlowMeter,
  SamplingValve,
  Tanker,
  FlowArrow,
} from './pidSymbols';

type LineData = {
  name: string;
  capacity: number;
  dn: string | null;
  pumpModel: string | null;
  pumpKw: number | null;
  filterUnitCount: number;
  pressureMeterType: 'MANOMETER' | 'PRESSURE_TRANSMITTER';
  hasMilkClarifier: boolean;
  clarifierBypassValveType: 'SW44' | 'SW41' | null;
  hasPhe: boolean;
  pheCapacity: number | null;
  pheIceWaterTempSensorType: 'PT100' | 'THERMOMETER' | null;
  pheIceWaterPressureMeterType: 'MANOMETER' | 'PRESSURE_TRANSMITTER' | null;
  hasSamplingValve: boolean;
  samplingValveType: 'MANUAL' | 'WITH_ACTUATOR' | null;
};

type TankerCip = {
  capacity: number | null;
  pressure: number | null;
  hasPump: boolean;
  dn: string | null;
};

interface Props {
  standard: 'DIN' | 'SMS';
  waterInletSize: string;
  fixedSmallSize: string;
  lines: LineData[];
  tankerCip: TankerCip | null;
}

// === Sembol genişlikleri (her bileşenin yatayda kapladığı net alan) ===
const W = {
  tanker: 80,
  inletValve: 30,
  degazor: 90,
  outletValve: 30,
  pump: 36,
  filter: 30,
  preFilter: 28,
  postFilter: 28,
  ptBetween: 24,    // basınç ölçer iki filter arası
  clarifier: 50,
  phe: 80,
  pt100: 26,
  flowMeter: 32,
  sampling: 28,
  outlet: 22,
  check: 22,
};

export function MilkReceptionSchematic({
  waterInletSize,
  fixedSmallSize,
  lines,
  tankerCip,
}: Props) {
  if (lines.length === 0 && !tankerCip) {
    return (
      <p className="text-sm text-slate-500 italic">
        Diyagram için hat veya Tanker CIP tanımlı değil.
      </p>
    );
  }

  const labelPad = 160;
  const symbolGap = 8;
  const lineGap = 180;        // hatlar arası dikey mesafe — degazör üstündeki bubble'lar için yeterli
  const topPad = 50;          // üst başlık + Water Inlet rozeti için
  const bottomPad = 60;       // alt lejant için
  const processColor = PID_COLORS.process;
  const cipColor = PID_COLORS.cip;

  // Her hat için sembol pozisyon listesi hesapla
  function buildPositions(line: LineData) {
    const items: { id: string; cx: number; width: number; data?: unknown }[] = [];
    let cursor = labelPad + 10;

    const push = (id: string, width: number, data?: unknown) => {
      items.push({ id, cx: cursor + width / 2, width, data });
      cursor += width + symbolGap;
    };

    push('tanker', W.tanker);
    push('inlet-valve', W.inletValve);
    push('degazor', W.degazor);
    push('outlet-esv', W.outletValve);
    push('pump', W.pump);

    // İlk filter unit: önce basınç ölçer, sonra filter, sonra basınç ölçer
    push('pm-pre-1', W.preFilter);
    push('filter-1', W.filter);
    push('pm-post-1', W.postFilter);
    // Çift unit varsa: ikinci filter (arada PM)
    if (line.filterUnitCount === 2) {
      push('filter-2', W.filter);
      push('pm-post-2', W.postFilter);
    }
    if (line.hasMilkClarifier) push('clarifier', W.clarifier);
    if (line.hasPhe) push('phe', W.phe);
    if (line.hasSamplingValve) push('sampling', W.sampling);
    push('pt100', W.pt100);
    push('flowmeter', W.flowMeter);
    push('outlet', W.outlet);

    return { items, totalWidth: cursor };
  }

  function buildTankerCipPositions() {
    const items: { id: string; cx: number; width: number }[] = [];
    let cursor = labelPad + 10;
    const push = (id: string, width: number) => {
      items.push({ id, cx: cursor + width / 2, width });
      cursor += width + symbolGap;
    };
    push('tanker', W.tanker);
    push('inlet-valve', W.inletValve);
    push('degazor', W.degazor);
    push('outlet-esv', W.outletValve);
    if (tankerCip?.hasPump) push('pump', W.pump);
    push('check', W.check);
    push('outlet', W.outlet);
    return { items, totalWidth: cursor };
  }

  const layouts = lines.map(buildPositions);
  const tankerLayout = tankerCip ? buildTankerCipPositions() : null;

  const totalLines = lines.length + (tankerCip ? 1 : 0);
  const maxWidth = Math.max(
    ...layouts.map((l) => l.totalWidth),
    tankerLayout?.totalWidth ?? 0,
    700,
  );
  const totalHeight = topPad + totalLines * lineGap + bottomPad;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${maxWidth + 30} ${totalHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto"
      >
        {/* Üst başlık şeridi — Water Inlet rozeti */}
        <g transform={`translate(${labelPad + 10}, 10)`}>
          <rect x="0" y="0" width="260" height="26" rx="4" fill="#eff6ff" stroke="#3b82f6" strokeWidth="1.2" />
          <text x="10" y="16" fontSize="10" fill="#1e40af" fontWeight="600">
            Water Inlet (modül)
          </text>
          <text x="10" y="24" fontSize="8" fill="#1e40af">
            SW-CIP41 · {waterInletSize}
          </text>
        </g>

        {/* Süt alım hatları */}
        {lines.map((line, idx) => {
          const y = topPad + lineGap / 2 + idx * lineGap;
          const layout = layouts[idx];
          return (
            <ReceptionLineRow
              key={idx}
              y={y}
              line={line}
              layout={layout}
              labelPad={labelPad}
              processColor={processColor}
              cipColor={cipColor}
              fixedSmallSize={fixedSmallSize}
            />
          );
        })}

        {/* Tanker CIP */}
        {tankerCip && tankerLayout && (
          <TankerCipRow
            y={topPad + lineGap / 2 + lines.length * lineGap}
            tankerCip={tankerCip}
            layout={tankerLayout}
            labelPad={labelPad}
            fixedSmallSize={fixedSmallSize}
          />
        )}

        {/* Alt lejant */}
        <g transform={`translate(15, ${totalHeight - 42})`}>
          <rect x="0" y="0" width={maxWidth} height="32" fill="#f8fafc" stroke="#e2e8f0" rx="3" />
          <g transform="translate(8, 9)">
            {/* Süt (Process) hattı */}
            <line x1="0" y1="6" x2="22" y2="6" stroke={processColor} strokeWidth="2.5" />
            <text x="28" y="9" fontSize="8" fill="#334155">Süt (Process)</text>
            {/* CIP/Su hattı */}
            <line x1="110" y1="6" x2="132" y2="6" stroke={cipColor} strokeWidth="2.5" strokeDasharray="4 3" />
            <text x="138" y="9" fontSize="8" fill="#334155">CIP / Su</text>
            {/* Hava hattı */}
            <line x1="195" y1="6" x2="217" y2="6" stroke={PID_COLORS.air} strokeWidth="2" strokeDasharray="1 2" />
            <text x="223" y="9" fontSize="8" fill="#334155">Hava</text>
            {/* Vana — yuvarlak */}
            <circle cx="265" cy="6" r="5.5" fill="white" stroke={processColor} strokeWidth="1.8" />
            <text x="275" y="9" fontSize="8" fill="#334155">Vana</text>
            {/* Pompa — üçgen ok */}
            <polygon points="313,-1 313,13 321,6" fill="white" stroke="#334155" strokeWidth="1.8" />
            <text x="327" y="9" fontSize="8" fill="#334155">Pompa</text>
            {/* Sensör/Ölçer — yuvarlak + yatay çizgi */}
            <circle cx="378" cy="6" r="5.5" fill="white" stroke="#334155" strokeWidth="1.4" />
            <line x1="372.5" y1="6" x2="383.5" y2="6" stroke="#334155" strokeWidth="0.9" />
            <text x="388" y="9" fontSize="8" fill="#334155">Sensör / Ölçer</text>
            {/* Check valve — yuvarlak + dolu merkez */}
            <circle cx="460" cy="6" r="5.5" fill="white" stroke={processColor} strokeWidth="1.8" />
            <circle cx="460" cy="6" r="2.2" fill={processColor} />
            <text x="470" y="9" fontSize="8" fill="#334155">Check valve (VPN)</text>
          </g>
          <text x={maxWidth - 8} y="20" fontSize="8" fill={PID_COLORS.muted} textAnchor="end">
            APV P&ID sembol seti
          </text>
        </g>
      </svg>
    </div>
  );
}

// === Süt alım hattı satırı ===
function ReceptionLineRow({
  y,
  line,
  layout,
  labelPad,
  processColor,
  cipColor,
  fixedSmallSize,
}: {
  y: number;
  line: LineData;
  layout: { items: { id: string; cx: number; width: number }[]; totalWidth: number };
  labelPad: number;
  processColor: string;
  cipColor: string;
  fixedSmallSize: string;
}) {
  const lineStartX = labelPad;
  const lineEndX = layout.totalWidth - 6;
  const pmLabel = line.pressureMeterType === 'PRESSURE_TRANSMITTER' ? 'PT' : 'M';
  const pmType = line.pressureMeterType === 'PRESSURE_TRANSMITTER' ? ('local' as const) : ('local' as const);

  return (
    <g>
      {/* Sol etiket — hat adı + kapasite + DN */}
      <text x={lineStartX - 8} y={y - 4} fontSize="10" fill="#0f172a" fontWeight="700" textAnchor="end">
        {line.name}
      </text>
      <text x={lineStartX - 8} y={y + 8} fontSize="8" fill={PID_COLORS.muted} textAnchor="end">
        {line.capacity > 0 ? `${line.capacity.toLocaleString('tr-TR')} L/h` : '— L/h'}
      </text>
      {line.dn && (
        <text x={lineStartX - 8} y={y + 19} fontSize="8" fill="#0f172a" textAnchor="end" fontWeight="600">
          ⌀ {line.dn}
        </text>
      )}

      {/* Process ana hattı — turuncu */}
      <line x1={lineStartX} y1={y} x2={lineEndX} y2={y} stroke={processColor} strokeWidth="3" />

      {/* Akış yönü oku — hattın ortasında */}
      <FlowArrow cx={lineStartX + 60} cy={y} color={processColor} direction="right" size={4} />

      {layout.items.map((it) => {
        switch (it.id) {
          case 'tanker':
            return (
              <g key={it.id}>
                <Tanker cx={it.cx} cy={y - 22} width={W.tanker} />
                <text x={it.cx} y={y + 18} fontSize="6.5" textAnchor="middle" fill={PID_COLORS.muted}>
                  Tanker / Süt girişi
                </text>
              </g>
            );
          case 'inlet-valve':
            return <ButterflyValve key={it.id} cx={it.cx} cy={y} color={processColor} actuated label="ESV" />;
          case 'degazor':
            return (
              <Degazor
                key={it.id}
                cx={it.cx}
                cy={y - 12}
                width={W.degazor}
                exhaustValveLabel={`ESV ${fixedSmallSize}`}
              />
            );
          case 'outlet-esv':
            return <ButterflyValve key={it.id} cx={it.cx} cy={y} color={processColor} actuated label="ESV outlet" />;
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
          case 'pm-pre-1':
          case 'pm-post-1':
          case 'pm-post-2': {
            // Hat üzerinden yukarı bubble bağlantısı
            return (
              <g key={it.id}>
                <line x1={it.cx} y1={y} x2={it.cx} y2={y - 18} stroke={processColor} strokeWidth="1" />
                <InstrumentBubble cx={it.cx} cy={y - 28} topText={pmLabel} type={pmType} r={10} />
              </g>
            );
          }
          case 'filter-1':
          case 'filter-2': {
            const micron = it.id === 'filter-1' ? '500 µ' : '200 µ';
            return <InlineFilter key={it.id} cx={it.cx} cy={y + 8} label={micron} />;
          }
          case 'clarifier':
            return (
              <MilkClarifier
                key={it.id}
                cx={it.cx}
                cy={y - 4}
                bypassLabel={line.clarifierBypassValveType ?? undefined}
              />
            );
          case 'phe':
            return (
              <PlateHeatExchanger
                key={it.id}
                cx={it.cx}
                cy={y}
                width={W.phe}
                label="PHE"
                capacity={line.pheCapacity}
              />
            );
          case 'sampling':
            return (
              <SamplingValve
                key={it.id}
                cx={it.cx}
                cy={y}
                color={processColor}
                isActuated={line.samplingValveType === 'WITH_ACTUATOR'}
              />
            );
          case 'pt100':
            return (
              <g key={it.id}>
                <line x1={it.cx} y1={y} x2={it.cx} y2={y - 16} stroke={processColor} strokeWidth="1" />
                <InstrumentBubble cx={it.cx} cy={y - 26} topText="TT" bottomText="100" type="local" r={10} />
              </g>
            );
          case 'flowmeter':
            return <FlowMeter key={it.id} cx={it.cx} cy={y} size={line.dn ?? undefined} />;
          case 'outlet':
            return (
              <g key={it.id}>
                <FlowArrow cx={it.cx} cy={y} color={processColor} direction="right" size={6} />
                <text x={it.cx + 4} y={y + 12} fontSize="6.5" fill={PID_COLORS.muted}>çıkış</text>
              </g>
            );
        }
        return null;
      })}

      {/* PHE ice water bağlantısı — PHE'nin altından modül seviyesindeki ice water/CIP'a inen kesikli hat */}
      {line.hasPhe &&
        (() => {
          const phePos = layout.items.find((p) => p.id === 'phe');
          if (!phePos) return null;
          // PHE'nin altından kısa bir CIP bağlantı sembolü
          return (
            <g>
              <text x={phePos.cx - 22} y={y + 60} fontSize="6" fill={cipColor}>
                Ice water
              </text>
              <text x={phePos.cx - 22} y={y + 68} fontSize="6" fill={cipColor}>
                {line.pheIceWaterTempSensorType ?? 'sensör?'}
              </text>
            </g>
          );
        })()}
    </g>
  );
}

// === Tanker CIP satırı ===
function TankerCipRow({
  y,
  tankerCip,
  layout,
  labelPad,
  fixedSmallSize,
}: {
  y: number;
  tankerCip: TankerCip;
  layout: { items: { id: string; cx: number; width: number }[]; totalWidth: number };
  labelPad: number;
  fixedSmallSize: string;
}) {
  const lineStartX = labelPad;
  const lineEndX = layout.totalWidth - 6;
  const cipColor = PID_COLORS.cip;

  return (
    <g>
      <text x={lineStartX - 8} y={y - 4} fontSize="10" fill="#6b21a8" fontWeight="700" textAnchor="end">
        Tanker CIP
      </text>
      <text x={lineStartX - 8} y={y + 8} fontSize="8" fill="#a78bfa" textAnchor="end">
        {tankerCip.capacity ? `${tankerCip.capacity.toLocaleString('tr-TR')} L/h` : '— L/h'}
      </text>
      {tankerCip.dn && (
        <text x={lineStartX - 8} y={y + 19} fontSize="8" fill="#6b21a8" textAnchor="end" fontWeight="600">
          ⌀ {tankerCip.dn}
        </text>
      )}

      {/* CIP hattı — mavi kesikli */}
      <line x1={lineStartX} y1={y} x2={lineEndX} y2={y} stroke={cipColor} strokeWidth="3" strokeDasharray="6 4" />
      <FlowArrow cx={lineStartX + 60} cy={y} color={cipColor} direction="right" size={4} />

      {layout.items.map((it) => {
        switch (it.id) {
          case 'tanker':
            return (
              <g key={it.id}>
                <Tanker cx={it.cx} cy={y - 22} width={W.tanker} />
                <text x={it.cx} y={y + 18} fontSize="6.5" textAnchor="middle" fill={PID_COLORS.muted}>
                  Tanker CIP
                </text>
              </g>
            );
          case 'inlet-valve':
            return <SingleSeatValve key={it.id} cx={it.cx} cy={y} color={cipColor} actuated label="SW41" />;
          case 'degazor':
            return (
              <Degazor
                key={it.id}
                cx={it.cx}
                cy={y - 12}
                width={W.degazor}
                exhaustValveLabel={`ESV ${fixedSmallSize}`}
              />
            );
          case 'outlet-esv':
            return <ButterflyValve key={it.id} cx={it.cx} cy={y} color={cipColor} actuated label="ESV outlet" />;
          case 'pump':
            return <HygienicPump key={it.id} cx={it.cx} cy={y} label="CIP Pompa" />;
          case 'check':
            return <CheckValve key={it.id} cx={it.cx} cy={y} color={cipColor} label="VPN" />;
          case 'outlet':
            return (
              <g key={it.id}>
                <FlowArrow cx={it.cx} cy={y} color={cipColor} direction="right" size={6} />
                <text x={it.cx + 4} y={y + 12} fontSize="6.5" fill={PID_COLORS.muted}>çıkış</text>
              </g>
            );
        }
        return null;
      })}
    </g>
  );
}
