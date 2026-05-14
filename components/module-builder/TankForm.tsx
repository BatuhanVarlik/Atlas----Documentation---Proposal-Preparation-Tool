'use client';

import { useState } from 'react';
import { useModuleBuilder } from '@/store/moduleBuilderStore';

export interface TankData {
  id: string;
  name: string;
  order: number;
  volume: number;
  hasLSH: boolean;
  hasLSM: boolean;
  hasLSL: boolean;
  hasTT: boolean;
  hasPT: boolean;
  samplingValve: string;
  hasProximitySwitch: boolean;
  hasAgitator: boolean;
  agitatorMotorKw: number | null;
  agitatorRpm: number | null;
  agitatorPosition: string | null;
  cipBall: string;
  hasCipInletForAgitator: boolean;
  hasCipInletForManhole: boolean;
  hasTankOutletValve: boolean;
  tankOutletValveType: string | null;
  tankOutletValveSubType: string | null;
  manifoldHasCipReturnPump: boolean;
  cipReturnPumpModel: string | null;
  cipReturnPumpKw: number | null;
  cipReturnPumpImpellerSize: number | null;
}

interface Props {
  moduleId: string;
  tank: TankData;
  onSaved: () => void;
  onDeleted: () => void;
  onClose: () => void;
}

function Toggle({ value, onChange, trueLabel = 'Var', falseLabel = 'Yok' }: {
  value: boolean; onChange: (v: boolean) => void; trueLabel?: string; falseLabel?: string;
}) {
  return (
    <div className="flex gap-1">
      {([true, false] as const).map((v) => (
        <button key={String(v)} onClick={() => onChange(v)}
          className={`flex-1 py-1 text-xs font-medium rounded border transition-colors ${
            value === v ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:border-slate-400'
          }`}
        >{v ? trueLabel : falseLabel}</button>
      ))}
    </div>
  );
}

