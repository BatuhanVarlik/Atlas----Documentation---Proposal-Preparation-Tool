'use client';

import { useMemo, useState } from 'react';
import Combobox from '@/components/ui/Combobox';
import NumberInputTR from '@/components/ui/NumberInputTR';
import { PUMP_MODELS, getImpellersForPump, pumpHasImpeller } from '@/lib/constants/pumpOptions';
import { calculateCipLine } from '@/lib/calc/cipCalculator';
import { autoSelectPump } from '@/lib/pumps/autoSelect';

export interface CipLine {
  id: string;
  lineKind: 'DISCHARGE' | 'RETURN';
  name: string;
  capacity: number; // L/h
  pressure: number; // bar
  pumpModel: string | null;
  pumpKw: number | null;
  pumpImpellerSize: number | null;
}

interface Props {
  moduleId: string;
  standard: 'DIN' | 'SMS';
  line: CipLine;
  onSaved: (line: CipLine) => void;
  onDeleted: (id: string) => void;
}

const inputCls =
  'w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function CipLineRow({ moduleId, standard, line, onSaved, onDeleted }: Props) {
  const [open, setOpen] = useState(false);
  const [capacity, setCapacity] = useState<number | null>(line.capacity || null);
  const [pressure, setPressure] = useState<number | null>(line.pressure || null);
  const [pumpModel, setPumpModel] = useState(line.pumpModel ?? '');
  const [pumpKw, setPumpKw] = useState<number | null>(line.pumpKw);
  const [pumpImpeller, setPumpImpeller] = useState<number | null>(line.pumpImpellerSize);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const calc = useMemo(() => {
    if (!capacity || capacity <= 0) return null;
    return calculateCipLine(capacity, line.lineKind, standard);
  }, [capacity, line.lineKind, standard]);

  const velocity = line.lineKind === 'DISCHARGE' ? 1.5 : 2.0;
  const impellerOptions = getImpellersForPump(pumpModel);
  const hasImpeller = pumpHasImpeller(pumpModel);

  async function handleSuggestPump() {
    if (!capacity || !pressure) return;
    setSuggesting(true);
    try {
      const result = await autoSelectPump(capacity, pressure); // capacity L/h; autoSelectPump içinde m³/h'a çevrilir
      if (result) {
        setPumpModel(result.pumpModel);
        setPumpKw(result.pumpKw);
        setPumpImpeller(result.pumpImpellerSize);
      }
    } finally {
      setSuggesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/cip-modules/${moduleId}/lines/${line.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capacity: capacity ?? 0,
          pressure: pressure ?? 0,
          pumpModel: pumpModel || null,
          pumpKw,
          pumpImpellerSize: pumpImpeller,
        }),
      });
      const json = await res.json();
      if (json.success) {
        onSaved(json.data as CipLine);
        setOpen(false);
      } else {
        alert(json.error ?? 'Kaydedilemedi');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
            {line.lineKind === 'DISCHARGE' ? 'DL' : 'RL'}
          </span>
          <span className="font-medium text-slate-800 text-sm">{line.name}</span>
          <span className="text-xs text-slate-500">
            {capacity ? `${capacity.toLocaleString('tr-TR')} L/h` : 'kapasite yok'}
            {calc?.selectedDN ? ` · ${calc.selectedDN.dn}` : ''}
          </span>
        </div>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-100 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Kapasite (L/h)</label>
              <NumberInputTR value={capacity} onChange={setCapacity} mode="integer" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Basınç (Bar)</label>
              <NumberInputTR value={pressure} onChange={setPressure} mode="decimal" decimals={2} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Hesaplanan Çap (V={velocity})</label>
              <div className={`${inputCls} bg-slate-100 text-slate-600 font-mono`}>
                {calc?.selectedDN ? `${calc.selectedDN.dn} · iç ${calc.selectedDN.inner}mm` : (calc ? 'tablo dışı' : '—')}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Pompa</span>
            <button
              type="button"
              onClick={handleSuggestPump}
              disabled={!capacity || !pressure || suggesting}
              className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-lg"
            >
              {suggesting ? 'Öneriliyor...' : 'Pompa Öner'}
            </button>
          </div>
          <div className={`grid gap-3 ${hasImpeller ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Model</label>
              <Combobox
                value={pumpModel}
                onChange={(v) => {
                  setPumpModel(v);
                  if (!pumpHasImpeller(v)) {
                    if (pumpImpeller != null) setPumpImpeller(null);
                  } else if (pumpImpeller != null) {
                    const opts = getImpellersForPump(v);
                    if (opts.length > 0 && !opts.includes(pumpImpeller)) setPumpImpeller(null);
                  }
                }}
                options={PUMP_MODELS}
                placeholder="Yazın veya seçin"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">kW</label>
              <NumberInputTR value={pumpKw} onChange={setPumpKw} mode="decimal" decimals={2} className={inputCls} />
            </div>
            {hasImpeller && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Çark (mm)</label>
                <Combobox
                  value={pumpImpeller == null ? '' : String(pumpImpeller)}
                  onChange={(v) => setPumpImpeller(v ? Number(v) : null)}
                  options={impellerOptions}
                  type="number"
                  min={0}
                  placeholder={impellerOptions.length > 0 ? 'Yazın veya seçin' : 'Pompa seçin'}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => onDeleted(line.id)}
              className="text-xs px-3 py-1.5 text-red-600 border border-red-200 hover:bg-red-50 rounded-lg"
            >
              Sil
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="text-xs px-4 py-1.5 text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg"
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
