'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import TankForm, { type TankData } from './TankForm';
import { useModuleBuilder } from '@/store/moduleBuilderStore';

interface Props {
  moduleId: string;
  tanks: TankData[];
}

type AddStep = 'count' | 'name' | null;

export default function TanksPanel({ moduleId, tanks }: Props) {
  const router = useRouter();
  const liveCalc = useModuleBuilder((s) => s.liveCalc);

  const [addStep, setAddStep] = useState<AddStep>(null);
  const [count, setCount] = useState('1');
  const [names, setNames] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [activeTank, setActiveTank] = useState<string | null>(null);

  function startAdd() { setAddStep('count'); setCount('1'); setAddError(''); }

  function confirmCount() {
    const n = parseInt(count);
    if (isNaN(n) || n < 1 || n > 20) { setAddError('1–20 arası girin'); return; }
    setNames(Array.from({ length: n }, (_, i) => `Tank ${tanks.length + i + 1}`));
    setAddStep('name');
  }

  async function confirmNames() {
    if (names.some((n) => !n.trim())) { setAddError('Tüm tank adları dolu olmalı'); return; }
    setAdding(true); setAddError('');
    try {
      for (const n of names) {
        const res = await fetch(`/api/modules/${moduleId}/tanks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: n.trim(), volume: 10000,
            samplingValve: 'MANUAL', cipBall: 'STATIC',
          }),
        });
        const json = await res.json();
        if (!json.success) { setAddError(json.error ?? 'Hata'); return; }
      }
      setAddStep(null);
      router.refresh();
    } finally { setAdding(false); }
  }

  return (
    <div className="space-y-0">
      {/* Sabit değerler özeti (valve cluster verisi gerekiyor) */}
      {liveCalc && (
        <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-600">
          Tank Drain: <strong>{liveCalc.tankDrainValveSize}</strong> (sabit) ·
          CIP & Check Valve: <strong>{liveCalc.selectedDN.dn}</strong>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Tanklar ({tanks.length})</h3>
          {addStep === null && (
            <button onClick={startAdd}
              className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >+ Tank Ekle</button>
          )}
        </div>

        {/* Sayı adımı */}
        {addStep === 'count' && (
          <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <label className="block text-xs font-medium text-slate-600">Kaç tank eklenecek?</label>
            <div className="flex gap-2">
              <input type="number" value={count} onChange={(e) => setCount(e.target.value)}
                className="w-24 px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={1} max={20} />
              <button onClick={confirmCount}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Onayla</button>
              <button onClick={() => setAddStep(null)}
                className="px-3 py-1.5 text-xs border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50">İptal</button>
            </div>
            {addError && <p className="text-xs text-red-600">{addError}</p>}
          </div>
        )}

        {/* İsimlendirme adımı */}
        {addStep === 'name' && (
          <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <label className="block text-xs font-medium text-slate-600 mb-2">Tank adlarını girin:</label>
            {names.map((n, i) => (
              <input key={i} value={n}
                onChange={(e) => setNames((prev) => prev.map((x, j) => j === i ? e.target.value : x))}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1"
                placeholder={`Tank ${i + 1} adı`} />
            ))}
            {addError && <p className="text-xs text-red-600">{addError}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={confirmNames} disabled={adding}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
                {adding ? 'Ekleniyor...' : 'Onayla & Ekle'}
              </button>
              <button onClick={() => setAddStep('count')}
                className="px-3 py-1.5 text-xs border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50">Geri</button>
            </div>
          </div>
        )}

        {tanks.length === 0 && addStep === null ? (
          <p className="text-xs text-slate-400">Henüz tank yok. "+ Tank Ekle" ile başlayın.</p>
        ) : (
          <ul className="space-y-1">
            {tanks.map((tank) => (
              <li key={tank.id}>
                <button
                  onClick={() => setActiveTank(activeTank === tank.id ? null : tank.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                    activeTank === tank.id
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-medium text-slate-700">{tank.name}</span>
                  <span className="text-slate-400 text-xs">
                    {tank.volume.toLocaleString('tr-TR')} L ·{' '}
                    {tank.hasAgitator ? 'Agitator' : 'Agitator yok'} ·{' '}
                    {tank.cipBall === 'STATIC' ? 'Statik CIP' : 'Döner CIP'}
                  </span>
                </button>
                {activeTank === tank.id && (
                  <TankForm
                    moduleId={moduleId}
                    tank={tank}
                    onSaved={() => { setActiveTank(null); router.refresh(); }}
                    onDeleted={() => { setActiveTank(null); router.refresh(); }}
                    onClose={() => setActiveTank(null)}
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
