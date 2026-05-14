'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useModuleBuilder, type FillingLineDraft, type DischargeLineDraft } from '@/store/moduleBuilderStore';
import FillingLineForm from './FillingLineForm';
import DischargeLineForm from './DischargeLineForm';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { PUMP_MODELS, getImpellersForPump, pumpHasImpeller } from '@/lib/constants/pumpOptions';
import Combobox from '@/components/ui/Combobox';
import { formatIntegerInputTR, parseNumberTR, formatNumberTR } from '@/lib/utils';

interface FillingLine {
  id: string;
  name: string;
  order: number;
  capacity: number;
  calculatedDiameter: number | null;
  valveType: string;
  valveControlUnit: string;
  connectedTankCount: number;
}

interface DischargeLine {
  id: string;
  name: string;
  order: number;
  capacity: number;
  pressure: number;
  calculatedDiameter: number | null;
  valveType: string;
  valveControlUnit: string;
  pumpModel: string | null;
  pumpKw: number | null;
  pumpImpellerSize: number | null;
  hasPressureTransmitter: boolean;
  hasFlowMeter: boolean;
  waterInletType: string | null;
  connectedTankCount: number;
}

interface ValveCluster {
  id: string;
  fillingLines: FillingLine[];
  dischargeLines: DischargeLine[];
}

interface Props {
  moduleId: string;
  standard: 'DIN' | 'SMS';
  valveCluster: ValveCluster | null;
  hasWaterInlet: boolean;
}

type AddStep = 'count' | 'name' | null;

function toFillingDraft(l: FillingLine): FillingLineDraft {
  return {
    id: l.id, name: l.name, capacity: l.capacity,
    valveType: l.valveType, valveControlUnit: l.valveControlUnit,
    order: l.order, calculatedDiameter: l.calculatedDiameter,
  };
}

function toDischargeDraft(l: DischargeLine): DischargeLineDraft {
  return {
    id: l.id, name: l.name, capacity: l.capacity, pressure: l.pressure,
    valveType: l.valveType, valveControlUnit: l.valveControlUnit,
    pumpModel: l.pumpModel ?? '', pumpKw: l.pumpKw, pumpImpellerSize: l.pumpImpellerSize,
    hasPressureTransmitter: l.hasPressureTransmitter, hasFlowMeter: l.hasFlowMeter,
    waterInletType: l.waterInletType, order: l.order, calculatedDiameter: l.calculatedDiameter,
  };
}

