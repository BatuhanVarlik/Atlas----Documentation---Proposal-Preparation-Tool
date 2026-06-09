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
  const lineGap = 64;                    // CIP (yukarı) / Drain (aşağı) dallarına dikey alan
  const lineStartY = tankAreaTop + tankH + 44;

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
              fixedLabels={['Lkg', 'Drain', 'CIP↩']}
              fixedSide="end"
              arrowDirection="right"
              branch
            />
          );
        })}

        {/* Boşaltım hatları */}
        {dischargeLines.map((line, idx) => {
          const y = lineStartY + (fillingLines.length + idx) * lineGap;
          // CIP geri dönüş vanası grubun en başında (Lkg ile yer değiştirildi)
          const labels = ['CIP→'];
          if (fixedDischargeValves === 3) labels.push('Su');
          labels.push('Lkg');
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
              branch
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
              // Drain'i sola al (pompa ile üst üste binmesin), Çek pompanın sağında kalsın
              fixedStartX={leftPad + tankAreaWidth}
              spacing={64}
              branch
              // Pompayı boşaltım hatlarıyla aynı X'e hizala → pompa çekvalften önce gelir (swap)
              pumpX={leftPad + tankAreaWidth + 32}
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
            <rect x="0.5" y="1.5" width="11" height="11" fill="white" stroke="#475569" strokeWidth="1.8" />
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
  branch = false,
  spacing = 22,
  pumpGap = 14,
  pumpX: pumpXOverride,
  fixedStartX,
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
  /** true ise: etiketinde "CIP" geçen vana ince hatla yukarı, "Drain" ince hatla aşağı taşınır */
  branch?: boolean;
  /** ardışık sabit vanalar arası yatay mesafe */
  spacing?: number;
  /** son sabit vana ile pompa arası yatay mesafe */
  pumpGap?: number;
  /** pompa X'ini doğrudan ver (hat bağımsız hizalama için; verilirse pumpGap yok sayılır) */
  pumpX?: number;
  /** ilk sabit vananın X'i (fixedSide varsayılan konumunu ezer) */
  fixedStartX?: number;
}) {
  const lineStartX = labelPad - 4;
  const tankAreaEnd = leftPad + tankAreaWidth;

  // Sabit vanalar hat boyunca yatay sırayla dizilir (branch ise CIP yukarı / Drain aşağı dallanır)
  const fixedAreaWidth = Math.max(fixedValves - 1, 0) * spacing;
  const startFixedX = labelPad + 18;
  const endFixedX = tankAreaEnd + 22;
  const fixedX = fixedStartX ?? (fixedSide === 'start' ? startFixedX : endFixedX);
  const fixedRightEdge = fixedX + fixedAreaWidth;

  const branchOffset = 20; // hat ile yukarı/aşağı taşınan vana merkezi arası dikey mesafe

  // CIP geri dönüş vanasının konumu (branch modunda yukarı taşınan "CIP" etiketli vana).
  // Bu vanadan tank altındaki vanalara ince mavi kesikli geri dönüş hattı çizilir.
  const cipReturnColor = '#2563eb';
  const cipReturnIdx = branch ? fixedLabels.slice(0, fixedValves).findIndex((l) => l.includes('CIP')) : -1;
  const cipReturnCx = cipReturnIdx >= 0 ? fixedX + cipReturnIdx * spacing : null;

  const pumpX = pumpXOverride ?? ((fixedSide === 'end' ? fixedRightEdge : tankAreaEnd + 18) + pumpGap);
  // Çizgi/ok hem pompayı hem de sabit vanaların en sağını (örn. pompadan sonraki Çek) geçmeli
  const lineEndX = hasPump
    ? Math.max(pumpX + 16, fixedSide === 'end' ? fixedRightEdge + 14 : 0)
    : (fixedSide === 'end' ? fixedRightEdge + 14 : tankAreaEnd + 26);

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

      {/* CIP geri dönüş hattı — CIP vanasından tank altındaki vanalara ince mavi kesikli dağıtım.
          Yatay başlık CIP vanası hizasında, her tank vanasına kısa düşüşle iner. */}
      {cipReturnCx != null && connectedCount > 0 && (() => {
        const vy = y - branchOffset;
        // Vanaya 45° eğik giriş: dikey düşüş kadar yatay kaydır → gri (dik) hatla üst üste binmez.
        const drop = (y - 5.5) - vy;
        const xs = Array.from({ length: connectedCount }, (_, i) => tankCenterX(i));
        const startXs = xs.map((tx) => tx - drop);
        const headerMin = Math.min(cipReturnCx, ...startXs);
        const headerMax = Math.max(cipReturnCx, ...startXs);
        return (
          <g>
            <line x1={headerMin} y1={vy} x2={headerMax} y2={vy} stroke={cipReturnColor} strokeWidth="1" strokeDasharray="3 2" />
            {xs.map((tx, i) => (
              <line key={`cipret-${i}`} x1={tx - drop} y1={vy} x2={tx} y2={y - 5.5} stroke={cipReturnColor} strokeWidth="1" strokeDasharray="3 2" />
            ))}
          </g>
        );
      })()}

      {/* Tank altlarındaki bağlantı vanaları — hat üzerinde */}
      {Array.from({ length: connectedCount }).map((_, i) => {
        const cx = tankCenterX(i);
        return <Valve key={i} cx={cx} cy={y} color={color} />;
      })}

      {/* Sabit vanalar — branch modunda "CIP" ince hatla yukarı, "Drain" ince hatla aşağı;
          diğerleri hat üzerinde. "Çek" check valve köşegenle ayırt edilir. */}
      {fixedLabels.slice(0, fixedValves).map((lbl, i) => {
        const cx = fixedX + i * spacing;
        const valveS = 4.5; // küçük vana yarı-kenarı (Valve small)

        // CIP → ince hatla yukarı, etiket vananın üstünde
        if (branch && lbl.includes('CIP')) {
          const vy = y - branchOffset;
          return (
            <g key={`fx-${i}`}>
              <line x1={cx} y1={y} x2={cx} y2={vy + valveS} stroke={color} strokeWidth="1.2" />
              <Valve cx={cx} cy={vy} color={color} small />
              <text x={cx} y={vy - 7} textAnchor="middle" fontSize="7" fill={color} fontWeight="600">
                {lbl}
              </text>
            </g>
          );
        }

        // Drain → ince hatla aşağı, etiket vananın altında
        if (branch && lbl === 'Drain') {
          const vy = y + branchOffset;
          return (
            <g key={`fx-${i}`}>
              <line x1={cx} y1={y} x2={cx} y2={vy - valveS} stroke={color} strokeWidth="1.2" />
              <Valve cx={cx} cy={vy} color={color} small />
              <text x={cx} y={vy + 14} textAnchor="middle" fontSize="7" fill={color} fontWeight="600">
                {lbl}
              </text>
            </g>
          );
        }

        // Hat üzerinde kalanlar (Lkg / Su / Çek)
        return (
          <g key={`fx-${i}`}>
            <Valve cx={cx} cy={y} color={color} small check={lbl === 'Çek'} />
            <text x={cx} y={y + 15} textAnchor="middle" fontSize="7" fill={color} fontWeight="600">
              {lbl}
            </text>
          </g>
        );
      })}

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

// Vana — kare (hat üzerinde). check=true ise sağ üst → sol alt köşegeniyle ayırt edilir.
function Valve({ cx, cy, color, small = false, check = false }: { cx: number; cy: number; color: string; small?: boolean; check?: boolean }) {
  const s = small ? 4.5 : 5.5;
  return (
    <g>
      <rect x={cx - s} y={cy - s} width={s * 2} height={s * 2} fill="white" stroke={color} strokeWidth="1.8" />
      {check && (
        <>
          {/* Köşegenin altında kalan alt-sağ üçgen dolu (akış yönü göstergesi) */}
          <polygon points={`${cx + s},${cy - s} ${cx + s},${cy + s} ${cx - s},${cy + s}`} fill={color} />
          <line x1={cx + s} y1={cy - s} x2={cx - s} y2={cy + s} stroke={color} strokeWidth="1.4" />
        </>
      )}
    </g>
  );
}
