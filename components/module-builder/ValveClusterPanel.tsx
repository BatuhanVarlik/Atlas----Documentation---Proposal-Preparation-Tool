'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useModuleBuilder, type FillingLineDraft, type DischargeLineDraft } from '@/store/moduleBuilderStore';
import FillingLineForm from './FillingLineForm';
import DischargeLineForm from './DischargeLineForm';

interface FillingLine {
  id: string;
  name: string;
  order: number;
  capacity: number;
  calculatedDiameter: number | null;
  valveType: string;
  valveControlUnit: string;
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

export default function ValveClusterPanel({ moduleId, standard, valveCluster }: Props) {
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
  const [fNames, setFNames] = useState<string[]>([]);
  const [fAdding, setFAdding] = useState(false);
  const [fError, setFError] = useState('');
  const [activeFilling, setActiveFilling] = useState<string | null>(null);

  // Discharge add flow
  const [dAddStep, setDAddStep] = useState<AddStep>(null);
  const [dCount, setDCount] = useState('1');
  const [dNames, setDNames] = useState<string[]>([]);
  const [dAdding, setDAdding] = useState(false);
  const [dError, setDError] = useState('');
  const [activeDischarge, setActiveDischarge] = useState<string | null>(null);

  const fillingLines = valveCluster?.fillingLines ?? [];
  const dischargeLines = valveCluster?.dischargeLines ?? [];

  function startFCount() { setFAddStep('count'); setFCount('1'); setFError(''); }
  function confirmFCount() {
    const n = parseInt(fCount);
    if (isNaN(n) || n < 1 || n > 20) { setFError('1–20 arası girin'); return; }
    setFNames(Array.from({ length: n }, (_, i) => `Dolum Hattı ${fillingLines.length + i + 1}`));
    setFAddStep('name');
  }

  async function confirmFNames() {
    if (fNames.some((n) => !n.trim())) { setFError('Tüm hat adları dolu olmalı'); return; }
    setFAdding(true); setFError('');
    try {
      for (const n of fNames) {
        const res = await fetch(`/api/modules/${moduleId}/valve-cluster/filling-lines`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: n.trim(), capacity: 10000, valveType: 'SDE44', valveControlUnit: 'NONE' }),
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

  function startDCount() { setDAddStep('count'); setDCount('1'); setDError(''); }
  function confirmDCount() {
    const n = parseInt(dCount);
    if (isNaN(n) || n < 1 || n > 20) { setDError('1–20 arası girin'); return; }
    setDNames(Array.from({ length: n }, (_, i) => `Boşaltım Hattı ${dischargeLines.length + i + 1}`));
    setDAddStep('name');
  }

  async function confirmDNames() {
    if (dNames.some((n) => !n.trim())) { setDError('Tüm hat adları dolu olmalı'); return; }
    setDAdding(true); setDError('');
    try {
      for (const n of dNames) {
        const res = await fetch(`/api/modules/${moduleId}/valve-cluster/discharge-lines`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: n.trim(), capacity: 10000, pressure: 2, valveType: 'SDE44', valveControlUnit: 'NONE' }),
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

      {/* Dolum Hatları */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Dolum Hatları ({fillingLines.length})</h3>
          {fAddStep === null && (
            <button onClick={startFCount}
              className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >+ Hat Ekle</button>
          )}
        </div>

        {/* Add flow */}
        {fAddStep === 'count' && (
          <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <label className="block text-xs font-medium text-slate-600">Kaç dolum hattı eklenecek?</label>
            <div className="flex gap-2">
              <input type="number" value={fCount} onChange={(e) => setFCount(e.target.value)}
                className="w-24 px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={1} max={20}
              />
              <button onClick={confirmFCount}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Onayla</button>
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
          <p className="text-xs text-slate-400">Henüz dolum hattı yok. "+ Hat Ekle" ile başlayın.</p>
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
                  <span className="text-slate-400 text-xs">{line.capacity.toLocaleString('tr-TR')} L/h · {line.valveType}</span>
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
          <h3 className="text-sm font-semibold text-slate-700">Boşaltım Hatları ({dischargeLines.length})</h3>
          {dAddStep === null && (
            <button onClick={startDCount}
              className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >+ Hat Ekle</button>
          )}
        </div>

        {dAddStep === 'count' && (
          <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <label className="block text-xs font-medium text-slate-600">Kaç boşaltım hattı eklenecek?</label>
            <div className="flex gap-2">
              <input type="number" value={dCount} onChange={(e) => setDCount(e.target.value)}
                className="w-24 px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={1} max={20}
              />
              <button onClick={confirmDCount}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Onayla</button>
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
          <p className="text-xs text-slate-400">Henüz boşaltım hattı yok. "+ Hat Ekle" ile başlayın.</p>
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
                    {line.capacity.toLocaleString('tr-TR')} L/h · {line.pressure} Bar · {line.valveType}
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
    </div>
  );
}
