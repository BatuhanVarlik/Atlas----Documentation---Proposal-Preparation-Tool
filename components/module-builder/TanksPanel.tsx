'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import TankForm, { type TankData } from './TankForm';
import { useModuleBuilder } from '@/store/moduleBuilderStore';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

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
  const [volume, setVolume] = useState('10000');
  const [samplingValve, setSamplingValve] = useState<'MANUAL' | 'WITH_ACTUATOR'>('MANUAL');
  const [cipBall, setCipBall] = useState<'STATIC' | 'ROTARY'>('STATIC');

  // Sensörler
  const [hasLSH, setHasLSH] = useState(false);
  const [hasLSM, setHasLSM] = useState(false);
  const [hasLSL, setHasLSL] = useState(false);
  const [hasTT, setHasTT] = useState(false);
  const [hasPT, setHasPT] = useState(false);
  const [hasProximitySwitch, setHasProximitySwitch] = useState(false);

  // Agitator
  const [hasAgitator, setHasAgitator] = useState(false);
  const [agitatorMotorKw, setAgitatorMotorKw] = useState('');
  const [agitatorRpm, setAgitatorRpm] = useState('');
  const [agitatorPosition, setAgitatorPosition] = useState<'SIDE' | 'TOP'>('SIDE');

  // CIP
  const [hasCipInletForAgitator, setHasCipInletForAgitator] = useState(false);
  const [hasCipInletForManhole, setHasCipInletForManhole] = useState(false);

  // Tank outlet valve
  const [hasTankOutletValve, setHasTankOutletValve] = useState(false);
  const [tankOutletValveType, setTankOutletValveType] = useState<'MANUAL' | 'WITH_ACTUATOR'>('MANUAL');
  const [tankOutletValveSubType, setTankOutletValveSubType] = useState<'BUTTERFLY' | 'SINGLE_SEAT'>('BUTTERFLY');

  // CIP return pump
  const [hasCipReturnPump, setHasCipReturnPump] = useState(false);
  const [cipReturnPumpModel, setCipReturnPumpModel] = useState('');
  const [cipReturnPumpKw, setCipReturnPumpKw] = useState('');
  const [cipReturnPumpImpellerSize, setCipReturnPumpImpellerSize] = useState('');

  const [names, setNames] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [activeTank, setActiveTank] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  function startAdd() {
    setAddStep('count');
    setCount('1');
    setVolume('10000');
    setSamplingValve('MANUAL');
    setCipBall('STATIC');
    setHasLSH(false); setHasLSM(false); setHasLSL(false);
    setHasTT(false); setHasPT(false); setHasProximitySwitch(false);
    setHasAgitator(false); setAgitatorMotorKw(''); setAgitatorRpm(''); setAgitatorPosition('SIDE');
    setHasCipInletForAgitator(false); setHasCipInletForManhole(false);
    setHasTankOutletValve(false); setTankOutletValveType('MANUAL'); setTankOutletValveSubType('BUTTERFLY');
    setHasCipReturnPump(false);
    setCipReturnPumpModel(''); setCipReturnPumpKw(''); setCipReturnPumpImpellerSize('');
    setAddError('');
  }

  function requestDeleteLastTank() {
    if (tanks.length === 0) return;
    const last = [...tanks].sort((a, b) => b.order - a.order)[0];
    setConfirmDelete({ id: last.id, name: last.name });
  }

  async function performDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/modules/${moduleId}/tanks/${confirmDelete.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) { setAddError(json.error ?? 'Silinemedi'); return; }
      if (activeTank === confirmDelete.id) setActiveTank(null);
      setConfirmDelete(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  function confirmCount() {
    const n = parseInt(count);
    if (isNaN(n) || n < 1 || n > 20) { setAddError('Adet 1–20 arası olmalı'); return; }
    const vol = parseFloat(volume);
    if (isNaN(vol) || vol <= 0) { setAddError('Hacim pozitif bir sayı olmalı'); return; }
    setNames(Array.from({ length: n }, (_, i) => `Tank ${tanks.length + i + 1}`));
    setAddStep('name');
  }

  async function confirmNames() {
    if (names.some((n) => !n.trim())) { setAddError('Tüm tank adları dolu olmalı'); return; }
    const vol = parseFloat(volume);
    const kwNum = agitatorMotorKw.trim() ? parseFloat(agitatorMotorKw) : null;
    const rpmNum = agitatorRpm.trim() ? parseInt(agitatorRpm) : null;
    const pumpKwNum = cipReturnPumpKw.trim() ? parseFloat(cipReturnPumpKw) : null;
    const pumpImpNum = cipReturnPumpImpellerSize.trim() ? parseFloat(cipReturnPumpImpellerSize) : null;

    setAdding(true); setAddError('');
    try {
      for (const n of names) {
        const payload: Record<string, unknown> = {
          name: n.trim(),
          volume: vol,
          samplingValve,
          cipBall,
          hasLSH, hasLSM, hasLSL, hasTT, hasPT, hasProximitySwitch,
          hasAgitator,
          hasCipInletForAgitator,
          hasCipInletForManhole,
          hasTankOutletValve,
        };
        if (hasAgitator) {
          if (kwNum != null && !isNaN(kwNum)) payload.agitatorMotorKw = kwNum;
          if (rpmNum != null && !isNaN(rpmNum)) payload.agitatorRpm = rpmNum;
          payload.agitatorPosition = agitatorPosition;
        }
        if (hasTankOutletValve) {
          payload.tankOutletValveType = tankOutletValveType;
          if (tankOutletValveType === 'WITH_ACTUATOR') {
            payload.tankOutletValveSubType = tankOutletValveSubType;
          }
        }
        // Manifoldda pompa yoksa kullanıcı yeni pompa seçer ve gönderir.
        // Pompa zaten varsa alanlar gönderilmez.
        if (!hasCipReturnPump) {
          if (cipReturnPumpModel.trim()) payload.cipReturnPumpModel = cipReturnPumpModel.trim();
          if (pumpKwNum != null && !isNaN(pumpKwNum)) payload.cipReturnPumpKw = pumpKwNum;
          if (pumpImpNum != null && !isNaN(pumpImpNum)) payload.cipReturnPumpImpellerSize = pumpImpNum;
        }

        const res = await fetch(`/api/modules/${moduleId}/tanks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
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
            <div className="flex gap-2">
              <button onClick={startAdd}
                className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >+ Tank Ekle</button>
              <button onClick={requestDeleteLastTank} disabled={tanks.length === 0}
                className="text-xs px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >− Tank Sil</button>
            </div>
          )}
        </div>

        {/* Sayı + ortak alanlar adımı */}
        {addStep === 'count' && (
          <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <p className="text-xs text-slate-500">Bu değerler eklenecek tüm tanklara uygulanır — sonradan her tank için ayrı düzenlenebilir.</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Adet</label>
                <input type="number" value={count} onChange={(e) => setCount(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={1} max={20} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Hacim (L)</label>
                <input type="number" value={volume} onChange={(e) => setVolume(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={1} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Sampling Valve</label>
                <select value={samplingValve} onChange={(e) => setSamplingValve(e.target.value as 'MANUAL' | 'WITH_ACTUATOR')}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="MANUAL">Manuel</option>
                  <option value="WITH_ACTUATOR">Aktüatörlü</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">CIP Ball</label>
                <select value={cipBall} onChange={(e) => setCipBall(e.target.value as 'STATIC' | 'ROTARY')}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="STATIC">Statik</option>
                  <option value="ROTARY">Döner</option>
                </select>
              </div>
            </div>

            {/* Sensörler */}
            <div className="pt-2 border-t border-slate-200">
              <p className="text-xs font-medium text-slate-600 mb-2">Sensörler</p>
              <div className="grid grid-cols-3 gap-2">
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={hasLSH} onChange={(e) => setHasLSH(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  LSH
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={hasLSM} onChange={(e) => setHasLSM(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  LSM
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={hasLSL} onChange={(e) => setHasLSL(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  LSL
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={hasTT} onChange={(e) => setHasTT(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  TT
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={hasPT} onChange={(e) => setHasPT(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  PT
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={hasProximitySwitch} onChange={(e) => setHasProximitySwitch(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  Proximity
                </label>
              </div>
            </div>

            {/* Agitator */}
            <div className="pt-2 border-t border-slate-200">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer mb-2">
                <input type="checkbox" checked={hasAgitator} onChange={(e) => setHasAgitator(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                Agitator var
              </label>
              {hasAgitator && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Motor kW</label>
                    <input type="number" step="0.1" value={agitatorMotorKw} onChange={(e) => setAgitatorMotorKw(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min={0} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">RPM</label>
                    <input type="number" value={agitatorRpm} onChange={(e) => setAgitatorRpm(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min={0} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Pozisyon</label>
                    <select value={agitatorPosition} onChange={(e) => setAgitatorPosition(e.target.value as 'SIDE' | 'TOP')}
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="SIDE">Yan</option>
                      <option value="TOP">Üst</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* CIP Inlets */}
            <div className="pt-2 border-t border-slate-200">
              <p className="text-xs font-medium text-slate-600 mb-2">CIP Inlet</p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={hasCipInletForAgitator} onChange={(e) => setHasCipInletForAgitator(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  Agitator için
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={hasCipInletForManhole} onChange={(e) => setHasCipInletForManhole(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  Manhole için
                </label>
              </div>
            </div>

            {/* Tank Outlet Valve */}
            <div className="pt-2 border-t border-slate-200">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer mb-2">
                <input type="checkbox" checked={hasTankOutletValve} onChange={(e) => setHasTankOutletValve(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                Tank Outlet Valve var
              </label>
              {hasTankOutletValve && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Tip</label>
                    <select value={tankOutletValveType} onChange={(e) => setTankOutletValveType(e.target.value as 'MANUAL' | 'WITH_ACTUATOR')}
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="MANUAL">Manuel</option>
                      <option value="WITH_ACTUATOR">Aktüatörlü</option>
                    </select>
                  </div>
                  {tankOutletValveType === 'WITH_ACTUATOR' && (
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Alt Tip</label>
                      <select value={tankOutletValveSubType} onChange={(e) => setTankOutletValveSubType(e.target.value as 'BUTTERFLY' | 'SINGLE_SEAT')}
                        className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="BUTTERFLY">Kelebek</option>
                        <option value="SINGLE_SEAT">Tek Oturmalı</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* CIP Return Pump */}
            <div className="pt-2 border-t border-slate-200">
              <p className="text-xs font-medium text-slate-600 mb-2">Mevcut Manifoldda CIP Return Pompası</p>
              <div className="flex gap-2 mb-3">
                {[
                  { value: false, label: 'Yok' },
                  { value: true, label: 'Var' },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setHasCipReturnPump(opt.value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      hasCipReturnPump === opt.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'border-slate-300 dark:border-white/15 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {!hasCipReturnPump && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Model</label>
                    <input type="text" value={cipReturnPumpModel} onChange={(e) => setCipReturnPumpModel(e.target.value)}
                      placeholder="Örn: KSB-20"
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">kW</label>
                    <input type="number" step="0.1" value={cipReturnPumpKw} onChange={(e) => setCipReturnPumpKw(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min={0} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Impeller (mm)</label>
                    <input type="number" step="0.1" value={cipReturnPumpImpellerSize} onChange={(e) => setCipReturnPumpImpellerSize(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min={0} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={confirmCount}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Devam</button>
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
          <p className="text-xs text-slate-400">Henüz tank yok. &quot;+ Tank Ekle&quot; ile başlayın.</p>
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

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Tank Sil"
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
