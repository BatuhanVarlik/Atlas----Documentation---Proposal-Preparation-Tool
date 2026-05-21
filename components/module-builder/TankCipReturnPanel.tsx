'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useModuleBuilder } from '@/store/moduleBuilderStore';
import { PUMP_MODELS, getImpellersForPump, pumpHasImpeller } from '@/lib/constants/pumpOptions';
import Combobox from '@/components/ui/Combobox';

interface Props {
  moduleId: string;
  tankCount: number;
  initial: {
    manifoldExists: boolean;
    lineCount: number;
    pumpModel: string | null;
    pumpKw: number | null;
    pumpImpellerSize: number | null;
  };
}

export default function TankCipReturnPanel({ moduleId, tankCount, initial }: Props) {
  const router = useRouter();
  const liveCalc = useModuleBuilder((s) => s.liveCalc);

  const [manifoldExists, setManifoldExists] = useState(initial.manifoldExists);
  const [lineCount, setLineCount] = useState(initial.lineCount || 1);
  const [pumpModel, setPumpModel] = useState(initial.pumpModel ?? '');
  const [pumpKw, setPumpKw] = useState(initial.pumpKw != null ? String(initial.pumpKw) : '');
  const [pumpImpellerSize, setPumpImpellerSize] = useState(
    initial.pumpImpellerSize != null ? String(initial.pumpImpellerSize) : '',
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const isDirty =
    manifoldExists !== initial.manifoldExists ||
    lineCount !== (initial.lineCount || 1) ||
    pumpModel !== (initial.pumpModel ?? '') ||
    pumpKw !== (initial.pumpKw != null ? String(initial.pumpKw) : '') ||
    pumpImpellerSize !== (initial.pumpImpellerSize != null ? String(initial.pumpImpellerSize) : '');

  const cipSize = liveCalc?.selectedDN.dn ?? '—';
  const drainSize = liveCalc?.tankDrainValveSize ?? '—';
  const checkSize = liveCalc?.selectedDN.dn ?? '—';
  const hasImpeller = pumpHasImpeller(pumpModel);
  const impellerOptions = getImpellersForPump(pumpModel);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        tankCipReturnManifoldExists: manifoldExists,
        tankCipReturnLineCount: manifoldExists ? 1 : lineCount,
      };
      if (manifoldExists) {
        payload.tankCipReturnPumpModel = null;
        payload.tankCipReturnPumpKw = null;
        payload.tankCipReturnPumpImpellerSize = null;
      } else {
        payload.tankCipReturnPumpModel = pumpModel.trim() || null;
        payload.tankCipReturnPumpKw = pumpKw ? parseFloat(pumpKw) : null;
        payload.tankCipReturnPumpImpellerSize = pumpImpellerSize ? parseFloat(pumpImpellerSize) : null;
      }
      const res = await fetch(`/api/modules/${moduleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? 'Hata');
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      {/* Manifold Var/Yok */}
      <div className="grid grid-cols-2 gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Mevcut Manifoldda CIP Dönüş Hattı
          </label>
          <div className="flex gap-2">
            {[
              { value: true, label: 'Var' },
              { value: false, label: 'Yok' },
            ].map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => setManifoldExists(opt.value)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  manifoldExists === opt.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-300 text-slate-600 hover:border-slate-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {!manifoldExists && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              CIP Geri Dönüş Hattı Sayısı
            </label>
            <div className="flex gap-2">
              {[1, 2].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setLineCount(n)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    lineCount === n
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-300 text-slate-600 hover:border-slate-400'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {manifoldExists ? (
        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 italic">
          Manifoldda mevcut CIP dönüş hattı kullanılacak — ek ekipman gerekmiyor.
        </p>
      ) : (
        <>
          {/* Vana özeti */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
            <p className="text-xs font-semibold text-slate-700">
              Ekipman özeti (Hat: {lineCount} · Tank: {tankCount})
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex flex-wrap gap-x-3 items-center">
                <span className="text-slate-600">
                  CIP Vanası <strong className="text-slate-800">SW41</strong>
                </span>
                <span className="text-slate-500">× {lineCount * tankCount} adet (hat × tank)</span>
                <span className="text-slate-400">Çap:</span>
                <span className="text-blue-700 font-mono">{cipSize}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 items-center">
                <span className="text-slate-600">
                  Drain Vanası <strong className="text-slate-800">SW41</strong>
                </span>
                <span className="text-slate-500">× {lineCount} adet (hat başına)</span>
                <span className="text-slate-400">Çap:</span>
                <span className="text-blue-700 font-mono">{drainSize}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 items-center">
                <span className="text-slate-600">Check Valve</span>
                <span className="text-slate-500">× {lineCount} adet (hat başına)</span>
                <span className="text-slate-400">Çap:</span>
                <span className="text-blue-700 font-mono">{checkSize}</span>
              </div>
            </div>
          </div>

          {/* Pompa seçimi */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              CIP Dönüş Pompası
            </label>
            <div className={`grid gap-3 ${hasImpeller ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Pompa Modeli</label>
                <Combobox
                  value={pumpModel}
                  onChange={(v) => {
                    setPumpModel(v);
                    if (!pumpHasImpeller(v)) {
                      if (pumpImpellerSize) setPumpImpellerSize('');
                    } else if (pumpImpellerSize) {
                      const opts = getImpellersForPump(v);
                      if (opts.length > 0 && !opts.includes(Number(pumpImpellerSize))) {
                        setPumpImpellerSize('');
                      }
                    }
                  }}
                  options={PUMP_MODELS}
                  placeholder="Yazın veya listeden seçin"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Pompa kW</label>
                <input
                  type="number"
                  value={pumpKw}
                  onChange={(e) => setPumpKw(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  step="0.1"
                  min={0}
                />
              </div>
              {hasImpeller && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Çark Boyutu (mm)
                  </label>
                  <Combobox
                    value={pumpImpellerSize}
                    onChange={setPumpImpellerSize}
                    options={impellerOptions}
                    type="number"
                    min={0}
                    placeholder={impellerOptions.length > 0 ? 'Yazın veya seçin' : 'Pompa seçin'}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {isDirty && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors"
          >
            {saving ? 'Kaydediliyor...' : saved ? 'Kaydedildi ✓' : 'Kaydet'}
          </button>
        </div>
      )}
    </div>
  );
}
