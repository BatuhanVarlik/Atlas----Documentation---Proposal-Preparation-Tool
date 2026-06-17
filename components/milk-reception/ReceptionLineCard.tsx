'use client';

import { useEffect, useRef, useState } from 'react';
import Combobox from '@/components/ui/Combobox';
import NumberInputTR from '@/components/ui/NumberInputTR';
import { PUMP_MODELS, getImpellersForPump, pumpHasImpeller } from '@/lib/constants/pumpOptions';
import { useAutoPumpSelection } from '@/hooks/useAutoPumpSelection';
import type { AutoPumpResult } from '@/lib/pumps/autoSelect';

export interface ReceptionLine {
  id: string;
  name: string;
  order: number;
  capacity: number;
  pressure: number;
  calculatedDiameter: number | null;
  pumpModel: string | null;
  pumpKw: number | null;
  pumpImpellerSize: number | null;
  filterUnitCount: number;
  pressureMeterType: 'MANOMETER' | 'PRESSURE_TRANSMITTER';
  hasMilkClarifier: boolean;
  clarifierBypassValveType: 'SW44' | 'SW41' | null;
  hasPhe: boolean;
  pheCapacity: number | null;
  pheIceWaterTempSensorType: 'PT100' | 'THERMOMETER' | null;
  pheIceWaterPressureMeterType: 'MANOMETER' | 'PRESSURE_TRANSMITTER' | null;
  hasSamplingValve: boolean;
  samplingValveType: 'MANUAL' | 'WITH_ACTUATOR' | null;
}

interface Props {
  moduleId: string;
  line: ReceptionLine;
  index: number;
  onSaved: (updated: ReceptionLine) => void;
  onDeleted: (id: string) => void;
}

