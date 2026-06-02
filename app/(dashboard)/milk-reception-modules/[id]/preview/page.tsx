import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { calculatePipeDiameter } from '@/lib/calc/pipeDiameter';
import { selectDN, getOneSizeSmallerDN } from '@/lib/calc/selectDN';
import { formatDate } from '@/lib/utils';
import { MilkReceptionSchematic } from '@/components/milk-reception/MilkReceptionSchematic';
import { buildMilkReceptionPricing, summarizeMilkReceptionPricing } from '@/lib/pricing/milkReceptionPricing';
import { getCustomPricingItems } from '@/lib/pricing/customCatalogServer';
import { EditablePricingCard, type PricingRowView } from '@/components/pricing/EditablePricingCard';
import { createRowKeyer } from '@/lib/pricing/rowKey';

type Props = { params: Promise<{ id: string }> };

const CONTROL_UNIT_LABELS: Record<string, string> = {
  NONE: 'Yok (Pnömatik / Aktüatör)',
  AS_I: 'AS-i',
  DC: 'DC',
};

const PRESSURE_METER_LABELS: Record<string, string> = {
  MANOMETER: 'Manometer (Manuel)',
  PRESSURE_TRANSMITTER: 'Pressure Transmitter',
};

const SAMPLING_LABELS: Record<string, string> = {
  MANUAL: 'Manuel',
  WITH_ACTUATOR: 'Aktüatörlü',
};

const PHE_TEMP_LABELS: Record<string, string> = {
  PT100: 'PT100',
  THERMOMETER: 'Termometre',
};