function OptionGroup<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
            value === o.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:border-slate-400'
          }`}
        >{o.label}</button>
      ))}
    </div>
  );
}

export default function TankForm({ moduleId, tank, onSaved, onDeleted, onClose }: Props) {
  const liveCalc = useModuleBuilder((s) => s.liveCalc);

  const [name, setName] = useState(tank.name);
  const [volume, setVolume] = useState(String(tank.volume));
  const [s, setS] = useState({
    hasLSH: tank.hasLSH, hasLSM: tank.hasLSM, hasLSL: tank.hasLSL,
    hasTT: tank.hasTT, hasPT: tank.hasPT,
    samplingValve: tank.samplingValve as 'MANUAL' | 'WITH_ACTUATOR',
    hasProximitySwitch: tank.hasProximitySwitch,
    hasAgitator: tank.hasAgitator,
    agitatorMotorKw: tank.agitatorMotorKw != null ? String(tank.agitatorMotorKw) : '',
    agitatorRpm: tank.agitatorRpm != null ? String(tank.agitatorRpm) : '',
    agitatorPosition: (tank.agitatorPosition ?? 'SIDE') as 'SIDE' | 'TOP',
    cipBall: tank.cipBall as 'STATIC' | 'ROTARY',
    hasCipInletForAgitator: tank.hasCipInletForAgitator,
    hasCipInletForManhole: tank.hasCipInletForManhole,
    hasTankOutletValve: tank.hasTankOutletValve,
    tankOutletValveType: (tank.tankOutletValveType ?? 'MANUAL') as 'MANUAL' | 'WITH_ACTUATOR',
    tankOutletValveSubType: (tank.tankOutletValveSubType ?? 'BUTTERFLY') as
      | 'BUTTERFLY' | 'SINGLE_SEAT' | 'SINGLE_SEAT_TANK' | 'SW_CIP_TANK' | 'SD_TANK' | 'D_TANK',
    manifoldHasCipReturnPump: tank.manifoldHasCipReturnPump ?? false,
    cipReturnPumpModel: tank.cipReturnPumpModel ?? '',
    cipReturnPumpKw: tank.cipReturnPumpKw != null ? String(tank.cipReturnPumpKw) : '',
    cipReturnPumpImpellerSize: tank.cipReturnPumpImpellerSize != null ? String(tank.cipReturnPumpImpellerSize) : '',
  });

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const vol = parseFloat(volume);
  const isValid = name.trim() && !isNaN(vol) && vol > 0 && s.samplingValve && s.cipBall;

  async function handleSave() {
    if (!isValid) return;
    setSaving(true); setError('');
    const payload: Record<string, unknown> = {
      name: name.trim(), volume: vol,
      samplingValve: s.samplingValve, cipBall: s.cipBall,
      hasLSH: s.hasLSH, hasLSM: s.hasLSM, hasLSL: s.hasLSL, hasTT: s.hasTT, hasPT: s.hasPT,
      hasProximitySwitch: s.hasProximitySwitch,
      hasAgitator: s.hasAgitator,
      hasCipInletForAgitator: s.hasCipInletForAgitator,
      hasCipInletForManhole: s.hasCipInletForManhole,
      hasTankOutletValve: s.hasTankOutletValve,
    };
    if (s.hasAgitator) {
      payload.agitatorMotorKw = s.agitatorMotorKw ? parseFloat(s.agitatorMotorKw) : null;
      payload.agitatorRpm = s.agitatorRpm ? parseInt(s.agitatorRpm) : null;
      payload.agitatorPosition = s.agitatorPosition;
    } else {
      payload.agitatorMotorKw = null; payload.agitatorRpm = null; payload.agitatorPosition = null;
    }
    if (s.hasTankOutletValve) {
      payload.tankOutletValveType = s.tankOutletValveType;
      // Manuel → her zaman Kelebek; Aktüatörlü → kullanıcı seçimi
      payload.tankOutletValveSubType =
        s.tankOutletValveType === 'MANUAL' ? 'BUTTERFLY' : s.tankOutletValveSubType;
    } else {
      payload.tankOutletValveType = null; payload.tankOutletValveSubType = null;
    }
    payload.manifoldHasCipReturnPump = s.manifoldHasCipReturnPump;
    if (s.manifoldHasCipReturnPump) {
      // Manifoldda pompa var → tank için ayrı pompa kaydı yok
      payload.cipReturnPumpModel = null;
      payload.cipReturnPumpKw = null;
      payload.cipReturnPumpImpellerSize = null;
    } else {
      payload.cipReturnPumpModel = s.cipReturnPumpModel.trim() || null;
      payload.cipReturnPumpKw = s.cipReturnPumpKw ? parseFloat(s.cipReturnPumpKw) : null;
      payload.cipReturnPumpImpellerSize = s.cipReturnPumpImpellerSize ? parseFloat(s.cipReturnPumpImpellerSize) : null;
    }

    try {
      const res = await fetch(`/api/modules/${moduleId}/tanks/${tank.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error ?? 'Hata'); return; }
      onSaved();
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm('Bu tankı silmek istiyor musunuz?')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/modules/${moduleId}/tanks/${tank.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) { setError(json.error ?? 'Silinemedi'); return; }
      onDeleted();
    } finally { setDeleting(false); }
  }

  const drainSize = liveCalc?.tankDrainValveSize ?? '—';
  const cipSize = liveCalc?.selectedDN.dn ?? '—';

  return (
    <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tank Detayları</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
      </div>

      {/* Temel */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Tank Adı *</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="örn: RMT 1" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Hacim (L) *</label>
          <input type="number" value={volume} onChange={(e) => setVolume(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            min={1} placeholder="örn: 10000" />
        </div>
      </div>

      {/* Sensörler */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">Sensörler</label>
        <div className="flex gap-2 flex-wrap">
          {(['hasLSH','hasLSM','hasLSL','hasTT','hasPT'] as const).map((k) => (
            <button key={k} onClick={() => setS((p) => ({ ...p, [k]: !p[k] }))}
              className={`px-3 py-1 text-xs font-medium rounded border transition-colors ${
                s[k] ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-500 hover:border-slate-400'
              }`}
            >{k.replace('has', '')}</button>
          ))}
        </div>
      </div>

      {/* Sampling Valve & Proximity */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Örnekleme Vanası *</label>
          <OptionGroup
            options={[{ value: 'MANUAL', label: 'Manuel' }, { value: 'WITH_ACTUATOR', label: 'Aktüatörlü' }]}
            value={s.samplingValve} onChange={(v) => setS((p) => ({ ...p, samplingValve: v }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Proximity Switch</label>
          <Toggle value={s.hasProximitySwitch} onChange={(v) => setS((p) => ({ ...p, hasProximitySwitch: v }))} />
        </div>
      </div>

      {/* Agitator */}
      <div>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Agitator</label>
            <Toggle value={s.hasAgitator} onChange={(v) => setS((p) => ({ ...p, hasAgitator: v }))} />
          </div>
          {s.hasAgitator && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">CIP Girişi (Agitator)</label>
              <Toggle value={s.hasCipInletForAgitator} onChange={(v) => setS((p) => ({ ...p, hasCipInletForAgitator: v }))} />
            </div>
          )}
        </div>
        {s.hasAgitator && (
          <div className="grid grid-cols-3 gap-2 pl-0">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Motor kW</label>
              <input type="number" value={s.agitatorMotorKw} onChange={(e) => setS((p) => ({ ...p, agitatorMotorKw: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" step="0.1" min={0} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">RPM</label>
              <input type="number" value={s.agitatorRpm} onChange={(e) => setS((p) => ({ ...p, agitatorRpm: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" min={1} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Pozisyon</label>
              <OptionGroup
                options={[{ value: 'SIDE', label: 'Yan' }, { value: 'TOP', label: 'Üst' }]}
                value={s.agitatorPosition} onChange={(v) => setS((p) => ({ ...p, agitatorPosition: v }))}
              />
            </div>
          </div>
        )}
      </div>

      {/* CIP Ball & CIP Manhole */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">CIP Topu *</label>
          <OptionGroup
            options={[{ value: 'STATIC', label: 'Statik' }, { value: 'ROTARY', label: 'Döner' }]}
            value={s.cipBall} onChange={(v) => setS((p) => ({ ...p, cipBall: v }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">CIP Girişi (Manhole)</label>
          <Toggle value={s.hasCipInletForManhole} onChange={(v) => setS((p) => ({ ...p, hasCipInletForManhole: v }))} />
        </div>
      </div>

      {/* Tank Outlet Valve */}
      <div>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tank Çıkış Vanası</label>
            <Toggle value={s.hasTankOutletValve} onChange={(v) => setS((p) => ({ ...p, hasTankOutletValve: v }))} />
          </div>
          {s.hasTankOutletValve && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vana Tipi</label>
              <OptionGroup
                options={[{ value: 'MANUAL', label: 'Manuel' }, { value: 'WITH_ACTUATOR', label: 'Aktüatörlü' }]}
                value={s.tankOutletValveType} onChange={(v) => setS((p) => ({ ...p, tankOutletValveType: v }))}
              />
            </div>
          )}
        </div>
        {s.hasTankOutletValve && s.tankOutletValveType === 'MANUAL' && (
          <p className="text-[11px] text-slate-400">Manuel vana otomatik olarak Kelebek tipindedir.</p>
        )}
        {s.hasTankOutletValve && s.tankOutletValveType === 'WITH_ACTUATOR' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Alt Tip</label>
            <OptionGroup
              options={[
                { value: 'BUTTERFLY', label: 'Kelebek' },
                { value: 'SINGLE_SEAT', label: 'Single Seat' },
                { value: 'SINGLE_SEAT_TANK', label: 'Single Seat Tank' },
                { value: 'SW_CIP_TANK', label: 'SW CIP Tank' },
                { value: 'SD_TANK', label: 'SD Tank' },
                { value: 'D_TANK', label: 'D Tank' },
              ]}
              value={s.tankOutletValveSubType} onChange={(v) => setS((p) => ({ ...p, tankOutletValveSubType: v }))}
            />
          </div>
        )}
      </div>

      {/* CIP Return Pump */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-3 items-center">
          <label className="text-xs font-medium text-slate-600">Manifoldda CIP Dönüş Pompası</label>
          <Toggle
            value={s.manifoldHasCipReturnPump}
            onChange={(v) => setS((p) => ({ ...p, manifoldHasCipReturnPump: v }))}
          />
        </div>
        {s.manifoldHasCipReturnPump ? (
          <p className="text-[11px] text-slate-400 italic">
            Manifoldda CIP Dönüş Pompası mevcut — bu tank için ayrı pompa bilgisi girilmez.
          </p>
        ) : (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">CIP Dönüş Pompası (Tanka Özel)</label>
            <div className="grid grid-cols-3 gap-2">
              <input value={s.cipReturnPumpModel} onChange={(e) => setS((p) => ({ ...p, cipReturnPumpModel: e.target.value }))}
                className="col-span-1 px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Model" />
              <input type="number" value={s.cipReturnPumpKw} onChange={(e) => setS((p) => ({ ...p, cipReturnPumpKw: e.target.value }))}
                className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="kW" step="0.1" min={0} />
              <input type="number" value={s.cipReturnPumpImpellerSize} onChange={(e) => setS((p) => ({ ...p, cipReturnPumpImpellerSize: e.target.value }))}
                className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Çark (mm)" min={0} />
            </div>
          </div>
        )}
      </div>

      {/* Sabit değerler */}
      <div className="text-xs text-slate-500 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 font-mono">
        Drain: <strong>{drainSize}</strong> (sabit) · CIP Vanası: <strong>{cipSize}</strong> (sabit) · Check Valve: <strong>{cipSize}</strong> (sabit)
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex justify-between pt-1">
        <button onClick={handleDelete} disabled={deleting}
          className="px-3 py-1.5 text-xs text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50">
          {deleting ? 'Siliniyor...' : 'Sil'}
        </button>
        <button onClick={handleSave} disabled={!isValid || saving}
          className="px-4 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg transition-colors">
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
    </div>
  );
}