export default function ValveClusterPanel({ moduleId, standard, valveCluster, hasWaterInlet }: Props) {
  const router = useRouter();
  const init = useModuleBuilder((s) => s.init);
  const setFillingLines = useModuleBuilder((s) => s.setFillingLines);
  const setDischargeLines = useModuleBuilder((s) => s.setDischargeLines);
  const liveCalc = useModuleBuilder((s) => s.liveCalc);
  const calcError = useModuleBuilder((s) => s.calcError);

  useEffect(() => {
    init(
      moduleId, standard,
      (valveCluster?.fillingLines ?? []).map(toFillingDraft),
      (valveCluster?.dischargeLines ?? []).map(toDischargeDraft)
    );
  }, [moduleId, standard, valveCluster, init]);

  // Filling add flow
  const [fAddStep, setFAddStep] = useState<AddStep>(null);
  const [fCount, setFCount] = useState('1');
  const [fCapacity, setFCapacity] = useState('10.000');
  const [fConnTanks, setFConnTanks] = useState('1');
  const [fNames, setFNames] = useState<string[]>([]);
  const [fAdding, setFAdding] = useState(false);
  const [fError, setFError] = useState('');
  const [activeFilling, setActiveFilling] = useState<string | null>(null);

  // Discharge add flow
  const [dAddStep, setDAddStep] = useState<AddStep>(null);
  const [dCount, setDCount] = useState('1');
  const [dCapacity, setDCapacity] = useState('10.000');
  const [dPressure, setDPressure] = useState('2');
  const [dConnTanks, setDConnTanks] = useState('1');
  const [dPumpModel, setDPumpModel] = useState('');
  const [dPumpKw, setDPumpKw] = useState('');
  const [dPumpImpeller, setDPumpImpeller] = useState('');
  const [dHasPT, setDHasPT] = useState(false);
  const [dHasFM, setDHasFM] = useState(false);
  const [dNames, setDNames] = useState<string[]>([]);
  const [dAdding, setDAdding] = useState(false);
  const [dError, setDError] = useState('');
  const [activeDischarge, setActiveDischarge] = useState<string | null>(null);

  // Silme onay modali
  const [confirmDelete, setConfirmDelete] = useState<
    { kind: 'filling' | 'discharge'; id: string; name: string } | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  const fillingLines = valveCluster?.fillingLines ?? [];
  const dischargeLines = valveCluster?.dischargeLines ?? [];
  // Sabit vana grubu:
  // Dolum hatları: Drain SW41 + Leakage SV + CIP Dönüş → her zaman 3
  // Boşaltım hatları: CIP Giriş + Leakage SV (+ Su Giriş varsa) → 2 ya da 3
  const FIXED_FILLING_VALVES = 3;
  const FIXED_DISCHARGE_VALVES = hasWaterInlet ? 3 : 2;
  const fTotalValves = fillingLines.reduce((sum, l) => sum + (l.connectedTankCount ?? 0) + FIXED_FILLING_VALVES, 0);
  const dTotalValves = dischargeLines.reduce((sum, l) => sum + (l.connectedTankCount ?? 0) + FIXED_DISCHARGE_VALVES, 0);

  function startFCount() {
    setFAddStep('count');
    setFCount('1');
    setFCapacity('10.000');
    setFConnTanks('1');
    setFError('');
  }
  function confirmFCount() {
    const n = parseInt(fCount);
    if (isNaN(n) || n < 1 || n > 20) { setFError('Adet 1–20 arası olmalı'); return; }
    const cap = parseNumberTR(fCapacity);
    if (isNaN(cap) || cap <= 0) { setFError('Kapasite pozitif bir sayı olmalı'); return; }
    const tanks = parseInt(fConnTanks);
    if (isNaN(tanks) || tanks < 0) { setFError('Tank sayısı 0 veya daha büyük olmalı'); return; }
    setFNames(Array.from({ length: n }, (_, i) => `Dolum Hattı ${fillingLines.length + i + 1}`));
    setFAddStep('name');
  }

  async function confirmFNames() {
    if (fNames.some((n) => !n.trim())) { setFError('Tüm hat adları dolu olmalı'); return; }
    const cap = parseNumberTR(fCapacity);
    const tanks = parseInt(fConnTanks);
    setFAdding(true); setFError('');
    try {
      for (const n of fNames) {
        const res = await fetch(`/api/modules/${moduleId}/valve-cluster/filling-lines`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: n.trim(), capacity: cap, connectedTankCount: tanks }),
        });
        const json = await res.json();
        if (!json.success) { setFError(json.error ?? 'Hata'); return; }
      }
      setFAddStep(null);
      router.refresh();
    } finally {
      setFAdding(false);
    }
  }

  function startDCount() {
    setDAddStep('count');
    setDCount('1');
    setDCapacity('10.000');
    setDPressure('2');
    setDConnTanks('1');
    setDPumpModel('');
    setDPumpKw('');
    setDPumpImpeller('');
    setDHasPT(false);
    setDHasFM(false);
    setDError('');
  }
  function confirmDCount() {
    const n = parseInt(dCount);
    if (isNaN(n) || n < 1 || n > 20) { setDError('Adet 1–20 arası olmalı'); return; }
    const cap = parseNumberTR(dCapacity);
    if (isNaN(cap) || cap <= 0) { setDError('Kapasite pozitif bir sayı olmalı'); return; }
    const pres = parseFloat(dPressure);
    if (isNaN(pres) || pres < 0) { setDError('Basınç geçersiz'); return; }
    const tanks = parseInt(dConnTanks);
    if (isNaN(tanks) || tanks < 0) { setDError('Tank sayısı 0 veya daha büyük olmalı'); return; }
    setDNames(Array.from({ length: n }, (_, i) => `Boşaltım Hattı ${dischargeLines.length + i + 1}`));
    setDAddStep('name');
  }

  async function confirmDNames() {
    if (dNames.some((n) => !n.trim())) { setDError('Tüm hat adları dolu olmalı'); return; }
    const cap = parseNumberTR(dCapacity);
    const pres = parseFloat(dPressure);
    const tanks = parseInt(dConnTanks);
    const pumpKwNum = dPumpKw.trim() ? parseFloat(dPumpKw) : null;
    const pumpImpNum = dPumpImpeller.trim() ? parseFloat(dPumpImpeller) : null;
    setDAdding(true); setDError('');
    try {
      for (const n of dNames) {
        const payload: Record<string, unknown> = {
          name: n.trim(),
          capacity: cap,
          pressure: pres,
          connectedTankCount: tanks,
          hasPressureTransmitter: dHasPT,
          hasFlowMeter: dHasFM,
        };
        if (dPumpModel.trim()) payload.pumpModel = dPumpModel.trim();
        if (pumpKwNum != null && !isNaN(pumpKwNum)) payload.pumpKw = pumpKwNum;
        if (pumpImpNum != null && !isNaN(pumpImpNum)) payload.pumpImpellerSize = pumpImpNum;
        const res = await fetch(`/api/modules/${moduleId}/valve-cluster/discharge-lines`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.success) { setDError(json.error ?? 'Hata'); return; }
      }
      setDAddStep(null);
      router.refresh();
    } finally {
      setDAdding(false);
    }
  }

  function requestDeleteLastFilling() {
    if (fillingLines.length === 0) return;
    const last = [...fillingLines].sort((a, b) => b.order - a.order)[0];
    setConfirmDelete({ kind: 'filling', id: last.id, name: last.name });
  }

  function requestDeleteLastDischarge() {
    if (dischargeLines.length === 0) return;
    const last = [...dischargeLines].sort((a, b) => b.order - a.order)[0];
    setConfirmDelete({ kind: 'discharge', id: last.id, name: last.name });
  }

  async function performDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const url = confirmDelete.kind === 'filling'
        ? `/api/modules/${moduleId}/valve-cluster/filling-lines/${confirmDelete.id}`
        : `/api/modules/${moduleId}/valve-cluster/discharge-lines/${confirmDelete.id}`;
      const res = await fetch(url, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) {
        if (confirmDelete.kind === 'filling') setFError(json.error ?? 'Silinemedi');
        else setDError(json.error ?? 'Silinemedi');
        return;
      }
      if (confirmDelete.kind === 'filling' && activeFilling === confirmDelete.id) setActiveFilling(null);
      if (confirmDelete.kind === 'discharge' && activeDischarge === confirmDelete.id) setActiveDischarge(null);
      setConfirmDelete(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  function handleFillingLineSaved() {
    setActiveFilling(null);
    router.refresh();
    // Update store from current valveCluster prop — will re-init on next render
  }

  function handleFillingLineDeleted() {
    setActiveFilling(null);
    const newLines = (valveCluster?.fillingLines ?? [])
      .filter((l) => l.id !== activeFilling)
      .map(toFillingDraft);
    setFillingLines(newLines);
    router.refresh();
  }

  function handleDischargeLineSaved() {
    setActiveDischarge(null);
    router.refresh();
  }

  function handleDischargeLineDeleted() {
    setActiveDischarge(null);
    const newLines = (valveCluster?.dischargeLines ?? [])
      .filter((l) => l.id !== activeDischarge)
      .map(toDischargeDraft);
    setDischargeLines(newLines);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Canlı hesap özeti */}
      {liveCalc && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex flex-wrap gap-4 text-xs font-mono text-emerald-800">
          <span>Seçilen Boru: <strong>{liveCalc.selectedDN.dn}</strong> (iç ∅{liveCalc.selectedDN.inner} mm / dış ∅{liveCalc.selectedDN.outer} mm)</span>
          <span>Drain: {liveCalc.drainValveSize}</span>
          <span>CIP: {liveCalc.cipReturnSize}</span>
          <span>Leakage: {liveCalc.leakageChamberMm} mm (sabit)</span>
        </div>
      )}
      {calcError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs text-amber-700">{calcError}</div>
      )}

      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-600">
        Her hatta bağlı tank sayısı buradaki vana sayısını belirler — aşağıdaki <strong>Tanklar</strong> listesinden bağımsızdır.
      </div>

      {/* Dolum Hatları */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">
            Dolum Hatları ({fillingLines.length})
            {fillingLines.length > 0 && (
              <span className="ml-2 text-xs font-normal text-slate-500">· Toplam Vana: {fTotalValves}</span>
            )}
          </h3>
          {fAddStep === null && (
            <div className="flex gap-2">
              <button onClick={startFCount}
                className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >+ Hat Ekle</button>
              <button onClick={requestDeleteLastFilling} disabled={fillingLines.length === 0}
                className="text-xs px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >− Hat Sil</button>
            </div>
          )}
        </div>

        {/* Add flow */}
        {fAddStep === 'count' && (
          <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <p className="text-xs text-slate-500">Bu değerler eklenecek tüm dolum hatlarına uygulanır — sonradan her hat için ayrı düzenlenebilir.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Adet</label>
                <input type="number" value={fCount} onChange={(e) => setFCount(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={1} max={20}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Kapasite (L/h)</label>
                <input type="text" inputMode="numeric" value={fCapacity}
                  onChange={(e) => setFCapacity(formatIntegerInputTR(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="örn: 30.000"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Hatta Bağlı Tank Sayısı</label>
                <input type="number" value={fConnTanks} onChange={(e) => setFConnTanks(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={0}
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Her dolum hattına + 3 sabit vana (Drain SW41, Leakage SV, CIP Dönüş)</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={confirmFCount}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Devam</button>
              <button onClick={() => setFAddStep(null)}
                className="px-3 py-1.5 text-xs border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50">İptal</button>
            </div>
            {fError && <p className="text-xs text-red-600">{fError}</p>}
          </div>
        )}
        {fAddStep === 'name' && (
          <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <label className="block text-xs font-medium text-slate-600 mb-2">Hat adlarını girin:</label>
            {fNames.map((n, i) => (
              <input key={i} value={n}
                onChange={(e) => setFNames((prev) => prev.map((x, j) => j === i ? e.target.value : x))}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1"
                placeholder={`Hat ${i + 1} adı`}
              />
            ))}
            {fError && <p className="text-xs text-red-600">{fError}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={confirmFNames} disabled={fAdding}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
                {fAdding ? 'Ekleniyor...' : 'Onayla & Ekle'}
              </button>
              <button onClick={() => setFAddStep('count')}
                className="px-3 py-1.5 text-xs border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50">Geri</button>
            </div>
          </div>
        )}

        {fillingLines.length === 0 && fAddStep === null ? (
          <p className="text-xs text-slate-400">Henüz dolum hattı yok. &quot;+ Hat Ekle&quot; ile başlayın.</p>
        ) : (
          <ul className="space-y-1">
            {fillingLines.map((line) => (
              <li key={line.id}>
                <button
                  onClick={() => setActiveFilling(activeFilling === line.id ? null : line.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                    activeFilling === line.id
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-medium text-slate-700">{line.name}</span>
                  <span className="text-slate-400 text-xs">{line.capacity.toLocaleString('tr-TR')} L/h · {line.valveType} · {line.connectedTankCount} tank + {FIXED_FILLING_VALVES} sabit → {line.connectedTankCount + FIXED_FILLING_VALVES} vana</span>
                </button>
                {activeFilling === line.id && (
                  <FillingLineForm
                    moduleId={moduleId}
                    line={line}
                    onSaved={handleFillingLineSaved}
                    onDeleted={handleFillingLineDeleted}
                    onClose={() => setActiveFilling(null)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Boşaltım Hatları */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">
            Boşaltım Hatları ({dischargeLines.length})
            {dischargeLines.length > 0 && (
              <span className="ml-2 text-xs font-normal text-slate-500">· Toplam Vana: {dTotalValves}</span>
            )}
          </h3>
          {dAddStep === null && (
            <div className="flex gap-2">
              <button onClick={startDCount}
                className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >+ Hat Ekle</button>
              <button onClick={requestDeleteLastDischarge} disabled={dischargeLines.length === 0}
                className="text-xs px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >− Hat Sil</button>
            </div>
          )}
        </div>

        {dAddStep === 'count' && (
          <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <p className="text-xs text-slate-500">Bu değerler eklenecek tüm boşaltım hatlarına uygulanır — sonradan her hat için ayrı düzenlenebilir.</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Adet</label>
                <input type="number" value={dCount} onChange={(e) => setDCount(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={1} max={20}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Kapasite (L/h)</label>
                <input type="text" inputMode="numeric" value={dCapacity}
                  onChange={(e) => setDCapacity(formatIntegerInputTR(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="örn: 30.000"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Basınç (Bar)</label>
                <input type="number" step="0.1" value={dPressure} onChange={(e) => setDPressure(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Hatta Bağlı Tank Sayısı</label>
                <input type="number" value={dConnTanks} onChange={(e) => setDConnTanks(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={0}
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Her boşaltım hattına + {FIXED_DISCHARGE_VALVES} sabit vana ({hasWaterInlet ? 'CIP Giriş, Leakage SV, Su Giriş' : 'CIP Giriş, Leakage SV — Su Girişi seçilmedi'})</p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200">
              <p className="text-xs font-medium text-slate-600 mb-2">Pompa Bilgileri</p>
              {(() => {
                const dImpellerOptions = getImpellersForPump(dPumpModel);
                const dHasImp = pumpHasImpeller(dPumpModel);
                return (
                  <div className={`grid gap-3 ${dHasImp ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Model</label>
                      <Combobox
                        value={dPumpModel}
                        onChange={(v) => {
                          setDPumpModel(v);
                          if (!pumpHasImpeller(v)) {
                            if (dPumpImpeller) setDPumpImpeller('');
                          } else if (dPumpImpeller) {
                            const opts = getImpellersForPump(v);
                            if (opts.length > 0 && !opts.includes(Number(dPumpImpeller))) {
                              setDPumpImpeller('');
                            }
                          }
                        }}
                        options={PUMP_MODELS}
                        placeholder="Yazın veya listeden seçin"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">kW</label>
                      <input type="number" step="0.1" value={dPumpKw} onChange={(e) => setDPumpKw(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min={0}
                      />
                    </div>
                    {dHasImp && (
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Impeller (mm)</label>
                        <Combobox
                          value={dPumpImpeller}
                          onChange={setDPumpImpeller}
                          options={dImpellerOptions}
                          type="number"
                          min={0}
                          placeholder={dImpellerOptions.length > 0 ? 'Yazın veya seçin' : 'Pompa seçin'}
                        />
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="flex gap-4 pt-2 border-t border-slate-200">
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input type="checkbox" checked={dHasPT} onChange={(e) => setDHasPT(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Basınç Transmitteri
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input type="checkbox" checked={dHasFM} onChange={(e) => setDHasFM(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Flowmeter
              </label>
            </div>

            <div className="flex gap-2">
              <button onClick={confirmDCount}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Devam</button>
              <button onClick={() => setDAddStep(null)}
                className="px-3 py-1.5 text-xs border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50">İptal</button>
            </div>
            {dError && <p className="text-xs text-red-600">{dError}</p>}
          </div>
        )}
        {dAddStep === 'name' && (
          <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <label className="block text-xs font-medium text-slate-600 mb-2">Hat adlarını girin:</label>
            {dNames.map((n, i) => (
              <input key={i} value={n}
                onChange={(e) => setDNames((prev) => prev.map((x, j) => j === i ? e.target.value : x))}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1"
                placeholder={`Hat ${i + 1} adı`}
              />
            ))}
            {dError && <p className="text-xs text-red-600">{dError}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={confirmDNames} disabled={dAdding}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
                {dAdding ? 'Ekleniyor...' : 'Onayla & Ekle'}
              </button>
              <button onClick={() => setDAddStep('count')}
                className="px-3 py-1.5 text-xs border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50">Geri</button>
            </div>
          </div>
        )}

        {dischargeLines.length === 0 && dAddStep === null ? (
          <p className="text-xs text-slate-400">Henüz boşaltım hattı yok. &quot;+ Hat Ekle&quot; ile başlayın.</p>
        ) : (
          <ul className="space-y-1">
            {dischargeLines.map((line) => (
              <li key={line.id}>
                <button
                  onClick={() => setActiveDischarge(activeDischarge === line.id ? null : line.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                    activeDischarge === line.id
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-medium text-slate-700">{line.name}</span>
                  <span className="text-slate-400 text-xs">
                    {line.capacity.toLocaleString('tr-TR')} L/h · {line.pressure} Bar · {line.valveType} · {line.connectedTankCount} tank + {FIXED_DISCHARGE_VALVES} sabit → {line.connectedTankCount + FIXED_DISCHARGE_VALVES} vana
                  </span>
                </button>
                {activeDischarge === line.id && (
                  <DischargeLineForm
                    moduleId={moduleId}
                    line={line}
                    onSaved={handleDischargeLineSaved}
                    onDeleted={handleDischargeLineDeleted}
                    onClose={() => setActiveDischarge(null)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={confirmDelete?.kind === 'filling' ? 'Dolum Hattı Sil' : 'Boşaltım Hattı Sil'}
        message={
          confirmDelete && (
            <>
              <strong>{confirmDelete.name}</strong> silinecek. Bu işlem geri alınamaz.
            </>
          )
        }
        confirmLabel="Sil"
        loading={deleting}
        onConfirm={performDelete}
        onCancel={() => { if (!deleting) setConfirmDelete(null); }}
      />
    </div>
  );
}