export default async function MilkReceptionPreviewPage({ params }: Props) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const user = session!.user;

  const mod = await prisma.milkReceptionModule.findUnique({
    where: { id },
    include: {
      creator: { select: { name: true } },
      receptionLines: { orderBy: { order: 'asc' } },
    },
  });
  if (!mod) notFound();
  if (user.role === 'MEMBER' && mod.creatorId !== user.id) notFound();

  const standard = mod.standard;
  const lineCount = mod.receptionLines.length;

  // Her hat için çap hesabı (V=2)
  const lineCalcs = mod.receptionLines.map((line) => {
    if (!line.capacity || line.capacity <= 0) {
      return { lineId: line.id, dn: null as string | null, inner: null as number | null, raw: null as number | null };
    }
    const d = calculatePipeDiameter({ capacityLh: line.capacity, velocity: 2.0 });
    try {
      const sel = selectDN(d.diameterMm, standard);
      return { lineId: line.id, dn: sel.dn, inner: sel.inner, raw: d.diameterMm };
    } catch {
      return { lineId: line.id, dn: null, inner: null, raw: d.diameterMm };
    }
  });

  // Tanker CIP çap hesabı
  let tankerCipCalc: { dn: string | null; inner: number | null; raw: number | null } | null = null;
  if (mod.hasTankerCip && mod.tankerCipCapacity && mod.tankerCipCapacity > 0) {
    const d = calculatePipeDiameter({ capacityLh: mod.tankerCipCapacity, velocity: 2.0 });
    try {
      const sel = selectDN(d.diameterMm, standard);
      tankerCipCalc = { dn: sel.dn, inner: sel.inner, raw: d.diameterMm };
    } catch {
      tankerCipCalc = { dn: null, inner: null, raw: d.diameterMm };
    }
  }

  // Sabit air exhaust / drain çapı (DN25 veya 25 SMS — standarta göre)
  const fixedSmallSize = standard === 'DIN' ? 'DN25' : '25 SMS (1")';

  // === Vana özeti (sabit + opsiyonel) ===
  // Her hatta sabit: Degazör Air Exhaust ESV (DN25/25 SMS) + Butterfly Outlet ESV (hat çapı) + 4 ESV filter unit başına + (varsa) clarifier bypass + (varsa) PHE 2 ESV (kontrol + manuel) + (varsa) sampling
  // Modül düzeyinde sabit: Water Inlet SW-CIP41 (en büyük hat çapı)
  // Tanker CIP varsa: Air Exhaust ESV (DN25/25 SMS) + Butterfly Outlet ESV (CIP çapı) + Check Valve VPN (CIP çapı)
  const valveCount = {
    esvSmall: 0,
    esvLine: new Map<string, number>(), // size → count
    swCip41Module: 0,
    swCip41ModuleSize: '—',
    clarifierBypass: { sw44: 0, sw41: 0, size: new Map<string, string>() },
    samplingManual: 0,
    samplingActuator: 0,
    tankerCipEsvSmall: 0,
    tankerCipEsvLine: 0,
    tankerCipEsvLineSize: '—',
    tankerCipVpn: 0,
    tankerCipVpnSize: '—',
  };

  const flowMeterPerLine: { lineId: string; size: string | null }[] = [];
  const tempSensorPerLine = lineCount; // PT100 sabit her hatta 1

  for (const line of mod.receptionLines) {
    const calc = lineCalcs.find((c) => c.lineId === line.id);
    const lineSize = calc?.dn ?? '—';

    // Flow meter hat çapından bir size küçük seçilir.
    const flowMeterSize = calc?.dn ? getOneSizeSmallerDN(calc.dn, standard) : null;
    flowMeterPerLine.push({ lineId: line.id, size: flowMeterSize });

    // Degazör air exhaust ESV (DN25/25SMS)
    valveCount.esvSmall += 1;
    // Butterfly outlet ESV (hat çapı)
    valveCount.esvLine.set(lineSize, (valveCount.esvLine.get(lineSize) ?? 0) + 1);

    // Filter unit: her unit içinde 4 ESV kelebek vana
    valveCount.esvLine.set(lineSize, (valveCount.esvLine.get(lineSize) ?? 0) + 4 * line.filterUnitCount);

    // Clarifier bypass
    if (line.hasMilkClarifier && line.clarifierBypassValveType) {
      if (line.clarifierBypassValveType === 'SW44') valveCount.clarifierBypass.sw44 += 1;
      else valveCount.clarifierBypass.sw41 += 1;
      const key = line.clarifierBypassValveType;
      const existing = valveCount.clarifierBypass.size.get(key);
      valveCount.clarifierBypass.size.set(key, existing && existing !== lineSize ? 'çeşitli' : lineSize);
    }

    // PHE: 2 ESV (kontrol + manuel) — hat çapından bir size büyük gerektiriyor (PDF: "İkisi de bir size büyük")
    if (line.hasPhe) {
      // Bir size büyük seçimi — şimdilik aynı çapla kayıt; preview'da not düşeceğim
      valveCount.esvLine.set(lineSize, (valveCount.esvLine.get(lineSize) ?? 0) + 2);
    }

    // Sampling
    if (line.hasSamplingValve) {
      if (line.samplingValveType === 'MANUAL') valveCount.samplingManual += 1;
      else if (line.samplingValveType === 'WITH_ACTUATOR') valveCount.samplingActuator += 1;
    }
  }

  // En büyük hat çapı (Water Inlet SW-CIP41 için)
  const largestSize = lineCalcs
    .filter((c) => c.dn)
    .sort((a, b) => (b.inner ?? 0) - (a.inner ?? 0))[0]?.dn ?? '—';
  valveCount.swCip41Module = 1;
  valveCount.swCip41ModuleSize = largestSize;

  // Tanker CIP sabitleri
  if (mod.hasTankerCip) {
    valveCount.tankerCipEsvSmall = 1; // Air exhaust
    valveCount.tankerCipEsvLine = 1; // Butterfly outlet
    valveCount.tankerCipEsvLineSize = tankerCipCalc?.dn ?? '—';
    valveCount.tankerCipVpn = 1;
    valveCount.tankerCipVpnSize = tankerCipCalc?.dn ?? '—';
  }

  // === Diğer Ekipmanlar ===
  type EquipmentRow = { category: string; name: string; spec: string; quantity: number };
  const equipment: EquipmentRow[] = [];

  // Modül seviyesi
  if (lineCount > 0) {
    equipment.push({
      category: 'Modül',
      name: 'CIP Paneli',
      spec: 'Proximity switch içerir',
      quantity: lineCount,
    });
  }

  // Her hat için sabit
  if (lineCount > 0) {
    equipment.push({ category: 'Hat Sabit', name: 'Degazör', spec: 'Yatay tank', quantity: lineCount });
    equipment.push({ category: 'Hat Sabit', name: 'LSH Seviye Sensörü', spec: '—', quantity: lineCount });
    equipment.push({ category: 'Hat Sabit', name: 'LSL Seviye Sensörü', spec: '—', quantity: lineCount });
    equipment.push({ category: 'Hat Sabit', name: 'PT100 Sıcaklık Sensörü', spec: 'Hat üzeri', quantity: lineCount });

    // Flow meter — çap bazında grupla
    const fmGroups = new Map<string, number>();
    for (const f of flowMeterPerLine) {
      const key = f.size ?? '—';
      fmGroups.set(key, (fmGroups.get(key) ?? 0) + 1);
    }
    fmGroups.forEach((count, size) => {
      equipment.push({
        category: 'Hat Sabit',
        name: 'Flow Meter (Krohne, electromagnetic)',
        spec: size,
        quantity: count,
      });
    });

    // Süt Alım Pompaları — kalan model bilgileriyle
    for (const line of mod.receptionLines) {
      if (line.pumpModel) {
        const spec = `${line.pumpModel}${line.pumpKw != null ? ` · ${line.pumpKw}kW` : ''}${line.pumpImpellerSize != null ? ` · ⌀${line.pumpImpellerSize}mm` : ''}`;
        equipment.push({ category: 'Pompalar', name: `Süt Alım Pompası — ${line.name}`, spec, quantity: 1 });
      }
    }
  }

  // Filter unit madyaları
  let filter500Count = 0;
  let filter200Count = 0;
  let pmManometerCount = 0;
  let pmTransmitterCount = 0;
  for (const line of mod.receptionLines) {
    // Her unit = 2 filtre madyası
    filter500Count += 2; // her hatta en az 1 unit (500µ)
    if (line.filterUnitCount === 2) filter200Count += 2;
    // Basınç ölçer: 1 unit → 2 adet, 2 unit → 3 adet
    const pmCount = line.filterUnitCount === 1 ? 2 : 3;
    if (line.pressureMeterType === 'MANOMETER') pmManometerCount += pmCount;
    else pmTransmitterCount += pmCount;
  }
  if (filter500Count > 0) equipment.push({ category: 'Filter Madya', name: 'Filtre Madyası 500 µ', spec: 'Filter unit içi', quantity: filter500Count });
  if (filter200Count > 0) equipment.push({ category: 'Filter Madya', name: 'Filtre Madyası 200 µ', spec: 'Filter unit içi', quantity: filter200Count });
  if (pmManometerCount > 0) equipment.push({ category: 'Basınç Ölçer', name: 'Manometer', spec: 'Filter ünite önü/arkası (manuel)', quantity: pmManometerCount });
  if (pmTransmitterCount > 0) equipment.push({ category: 'Basınç Ölçer', name: 'Pressure Transmitter', spec: 'Filter ünite önü/arkası', quantity: pmTransmitterCount });

  // Milk Clarifier
  const clarifierCount = mod.receptionLines.filter((l) => l.hasMilkClarifier).length;
  if (clarifierCount > 0) {
    equipment.push({ category: 'Opsiyonel', name: 'Milk Clarifier (Süt Berraklaştırıcı)', spec: 'Bypass vanası ile', quantity: clarifierCount });
  }

  // PHE
  const pheLines = mod.receptionLines.filter((l) => l.hasPhe);
  if (pheLines.length > 0) {
    equipment.push({ category: 'PHE', name: 'Plate Heat Exchanger', spec: 'Plakalı ısı değiştirici', quantity: pheLines.length });
    equipment.push({ category: 'PHE', name: 'PT100 (PHE çıkış sıcaklık)', spec: 'Süt sıcaklığı (sabit)', quantity: pheLines.length });
    equipment.push({ category: 'PHE', name: 'Termometre (Ice water dönüş)', spec: 'Sabit', quantity: pheLines.length });

    // Ice water giriş sıcaklık sensörü tipleri
    const iceTempPt100 = pheLines.filter((l) => l.pheIceWaterTempSensorType === 'PT100').length;
    const iceTempTherm = pheLines.filter((l) => l.pheIceWaterTempSensorType === 'THERMOMETER').length;
    if (iceTempPt100 > 0) equipment.push({ category: 'PHE', name: 'PT100 (Ice water giriş)', spec: '—', quantity: iceTempPt100 });
    if (iceTempTherm > 0) equipment.push({ category: 'PHE', name: 'Termometre (Ice water giriş)', spec: '—', quantity: iceTempTherm });

    // Ice water giriş basınç ölçer tipleri
    const icePmMan = pheLines.filter((l) => l.pheIceWaterPressureMeterType === 'MANOMETER').length;
    const icePmPt = pheLines.filter((l) => l.pheIceWaterPressureMeterType === 'PRESSURE_TRANSMITTER').length;
    if (icePmMan > 0) equipment.push({ category: 'PHE', name: 'Manometer (Ice water giriş basınç)', spec: 'Manuel', quantity: icePmMan });
    if (icePmPt > 0) equipment.push({ category: 'PHE', name: 'Pressure Transmitter (Ice water giriş)', spec: '—', quantity: icePmPt });
  }

  // Sampling
  if (valveCount.samplingManual > 0)
    equipment.push({ category: 'Opsiyonel', name: 'Numune Vanası (Manuel)', spec: '—', quantity: valveCount.samplingManual });
  if (valveCount.samplingActuator > 0)
    equipment.push({ category: 'Opsiyonel', name: 'Numune Vanası (Aktüatörlü)', spec: 'Pnömatik', quantity: valveCount.samplingActuator });

  // Tanker CIP
  if (mod.hasTankerCip) {
    equipment.push({ category: 'Tanker CIP', name: 'Degazör', spec: 'Yatay tank', quantity: 1 });
    equipment.push({ category: 'Tanker CIP', name: 'LSH Seviye Sensörü', spec: '—', quantity: 1 });
    equipment.push({ category: 'Tanker CIP', name: 'LSL Seviye Sensörü', spec: '—', quantity: 1 });
    if (mod.tankerCipPumpModel) {
      const spec = `${mod.tankerCipPumpModel}${mod.tankerCipPumpKw != null ? ` · ${mod.tankerCipPumpKw}kW` : ''}${mod.tankerCipPumpImpellerSize != null ? ` · ⌀${mod.tankerCipPumpImpellerSize}mm` : ''}`;
      equipment.push({ category: 'Tanker CIP', name: 'CIP Pompası', spec, quantity: 1 });
    }
  }

  const equipmentTotal = equipment.reduce((s, e) => s + e.quantity, 0);

  // === Fiyatlandırma — sabit kimlikli ürünler için katalog eşleştirmesi ===
  const customItems = await getCustomPricingItems();
  const pricingRows = lineCount > 0 || mod.hasTankerCip ? buildMilkReceptionPricing({
    standard,
    controlUnit: (mod.valveControlUnit ?? 'AS_I') as 'NONE' | 'AS_I' | 'DC',
    fixedSmallSize,
    waterInletSize: largestSize,
    lines: mod.receptionLines.map((l) => ({
      name: l.name,
      dn: lineCalcs.find((c) => c.lineId === l.id)?.dn ?? null,
      filterUnitCount: (l.filterUnitCount === 2 ? 2 : 1) as 1 | 2,
      pressureMeterType: l.pressureMeterType,
      hasMilkClarifier: l.hasMilkClarifier,
      clarifierBypassValveType: l.clarifierBypassValveType,
      hasPhe: l.hasPhe,
      pheIceWaterTempSensorType: l.pheIceWaterTempSensorType,
      pheIceWaterPressureMeterType: l.pheIceWaterPressureMeterType,
      hasSamplingValve: l.hasSamplingValve,
      samplingValveType: l.samplingValveType,
      pumpModel: l.pumpModel,
    })),
    tankerCip: mod.hasTankerCip ? { hasPump: !!mod.tankerCipPumpModel, dn: tankerCipCalc?.dn ?? null, pumpModel: mod.tankerCipPumpModel } : null,
    customItems,
  }) : [];
  const pricingSummary = summarizeMilkReceptionPricing(pricingRows);

  const pricingKeyer = createRowKeyer();
  const pricingRowViews: PricingRowView[] = pricingRows.map((r) => ({
    key: pricingKeyer(r.category, r.description, r.size),
    category: r.category,
    description: r.description,
    subText: r.matchedItem
      ? `${r.matchedItem.eqNo} · ${r.matchedItem.techSpec.slice(0, 70)}`
      : r.reason,
    size: r.size,
    quantity: r.quantity,
    unitListPrice: r.matched ? r.unitPrice : null,
    baseUnitNet: r.matched ? r.unitNetPrice : null,
  }));

  return (
    <div className="max-w-6xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-5">
        <Link href="/modules" className="hover:text-slate-900">Modüller</Link>
        <span>/</span>
        <Link href={`/milk-reception-modules/${mod.id}`} className="hover:text-slate-900">{mod.name}</Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">Önizleme</span>
      </div>

      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-slate-900">Modül Özeti</h1>
        <Link href={`/milk-reception-modules/${mod.id}`}
          className="px-4 py-2 text-sm text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg">
          ← Düzenlemeye Dön
        </Link>
      </div>

      {/* Modül Bilgileri */}
      <Collapsible title="Modül Bilgileri" subtitle={mod.name} defaultOpen>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <Row label="Modül Adı" value={mod.name} />
          <Row label="Müşteri" value={mod.customerName ?? '—'} />
          <Row label="Proje Kodu" value={mod.projectCode ?? '—'} mono />
          <Row label="Standart" value={mod.standard} />
          <Row label="Vana Kontrol Ünitesi" value={CONTROL_UNIT_LABELS[mod.valveControlUnit] ?? mod.valveControlUnit} />
          <Row label="Hat Sayısı" value={String(lineCount)} />
          <Row label="Oluşturan" value={mod.creator.name} />
          <Row label="Tarih" value={formatDate(mod.createdAt)} />
        </div>
      </Collapsible>

      {/* Şematik Diyagram */}
      {(lineCount > 0 || mod.hasTankerCip) && (
        <Collapsible title="Şematik Diyagram" subtitle="P&ID görünümü" defaultOpen>
          <MilkReceptionSchematic
            standard={standard}
            waterInletSize={largestSize}
            fixedSmallSize={fixedSmallSize}
            lines={mod.receptionLines.map((l) => ({
              name: l.name,
              capacity: l.capacity,
              dn: lineCalcs.find((c) => c.lineId === l.id)?.dn ?? null,
              pumpModel: l.pumpModel,
              pumpKw: l.pumpKw,
              filterUnitCount: l.filterUnitCount,
              pressureMeterType: l.pressureMeterType,
              hasMilkClarifier: l.hasMilkClarifier,
              clarifierBypassValveType: l.clarifierBypassValveType,
              hasPhe: l.hasPhe,
              pheCapacity: l.pheCapacity,
              pheIceWaterTempSensorType: l.pheIceWaterTempSensorType,
              pheIceWaterPressureMeterType: l.pheIceWaterPressureMeterType,
              hasSamplingValve: l.hasSamplingValve,
              samplingValveType: l.samplingValveType,
            }))}
            tankerCip={
              mod.hasTankerCip
                ? {
                    capacity: mod.tankerCipCapacity,
                    pressure: mod.tankerCipPressure,
                    hasPump: !!mod.tankerCipPumpModel,
                    dn: tankerCipCalc?.dn ?? null,
                  }
                : null
            }
          />
        </Collapsible>
      )}

      {/* Sistem Sabitleri */}
      <Collapsible title="Sistem Sabitleri (Her modülde otomatik)">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs font-semibold text-slate-700 mb-2">Modül Düzeyinde</p>
            <ul className="space-y-1.5 text-slate-700">
              <li>Panel × <strong>{lineCount}</strong> <span className="text-[11px] text-slate-500">(hat sayısı kadar, proximity switch içerir)</span></li>
              <li>Water Inlet Vanası <strong>SW-CIP41</strong> <span className="text-[11px] text-slate-500 font-mono">({largestSize})</span></li>
            </ul>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs font-semibold text-slate-700 mb-2">Her Hat İçin Sabit</p>
            <ul className="space-y-1.5 text-slate-700">
              <li>Degazör + Air Exhaust Vana <strong>ESV</strong> <span className="text-[11px] text-slate-500 font-mono">({fixedSmallSize})</span></li>
              <li>LSH + LSL sensörleri</li>
              <li>Butterfly Outlet Vana <strong>ESV</strong> <span className="text-[11px] text-slate-500">(hat çapı)</span></li>
              <li>Flow Meter <strong>Krohne</strong> electromagnetic <span className="text-[11px] text-slate-500">(hat çapından 1 size küçük)</span></li>
              <li>Temperature Sensor <strong>PT100</strong></li>
            </ul>
          </div>
        </div>
      </Collapsible>

      {/* Süt Alım Hatları */}
      {mod.receptionLines.length > 0 && (
        <Collapsible title="Süt Alım Hatları" subtitle={`${lineCount} adet`} defaultOpen>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 font-medium text-slate-600">#</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">İsim</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">Kapasite</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">Basınç</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">Hesap. DN</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">Pompa</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">Filter</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">Basınç Ölçer</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">Clarifier</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">PHE</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-600">Sampling</th>
                </tr>
              </thead>
              <tbody>
                {mod.receptionLines.map((line, i) => {
                  const calc = lineCalcs.find((c) => c.lineId === line.id);
                  const pump = line.pumpModel
                    ? `${line.pumpModel}${line.pumpKw != null ? ` · ${line.pumpKw}kW` : ''}${line.pumpImpellerSize != null ? ` · ⌀${line.pumpImpellerSize}` : ''}`
                    : '—';
                  return (
                    <tr key={line.id} className="border-b border-slate-100">
                      <td className="py-2.5 px-2 text-slate-400">{i + 1}</td>
                      <td className="py-2.5 px-2 font-medium text-slate-800">{line.name}</td>
                      <td className="py-2.5 px-2 text-slate-700">{line.capacity > 0 ? `${line.capacity.toLocaleString('tr-TR')} L/h` : '—'}</td>
                      <td className="py-2.5 px-2 text-slate-700">{line.pressure > 0 ? `${line.pressure} Bar` : '—'}</td>
                      <td className="py-2.5 px-2 font-mono text-slate-700">{calc?.dn ?? '—'}</td>
                      <td className="py-2.5 px-2 text-xs text-slate-600">{pump}</td>
                      <td className="py-2.5 px-2 text-slate-700">
                        {line.filterUnitCount === 1 ? 'Tek (500µ)' : 'Çift (500+200µ)'}
                      </td>
                      <td className="py-2.5 px-2 text-xs text-slate-600">{PRESSURE_METER_LABELS[line.pressureMeterType]}</td>
                      <td className="py-2.5 px-2 text-xs text-slate-600">
                        {line.hasMilkClarifier ? `Var · ${line.clarifierBypassValveType ?? '—'}` : '—'}
                      </td>
                      <td className="py-2.5 px-2 text-xs text-slate-600">
                        {line.hasPhe
                          ? `Var${line.pheCapacity ? ` · ${line.pheCapacity.toLocaleString('tr-TR')} L/h` : ''}`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-2 text-xs text-slate-600">
                        {line.hasSamplingValve ? (SAMPLING_LABELS[line.samplingValveType ?? ''] ?? 'Var') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Çap hesabı V=2 m/s ile her hat için ayrı yapılır. Vanalar hat çapıyla aynı çaptadır.
            Filter unit başına 4 manuel ESV kelebek vana + 2 filtre. Basınç ölçer sayısı: 1 unit → 2 adet, 2 unit → 3 adet.
            PHE içindeki ESV kelebek vanalar (kontrol + manuel) <strong>bir size büyük</strong> seçilir.
          </p>
        </Collapsible>
      )}

      {/* PHE Detayları */}
      {mod.receptionLines.some((l) => l.hasPhe) && (
        <Collapsible title="PHE (Plate Heat Exchanger) Detayları">
          <div className="space-y-2">
            {mod.receptionLines.filter((l) => l.hasPhe).map((line) => (
              <div key={line.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-sm">
                <p className="font-semibold text-slate-800 mb-1">{line.name}</p>
                <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-slate-700">
                  <span>Kapasite: <strong>{line.pheCapacity ? `${line.pheCapacity.toLocaleString('tr-TR')} L/h` : '—'}</strong></span>
                  <span>Ice water sıcaklık sensörü: <strong>{line.pheIceWaterTempSensorType ? PHE_TEMP_LABELS[line.pheIceWaterTempSensorType] : '—'}</strong></span>
                  <span>Ice water basınç ölçer: <strong>{line.pheIceWaterPressureMeterType ? PRESSURE_METER_LABELS[line.pheIceWaterPressureMeterType] : '—'}</strong></span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Sabit: PHE çıkış PT100 (süt sıcaklığı) · Ice water dönüş termometresi · ESV kontrol kelebek vana + ESV sabit manuel kelebek vana (her ikisi bir size büyük).
                </p>
              </div>
            ))}
          </div>
        </Collapsible>
      )}

      {/* Tanker CIP */}
      <Collapsible title="Tanker CIP Station" subtitle={mod.hasTankerCip ? 'Var' : 'Yok'}>
        {mod.hasTankerCip ? (
          <>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-3">
              <Row label="Kapasite" value={mod.tankerCipCapacity ? `${mod.tankerCipCapacity.toLocaleString('tr-TR')} L/h` : '—'} />
              <Row label="Basınç" value={mod.tankerCipPressure ? `${mod.tankerCipPressure} Bar` : '—'} />
              <Row label="Hesaplanan CIP Boru Çapı" value={tankerCipCalc?.dn ?? '—'} mono />
              <Row label="Pompa Modeli" value={mod.tankerCipPumpModel ?? '—'} />
              <Row label="Pompa kW" value={mod.tankerCipPumpKw != null ? `${mod.tankerCipPumpKw} kW` : '—'} />
              <Row label="Impeller" value={mod.tankerCipPumpImpellerSize != null ? `${mod.tankerCipPumpImpellerSize} mm` : '—'} />
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs text-slate-700">
              <p className="font-semibold text-slate-700 mb-1">Sabit Bileşenler</p>
              <ul className="space-y-0.5">
                <li>Degazör + Air Exhaust <strong>ESV</strong> ({fixedSmallSize})</li>
                <li>LSH + LSL sensörleri</li>
                <li>Butterfly Outlet <strong>ESV</strong> ({tankerCipCalc?.dn ?? '—'})</li>
                <li>Check Valve <strong>VPN</strong> ({tankerCipCalc?.dn ?? '—'})</li>
              </ul>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500 italic">Tanker CIP bu modülde seçilmemiş.</p>
        )}
      </Collapsible>

      {/* Vana Özeti */}
      {lineCount > 0 && (
        <Collapsible title="Vana Özeti (sayım)">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-y border-slate-200">
              <tr>
                <th className="py-2 px-3 text-left text-xs font-semibold text-slate-700">Bileşen</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-slate-700">Tip</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-slate-700">Çap</th>
                <th className="py-2 px-3 text-right text-xs font-semibold text-slate-700 w-24">Adet</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-2 px-3 text-slate-700">Degazör Air Exhaust (her hat)</td>
                <td className="py-2 px-3 font-semibold">ESV</td>
                <td className="py-2 px-3 font-mono text-slate-600">{fixedSmallSize}</td>
                <td className="py-2 px-3 text-right font-mono">{valveCount.esvSmall}</td>
              </tr>
              {Array.from(valveCount.esvLine.entries()).map(([size, count]) => (
                <tr key={size} className="border-b border-slate-100">
                  <td className="py-2 px-3 text-slate-700">Hat üzeri (Outlet + Filter + PHE)</td>
                  <td className="py-2 px-3 font-semibold">ESV</td>
                  <td className="py-2 px-3 font-mono text-slate-600">{size}</td>
                  <td className="py-2 px-3 text-right font-mono">{count}</td>
                </tr>
              ))}
              <tr className="border-b border-slate-100">
                <td className="py-2 px-3 text-slate-700">Water Inlet (modül)</td>
                <td className="py-2 px-3 font-semibold">SW-CIP41</td>
                <td className="py-2 px-3 font-mono text-slate-600">{valveCount.swCip41ModuleSize}</td>
                <td className="py-2 px-3 text-right font-mono">{valveCount.swCip41Module}</td>
              </tr>
              {valveCount.clarifierBypass.sw44 > 0 && (
                <tr className="border-b border-slate-100">
                  <td className="py-2 px-3 text-slate-700">Clarifier Bypass</td>
                  <td className="py-2 px-3 font-semibold">SW44</td>
                  <td className="py-2 px-3 font-mono text-slate-600">{valveCount.clarifierBypass.size.get('SW44') ?? '—'}</td>
                  <td className="py-2 px-3 text-right font-mono">{valveCount.clarifierBypass.sw44}</td>
                </tr>
              )}
              {valveCount.clarifierBypass.sw41 > 0 && (
                <tr className="border-b border-slate-100">
                  <td className="py-2 px-3 text-slate-700">Clarifier Bypass</td>
                  <td className="py-2 px-3 font-semibold">SW41</td>
                  <td className="py-2 px-3 font-mono text-slate-600">{valveCount.clarifierBypass.size.get('SW41') ?? '—'}</td>
                  <td className="py-2 px-3 text-right font-mono">{valveCount.clarifierBypass.sw41}</td>
                </tr>
              )}
              {valveCount.samplingManual > 0 && (
                <tr className="border-b border-slate-100">
                  <td className="py-2 px-3 text-slate-700">Sampling (Manuel)</td>
                  <td className="py-2 px-3 font-semibold">Numune vanası</td>
                  <td className="py-2 px-3 font-mono text-slate-600">—</td>
                  <td className="py-2 px-3 text-right font-mono">{valveCount.samplingManual}</td>
                </tr>
              )}
              {valveCount.samplingActuator > 0 && (
                <tr className="border-b border-slate-100">
                  <td className="py-2 px-3 text-slate-700">Sampling (Aktüatörlü)</td>
                  <td className="py-2 px-3 font-semibold">Numune vanası</td>
                  <td className="py-2 px-3 font-mono text-slate-600">—</td>
                  <td className="py-2 px-3 text-right font-mono">{valveCount.samplingActuator}</td>
                </tr>
              )}
              {mod.hasTankerCip && (
                <>
                  <tr className="border-b border-slate-100 bg-purple-50/30">
                    <td className="py-2 px-3 text-slate-700">Tanker CIP — Air Exhaust</td>
                    <td className="py-2 px-3 font-semibold">ESV</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{fixedSmallSize}</td>
                    <td className="py-2 px-3 text-right font-mono">{valveCount.tankerCipEsvSmall}</td>
                  </tr>
                  <tr className="border-b border-slate-100 bg-purple-50/30">
                    <td className="py-2 px-3 text-slate-700">Tanker CIP — Butterfly Outlet</td>
                    <td className="py-2 px-3 font-semibold">ESV</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{valveCount.tankerCipEsvLineSize}</td>
                    <td className="py-2 px-3 text-right font-mono">{valveCount.tankerCipEsvLine}</td>
                  </tr>
                  <tr className="border-b border-slate-100 bg-purple-50/30">
                    <td className="py-2 px-3 text-slate-700">Tanker CIP — Check Valve</td>
                    <td className="py-2 px-3 font-semibold">VPN</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{valveCount.tankerCipVpnSize}</td>
                    <td className="py-2 px-3 text-right font-mono">{valveCount.tankerCipVpn}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
          <p className="text-[11px] text-slate-500 mt-3">
            Bu özet vana adetleri; katalog eşleştirmesi ve fiyatlandırma sonraki fazda eklenecektir. PHE içindeki 2 ESV bir size büyük seçilir — özet için hat çapıyla gruplandı.
          </p>
        </Collapsible>
      )}

      {/* Fiyatlandırma */}
      {pricingRows.length > 0 && (
        <EditablePricingCard
          saveUrl={`/api/milk-reception-modules/${mod.id}/pricing`}
          rows={pricingRowViews}
          initialOverrides={(mod.priceOverrides as Record<string, number> | null) ?? {}}
          initialMultiplier={mod.priceMultiplier ?? 1}
          matchedCount={pricingSummary.matched}
          footerNote={
            <>
              Net birim fiyat = Liste × (1 − İskonto). Fiyatlar yalnızca katalogda kesin karşılığı bulunan ürünler için
              otomatik hesaplanır (SV1 ESV, SW-CIP41, SW44/SW41, APV VPN, Krohne, IFM PT100, Bimethal, A300G.100, PI1700,
              EUROBINOX Y-Type & sampling, APV PRD20, DEGASIFIER, proximity switch). Karşılığı olmayanlar (Milk Clarifier,
              PHE, W+ pompalar) <strong>Düzenle</strong> ile elle fiyatlanabilir.
            </>
          }
        />
      )}

      {/* Diğer Ekipmanlar */}
      {equipment.length > 0 && (
        <Collapsible title="Diğer Ekipmanlar" subtitle={`${equipmentTotal} adet`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-700 w-32">Kategori</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-700">Ekipman</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-slate-700">Açıklama / Model</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-slate-700 w-24">Adet</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((e, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 px-3">
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                        {e.category}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-800">{e.name}</td>
                    <td className="py-2 px-3 text-xs text-slate-600">{e.spec}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800">{e.quantity}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-300">
                  <td colSpan={3} className="py-2 px-3 text-right text-xs font-semibold text-slate-700">Toplam</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">{equipmentTotal}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-[11px] text-slate-500 mt-3">
            Vanalar bu listede yer almaz — onlar için <strong>Vana Özeti</strong> kartına bakın. Burada paneller, sensörler, ölçerler, pompalar, filtre madyaları, ısı değiştirici ve diğer enstrümanlar listelenir.
          </p>
        </Collapsible>
      )}

      {lineCount === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
          Henüz süt alım hattı girilmemiş. Düzenleme sayfasında hat ekleyin.
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-slate-500">{label}: </span>
      <span className={`text-slate-800 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

interface CollapsibleProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Collapsible({ title, subtitle, children, defaultOpen = false }: CollapsibleProps) {
  return (
    <details {...(defaultOpen ? { open: true } : {})} className="group bg-white rounded-xl border border-slate-200 mb-4 overflow-hidden">
      <summary className="cursor-pointer select-none px-6 py-4 flex items-center justify-between hover:bg-slate-50 list-none">
        <div>
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</span>
          {subtitle && <span className="ml-3 text-xs text-slate-500">{subtitle}</span>}
        </div>
        <svg className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>
      <div className="px-6 pb-6 pt-1">{children}</div>
    </details>
  );
}
