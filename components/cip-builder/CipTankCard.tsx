'use client';

import { useState } from 'react';
import NumberInputTR from '@/components/ui/NumberInputTR';

export type CipTankType = 'CAUSTIC' | 'ACID' | 'HOT_WATER' | 'RECOVERY' | 'FRESH_WATER';

export interface CipTank {
  id: string;
  tankType: CipTankType;
  capacity: number;
  material: 'AISI_304' | 'AISI_316';
  insulation: 'INSULATED' | 'UNINSULATED';
  hasLSH: boolean;
  hasLSL: boolean;
  hasExternalSensor: boolean;
  hasPressureTransmitter: boolean;
}

interface Props {
  moduleId: string;
  tankType: CipTankType;
  label: string;
  tank: CipTank | null; // null = yok
  onChanged: (tanks: CipTank[]) => void;
}

const inputCls =
  'w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

function pillCls(active: boolean) {
  return `flex-1 py-1.5 px-3 rounded-lg border text-xs font-medium transition-colors ${
    active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:border-slate-400'
  }`;
}

export default function CipTankCard({ moduleId, tankType, label, tank, onChanged }: Props) {
  const present = !!tank;
  const isFreshWater = tankType === 'FRESH_WATER';

  const [capacity, setCapacity] = useState<number | null>(tank?.capacity ?? null);
  const [material, setMaterial] = useState<'AISI_304' | 'AISI_316'>(tank?.material ?? 'AISI_304');
  const [insulation, setInsulation] = useState<'INSULATED' | 'UNINSULATED'>(tank?.insulation ?? 'UNINSULATED');
  const [hasLSH, setHasLSH] = useState(tank?.hasLSH ?? false);
  const [hasLSL, setHasLSL] = useState(tank?.hasLSL ?? false);
  const [hasExternalSensor, setHasExternalSensor] = useState(tank?.hasExternalSensor ?? false);
  const [hasPT, setHasPT] = useState(tank?.hasPressureTransmitter ?? false);
  const [busy, setBusy] = useState(false);

  async function persist(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/cip-modules/${moduleId}/tanks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tankType, ...payload }),
      });
      const json = await res.json();
      if (json.success) onChanged(json.data as CipTank[]);
      else alert(json.error ?? 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  }

  function toggle(value: boolean) {
    if (value) {
      persist({
        present: true,
        capacity: capacity ?? 0,
        material,
        insulation,
        hasLSH,
        hasLSL,
        hasExternalSensor,
        hasPressureTransmitter: isFreshWater ? false : hasPT,
      });
    } else {
      persist({ present: false });
    }
  }

  function save() {
    persist({
      present: true,
      capacity: capacity ?? 0,
      material,
      insulation,
      hasLSH,
      hasLSL,
      hasExternalSensor,
      hasPressureTransmitter: isFreshWater ? false : hasPT,
    });
  }

  return (
    <div className={`rounded-lg border p-3 ${present ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-800">{label}</span>
        <div className="flex gap-1.5">
          {[
            { v: true, l: 'Var' },
            { v: false, l: 'Yok' },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              disabled={busy}
              onClick={() => toggle(o.v)}
              className={`py-1 px-3 rounded-lg border text-xs font-medium ${
                present === o.v
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-300 text-slate-600 hover:border-slate-400'
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {present && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Kapasite (L)</label>
              <NumberInputTR value={capacity} onChange={setCapacity} mode="integer" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Malzeme</label>
              <div className="flex gap-1.5">
                {(['AISI_304', 'AISI_316'] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setMaterial(m)} className={pillCls(material === m)}>
                    {m.replace('AISI_', '')}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">İzolasyon</label>
              <div className="flex gap-1.5">
                {([
                  { v: 'INSULATED' as const, l: 'İzoleli' },
                  { v: 'UNINSULATED' as const, l: 'İzolesiz' },
                ]).map((o) => (
                  <button key={o.v} type="button" onClick={() => setInsulation(o.v)} className={pillCls(insulation === o.v)}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-1.5 text-xs text-slate-700">
              <input type="checkbox" checked={hasLSH} onChange={(e) => setHasLSH(e.target.checked)} /> LSH
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-700">
              <input type="checkbox" checked={hasLSL} onChange={(e) => setHasLSL(e.target.checked)} /> LSL
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-700">
              <input type="checkbox" checked={hasExternalSensor} onChange={(e) => setHasExternalSensor(e.target.checked)} /> Tank Dışı Sensör
            </label>
            {!isFreshWater && (
              <label className="flex items-center gap-1.5 text-xs text-slate-700">
                <input type="checkbox" checked={hasPT} onChange={(e) => setHasPT(e.target.checked)} /> Pressure Transmitter
              </label>
            )}
            {isFreshWater && (
              <span className="text-[11px] text-slate-400 italic self-center">Fresh Water tankında PT kullanılmaz</span>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="text-xs px-4 py-1.5 text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg"
            >
              {busy ? 'Kaydediliyor...' : 'Tankı Kaydet'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
