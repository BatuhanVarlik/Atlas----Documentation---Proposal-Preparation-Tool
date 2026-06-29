'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Combobox from '@/components/ui/Combobox';
import NumberInputTR from '@/components/ui/NumberInputTR';
import { PUMP_MODELS, getImpellersForPump, pumpHasImpeller } from '@/lib/constants/pumpOptions';
import { calculateCipLine } from '@/lib/calc/cipCalculator';
import { autoSelectPump } from '@/lib/pumps/autoSelect';

export interface CipLineBulkPayload {
  addCount: number;
  capacity: number | null;
  pressure: number | null;
  pumpModel: string | null;
  pumpKw: number | null;
  pumpImpellerSize: number | null;
}

interface Props {
  kind: 'DISCHARGE' | 'RETURN';
  standard: 'DIN' | 'SMS';
  currentCount: number;
  busy: boolean;
  /** Tanktan gelen önerilen kapasite — kullanıcı elle girmediyse otomatik dolar */
  defaultCapacity?: number | null;
  onSubmit: (payload: CipLineBulkPayload) => void;
}

const inputCls =
  'w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function CipLineBulkForm({ kind, standard, currentCount, busy, defaultCapacity, onSubmit }: Props) {
  const [addCount, setAddCount] = useState<number>(1);
  const [capacity, setCapacity] = useState<number | null>(defaultCapacity ?? null);
  const [pressure, setPressure] = useState<number | null>(null);

  // Kapasiteyi kullanıcı elle değiştirdiyse artık tankı takip etme.
  const capacityTouched = useRef(false);
  useEffect(() => {
    if (!capacityTouched.current && defaultCapacity != null) {
      setCapacity(defaultCapacity);
    }
  }, [defaultCapacity]);
  const handleCapacityChange = (v: number | null) => {
    capacityTouched.current = true;
    setCapacity(v);
  };
  const [pumpModel, setPumpModel] = useState('');
  const [pumpKw, setPumpKw] = useState<number | null>(null);
  const [pumpImpeller, setPumpImpeller] = useState<number | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  const velocity = kind === 'DISCHARGE' ? 1.5 : 2.0;
  const impellerOptions = getImpellersForPump(pumpModel);
  const hasImpeller = pumpHasImpeller(pumpModel);

  const calc = useMemo(() => {
    if (!capacity || capacity <= 0) return null;
    return calculateCipLine(capacity, kind, standard);
  }, [capacity, kind, standard]);

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

  function submit() {
    onSubmit({
      addCount,
      capacity,
      pressure,
      pumpModel: pumpModel || null,
      pumpKw,
      pumpImpellerSize: pumpImpeller,
    });
    setAddCount(1); // bir sonraki ekleme için sıfırla
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 mb-3 space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Eklenecek hat sayısı</label>
          <input
            type="number"
            min={1}
            max={20}
            value={addCount}
            onChange={(e) => setAddCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Kapasite (L/h)</label>
          <NumberInputTR value={capacity} onChange={handleCapacityChange} mode="integer" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Basınç (Bar)</label>
          <NumberInputTR value={pressure} onChange={setPressure} mode="decimal" decimals={2} className={inputCls} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[11px] text-slate-500">
          Hesaplanan çap (V={velocity}):{' '}
          <strong className="font-mono text-slate-700">
            {calc?.selectedDN ? `${calc.selectedDN.dn} · iç ${calc.selectedDN.inner}mm` : (calc ? 'tablo dışı' : '—')}
          </strong>
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">Pompa (yeni eklenecek hatlara uygulanır)</span>
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

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg"
        >
          {busy ? 'Ekleniyor...' : `+ ${addCount} Hat Ekle`}
        </button>
        <span className="text-xs text-slate-500">
          Mevcut: {currentCount} hat → ekleme sonrası {currentCount + addCount}
        </span>
      </div>
    </div>
  );
}