export default function ReceptionLineCard({ moduleId, line, index, onSaved, onDeleted }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ReceptionLine>(line);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update<K extends keyof ReceptionLine>(key: K, value: ReceptionLine[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  // Otomatik pompa seçimi (kapasite/basınç → pompa seçim sayfasındaki yeşil aday).
  const { suggestion, loading: autoLoading, error: autoError } = useAutoPumpSelection(
    state.capacity,
    state.pressure,
  );
  // null başlar: kayıtlı (elle seçilmiş) pompa açılışta ezilmez; yalnızca boş pompa otomatik dolar.
  const lastAutoModel = useRef<string | null>(null);

  function applyPump(s: AutoPumpResult) {
    setState((prev) => ({
      ...prev,
      pumpModel: s.pumpModel,
      pumpKw: s.pumpKw,
      pumpImpellerSize: s.pumpImpellerSize,
    }));
    lastAutoModel.current = s.pumpModel;
  }

  // Kullanıcı pompayı elle değiştirmediyse (boş ya da son otomatik değer) öneriyi uygula.
  useEffect(() => {
    if (!suggestion) return;
    if (!state.pumpModel || state.pumpModel === lastAutoModel.current) applyPump(suggestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestion]);

  async function handleSave() {
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/milk-reception-modules/${moduleId}/lines/${line.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: state.name,
          capacity: state.capacity || null,
          pressure: state.pressure || null,
          pumpModel: state.pumpModel || null,
          pumpKw: state.pumpKw,
          pumpImpellerSize: state.pumpImpellerSize,
          filterUnitCount: state.filterUnitCount,
          pressureMeterType: state.pressureMeterType,
          hasMilkClarifier: state.hasMilkClarifier,
          clarifierBypassValveType: state.hasMilkClarifier ? state.clarifierBypassValveType : null,
          hasPhe: state.hasPhe,
          pheCapacity: state.hasPhe ? (state.pheCapacity ?? (state.capacity || null)) : null,
          pheIceWaterTempSensorType: state.hasPhe ? state.pheIceWaterTempSensorType : null,
          pheIceWaterPressureMeterType: state.hasPhe ? state.pheIceWaterPressureMeterType : null,
          hasSamplingValve: state.hasSamplingValve,
          samplingValveType: state.hasSamplingValve ? state.samplingValveType : null,
        }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error ?? 'Kaydedilemedi'); return; }
      onSaved(json.data as ReceptionLine);
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm(`"${line.name}" hattını silmek istediğinize emin misiniz?`)) return;
    const res = await fetch(`/api/milk-reception-modules/${moduleId}/lines/${line.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) { alert(json.error ?? 'Silinemedi'); return; }
    onDeleted(line.id);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400">#{index + 1}</span>
          <span className="text-sm font-semibold text-slate-800">{state.name}</span>
          <span className="text-xs text-slate-500">
            {state.capacity > 0 ? `${state.capacity.toLocaleString('tr-TR')} L/h` : 'Kapasite girilmemiş'}
          </span>
        </div>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-slate-100 space-y-5">
          {/* Temel bilgiler */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="İsim">
              <input value={state.name} onChange={(e) => update('name', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Kapasite (L/h)">
              <NumberInputTR
                value={state.capacity || null}
                onChange={(n) => update('capacity', n ?? 0)}
                mode="integer"
                className={inputCls}
              />
            </Field>
            <Field label="Basınç (Bar)">
              <NumberInputTR
                value={state.pressure || null}
                onChange={(n) => update('pressure', n ?? 0)}
                mode="decimal"
                decimals={2}
                className={inputCls}
              />
            </Field>
          </div>

          {/* Pompa */}
          <Section title="Pompa">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-[11px]">
                {autoLoading && <span className="text-slate-400">Pompa hesaplanıyor…</span>}
                {!autoLoading && suggestion && (
                  <span className="text-emerald-700">
                    Önerilen: <strong>{suggestion.pumpModel}</strong>
                    {suggestion.pumpImpellerSize != null && ` · Ø${suggestion.pumpImpellerSize} mm`}
                    {suggestion.pumpKw != null && ` · Motor ${suggestion.pumpKw} kW`}
                    {suggestion.powerConsumptionKw != null && ` (çekiş ${suggestion.powerConsumptionKw} kW)`}
                  </span>
                )}
                {!autoLoading && autoError && state.capacity > 0 && state.pressure > 0 && (
                  <span className="text-amber-600">{autoError}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => suggestion && applyPump(suggestion)}
                disabled={!suggestion}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 shrink-0"
              >
                ⟳ Otomatik Pompa Seç
              </button>
            </div>
            {(() => {
              const pumpModel = state.pumpModel ?? '';
              const impellerOptions = getImpellersForPump(pumpModel);
              const hasImpeller = pumpHasImpeller(pumpModel);
              return (
                <div className={`grid gap-3 ${hasImpeller ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <Field label="Model">
                    <Combobox
                      value={pumpModel}
                      onChange={(v) => {
                        update('pumpModel', v || null);
                        if (!pumpHasImpeller(v)) {
                          if (state.pumpImpellerSize) update('pumpImpellerSize', null);
                        } else if (state.pumpImpellerSize) {
                          const opts = getImpellersForPump(v);
                          if (opts.length > 0 && !opts.includes(Number(state.pumpImpellerSize))) {
                            update('pumpImpellerSize', null);
                          }
                        }
                      }}
                      options={PUMP_MODELS}
                      placeholder="Yazın veya listeden seçin"
                    />
                  </Field>
                  <Field label="kW">
                    <NumberInputTR
                      value={state.pumpKw}
                      onChange={(n) => update('pumpKw', n)}
                      mode="decimal"
                      decimals={2}
                      className={inputCls}
                    />
                  </Field>
                  {hasImpeller && (
                    <Field label="Çark Boyutu (mm)">
                      <Combobox
                        value={state.pumpImpellerSize != null ? String(state.pumpImpellerSize) : ''}
                        onChange={(v) => update('pumpImpellerSize', v ? Number(v) : null)}
                        options={impellerOptions}
                        type="number"
                        min={0}
                        placeholder={impellerOptions.length > 0 ? 'Yazın veya seçin' : 'Pompa seçin'}
                      />
                    </Field>
                  )}
                </div>
              );
            })()}
          </Section>

          {/* Filter Unit */}
          <Section title="Filter Unit">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sayı">
                <div className="flex gap-2">
                  {[
                    { v: 1, l: 'Tek (500 µ)' },
                    { v: 2, l: 'Çift (500 + 200 µ)' },
                  ].map((o) => (
                    <button key={o.v} type="button" onClick={() => update('filterUnitCount', o.v)}
                      className={pillCls(state.filterUnitCount === o.v)}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Basınç ölçer tipi">
                <div className="flex gap-2">
                  {[
                    { v: 'MANOMETER' as const, l: 'Manometer' },
                    { v: 'PRESSURE_TRANSMITTER' as const, l: 'Pressure Transmitter' },
                  ].map((o) => (
                    <button key={o.v} type="button" onClick={() => update('pressureMeterType', o.v)}
                      className={pillCls(state.pressureMeterType === o.v)}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Her unit içinde 4 manuel ESV kelebek vana + 2 filtre var. Basınç ölçer sayısı: 1 unit → 2 adet, 2 unit → 3 adet (otomatik).
            </p>
          </Section>

          {/* Milk Clarifier */}
          <Section title="Milk Clarifier">
            <YesNoToggle
              value={state.hasMilkClarifier}
              onChange={(v) => update('hasMilkClarifier', v)}
            />
            {state.hasMilkClarifier && (
              <Field label="By-pass vana çeşidi" className="mt-3">
                <div className="flex gap-2">
                  {(['SW44', 'SW41'] as const).map((o) => (
                    <button key={o} type="button" onClick={() => update('clarifierBypassValveType', o)}
                      className={pillCls(state.clarifierBypassValveType === o)}>
                      {o}
                    </button>
                  ))}
                </div>
              </Field>
            )}
          </Section>

          {/* PHE */}
          <Section title="Plate Heat Exchanger (PHE)">
            <YesNoToggle value={state.hasPhe} onChange={(v) => update('hasPhe', v)} />
            {state.hasPhe && (
              <div className="grid grid-cols-3 gap-3 mt-3">
                <Field label="Kapasite (L/h)">
                  <NumberInputTR
                    // Boş bırakılırsa üstte girilen hat kapasitesini miras alır.
                    value={state.pheCapacity ?? (state.capacity || null)}
                    onChange={(n) => update('pheCapacity', n)}
                    mode="integer"
                    className={inputCls}
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Boş bırakılırsa hat kapasitesi kullanılır</p>
                </Field>
                <Field label="Ice water — sıcaklık sensörü">
                  <div className="flex gap-2">
                    {(['PT100', 'THERMOMETER'] as const).map((o) => (
                      <button key={o} type="button" onClick={() => update('pheIceWaterTempSensorType', o)}
                        className={pillCls(state.pheIceWaterTempSensorType === o)}>
                        {o === 'PT100' ? 'PT100' : 'Termometre'}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Ice water — basınç ölçer">
                  <div className="flex gap-2">
                    {(['MANOMETER', 'PRESSURE_TRANSMITTER'] as const).map((o) => (
                      <button key={o} type="button" onClick={() => update('pheIceWaterPressureMeterType', o)}
                        className={pillCls(state.pheIceWaterPressureMeterType === o)}>
                        {o === 'MANOMETER' ? 'Manometer' : 'Pressure Transmitter'}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            )}
            {state.hasPhe && (
              <p className="text-[11px] text-slate-500 mt-2">
                Sabit bileşenler: PHE çıkış PT100 (süt sıcaklığı), Ice water dönüş termometresi, kontrol ünitesine bağlı kelebek vana + sabit manuel kelebek vana (ESV).
              </p>
            )}
          </Section>

          {/* Sampling Valve */}
          <Section title="Numune Vanası (Sampling)">
            <YesNoToggle value={state.hasSamplingValve} onChange={(v) => update('hasSamplingValve', v)} />
            {state.hasSamplingValve && (
              <Field label="Tip" className="mt-3">
                <div className="flex gap-2">
                  {(['MANUAL', 'WITH_ACTUATOR'] as const).map((o) => (
                    <button key={o} type="button" onClick={() => update('samplingValveType', o)}
                      className={pillCls(state.samplingValveType === o)}>
                      {o === 'MANUAL' ? 'Manuel' : 'Aktüatörlü'}
                    </button>
                  ))}
                </div>
              </Field>
            )}
          </Section>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 justify-between pt-1">
            <button type="button" onClick={handleDelete}
              className="px-3 py-1.5 text-sm text-red-600 border border-red-200 hover:bg-red-50 rounded-lg">
              Hattı Sil
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="px-4 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg">
              {saving ? 'Kaydediliyor...' : 'Hattı Kaydet'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
function pillCls(active: boolean) {
  return `flex-1 py-1.5 px-3 rounded-lg border text-xs font-medium transition-colors ${active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`;
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
      <p className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

function YesNoToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => onChange(true)} className={pillCls(value)}>Var</button>
      <button type="button" onClick={() => onChange(false)} className={pillCls(!value)}>Yok</button>
    </div>
  );
}
