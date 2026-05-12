'use client';

import { useState } from 'react';
import { useModuleBuilder } from '@/store/moduleBuilderStore';
import { PUMP_MODELS, PUMP_IMPELLER_SIZES } from '@/lib/constants/pumpOptions';
import Combobox from '@/components/ui/Combobox';

interface DischargeLine {
  id: string;
  name: string;
  capacity: number;
  pressure: number;
  valveType: string;
  valveControlUnit: string;
  pumpModel: string | null;
  pumpKw: number | null;
  pumpImpellerSize: number | null;
  hasPressureTransmitter: boolean;
  hasFlowMeter: boolean;
  waterInletType: string | null;
  calculatedDiameter: number | null;
  connectedTankCount: number;
}

interface Props {
  moduleId: string;
  line: DischargeLine;
  onSaved: () => void;
  onDeleted: () => void;
  onClose: () => void;
}

const VALVE_TYPES = ['SDE44', 'DE44', 'D44SL', 'DA44'] as const;
const CONTROL_UNITS = [
  { value: 'NONE', label: 'Yok' },
  { value: 'AS_I', label: 'AS-i' },
  { value: 'DC', label: 'DC' },
] as const;

export default function DischargeLineForm({ moduleId, line, onSaved, onDeleted, onClose }: Props) {
  const [name, setName] = useState(line.name);
  const [capacity, setCapacity] = useState(String(line.capacity));
  const [pressure, setPressure] = useState(String(line.pressure));
  const [valveType, setValveType] = useState(line.valveType);
  const [valveControlUnit, setValveControlUnit] = useState(line.valveControlUnit);
  const [pumpModel, setPumpModel] = useState(line.pumpModel ?? '');
  const [pumpKw, setPumpKw] = useState(line.pumpKw != null ? String(line.pumpKw) : '');
  const [pumpImpellerSize, setPumpImpellerSize] = useState(
    line.pumpImpellerSize != null ? String(line.pumpImpellerSize) : ''
  );
  const [hasPT, setHasPT] = useState(line.hasPressureTransmitter);
  const [hasFlowMeter, setHasFlowMeter] = useState(line.hasFlowMeter);
  const [waterInletType, setWaterInletType] = useState(line.waterInletType ?? '');
  const [connectedTankCount, setConnectedTankCount] = useState(String(line.connectedTankCount ?? 1));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const updateLine = useModuleBuilder((s) => s.updateDischargeLine);
  const liveCalc = useModuleBuilder((s) => s.liveCalc);
  const dischargeLines = useModuleBuilder((s) => s.dischargeLines);
  const lineIdx = dischargeLines.findIndex((l) => l.id === line.id);
  const liveDiam = liveCalc && lineIdx >= 0
    ? liveCalc.dischargeDiameters[lineIdx]?.diameterMm
    : null;
  const liveFlowMeter = liveCalc?.flowMeterResults.find((r) => r.lineId === line.id);

  const cap = parseFloat(capacity);
  const pres = parseFloat(pressure);
  const isValid = name.trim() && !isNaN(cap) && cap > 0 && !isNaN(pres) && pres > 0 && valveType;

  function handleCapacityChange(v: string) {
    setCapacity(v);
    const n = parseFloat(v);
    if (!isNaN(n) && n > 0) {
      updateLine(line.id, { capacity: n });
    }
  }

  function handleFlowMeterToggle(v: boolean) {
    setHasFlowMeter(v);
    updateLine(line.id, { hasFlowMeter: v });
  }

  async function handleSave() {
    if (!isValid) return;
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(), capacity: cap, pressure: pres,
        valveType, valveControlUnit,
        connectedTankCount: parseInt(connectedTankCount) || 0,
        hasPressureTransmitter: hasPT,
        hasFlowMeter,
      };
      if (pumpModel.trim()) payload.pumpModel = pumpModel.trim();
      if (pumpKw) payload.pumpKw = parseFloat(pumpKw);
      if (pumpImpellerSize) payload.pumpImpellerSize = parseFloat(pumpImpellerSize);
      if (waterInletType) payload.waterInletType = waterInletType;

      const res = await fetch(
        `/api/modules/${moduleId}/valve-cluster/discharge-lines/${line.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!json.success) { setError(json.error ?? 'Hata'); return; }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Bu boşaltım hattını silmek istiyor musunuz?')) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/modules/${moduleId}/valve-cluster/discharge-lines/${line.id}`,
        { method: 'DELETE' }
      );
      const json = await res.json();
      if (!json.success) { setError(json.error ?? 'Silinemedi'); return; }
      onDeleted();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Hat Detayları</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Hat Adı *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="örn: Pasteurizer 1"
        />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Kapasite (L/h) *</label>
          <input
            type="number"
            value={capacity}
            onChange={(e) => handleCapacityChange(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            min={1}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Basınç (Bar) *</label>
          <input
            type="number"
            value={pressure}
            onChange={(e) => setPressure(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            step="0.1" min={0.1}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Tank Sayısı</label>
          <input
            type="number"
            value={connectedTankCount}
            onChange={(e) => setConnectedTankCount(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            min={0}
          />
          <p className="text-[10px] text-slate-400 mt-0.5">Bu hattaki vana</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Hesaplanan Çap</label>
          <div className="px-2.5 py-1.5 text-sm bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-mono">
            {liveDiam ? `${liveDiam.toFixed(1)} mm` : '—'}
          </div>
        </div>
      </div>

      {liveCalc && (
        <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 font-mono">
          Seçilen Boru: <strong>{liveCalc.selectedDN.dn}</strong> (iç: {liveCalc.selectedDN.inner} mm) ·
          Drain: {liveCalc.drainValveSize} · CIP: {liveCalc.cipInletSize}
          {liveFlowMeter && (
            <span> · Flow Meter: <strong>{liveFlowMeter.selectedDN.dn}</strong></span>
          )}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">Vana Tipi *</label>
        <div className="flex gap-2 flex-wrap">
          {VALVE_TYPES.map((v) => (
            <button key={v} onClick={() => setValveType(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                valveType === v ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:border-slate-400'
              }`}
            >{v}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">Kontrol Ünitesi</label>
        <div className="flex gap-2">
          {CONTROL_UNITS.map((c) => (
            <button key={c.value} onClick={() => setValveControlUnit(c.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                valveControlUnit === c.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:border-slate-400'
              }`}
            >{c.label}</button>
          ))}
        </div>
      </div>

      {/* Pompa */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Pompa Modeli</label>
          <Combobox
            value={pumpModel}
            onChange={setPumpModel}
            options={PUMP_MODELS}
            placeholder="Yazın veya listeden seçin"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Pompa kW</label>
          <input type="number" value={pumpKw} onChange={(e) => setPumpKw(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            step="0.1" min={0}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Çark Boyutu (mm)</label>
          <Combobox
            value={pumpImpellerSize}
            onChange={setPumpImpellerSize}
            options={PUMP_IMPELLER_SIZES}
            type="number"
            min={0}
            placeholder="Yazın veya seçin"
          />
        </div>
      </div>

      {/* Opsiyonlar */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Basınç Transmitter</label>
          <div className="flex gap-2">
            {[true, false].map((v) => (
              <button key={String(v)} onClick={() => setHasPT(v)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  hasPT === v ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:border-slate-400'
                }`}
              >{v ? 'Var' : 'Yok'}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Flow Meter</label>
          <div className="flex gap-2">
            {[true, false].map((v) => (
              <button key={String(v)} onClick={() => handleFlowMeterToggle(v)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  hasFlowMeter === v ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:border-slate-400'
                }`}
              >{v ? 'Var' : 'Yok'}</button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">Su Girişi Tipi</label>
        <div className="flex gap-2">
          {['', 'SW_CIP42', 'SD42'].map((v) => (
            <button key={v} onClick={() => setWaterInletType(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                waterInletType === v ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:border-slate-400'
              }`}
            >{v || 'Yok'}</button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex justify-between pt-1">
        <button onClick={handleDelete} disabled={deleting}
          className="px-3 py-1.5 text-xs text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {deleting ? 'Siliniyor...' : 'Sil'}
        </button>
        <button onClick={handleSave} disabled={!isValid || saving}
          className="px-4 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg transition-colors"
        >
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
    </div>
  );
}
