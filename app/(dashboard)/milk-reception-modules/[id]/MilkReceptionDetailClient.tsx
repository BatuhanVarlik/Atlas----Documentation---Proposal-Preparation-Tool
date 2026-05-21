'use client';

import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ModuleStatusBadge } from '@/components/ui/StatusBadge';
import { formatDate } from '@/lib/utils';
import ReceptionLineCard, { type ReceptionLine } from '@/components/milk-reception/ReceptionLineCard';
import { calculatePipeDiameter } from '@/lib/calc/pipeDiameter';
import { selectDN } from '@/lib/calc/selectDN';
import Combobox from '@/components/ui/Combobox';
import NumberInputTR from '@/components/ui/NumberInputTR';
import { PUMP_MODELS, getImpellersForPump, pumpHasImpeller } from '@/lib/constants/pumpOptions';
import SaveRevisionButton from '@/components/module-builder/SaveRevisionButton';

interface ModuleData {
  id: string;
  name: string;
  customerName: string | null;
  projectCode: string | null;
  standard: 'DIN' | 'SMS';
  valveControlUnit: 'NONE' | 'AS_I' | 'DC';
  status: 'DRAFT' | 'IN_PROGRESS' | 'REVIEW' | 'APPROVED' | 'DOCUMENT_GENERATED' | 'ARCHIVED' | 'CANCELLED';

  hasTankerCip: boolean;
  tankerCipCapacity: number | null;
  tankerCipPressure: number | null;
  tankerCipPumpModel: string | null;
  tankerCipPumpKw: number | null;
  tankerCipPumpImpellerSize: number | null;

  createdAt: Date | string;
  updatedAt: Date | string;
  creator: { id: string; name: string };
  receptionLines: ReceptionLine[];
}

interface Props {
  module: ModuleData;
  userRole: string;
  userId: string;
}

export default function MilkReceptionDetailClient({ module }: Props) {
  const router = useRouter();

  // Header
  const [name, setName] = useState(module.name);
  const [customerName, setCustomerName] = useState(module.customerName ?? '');
  const [projectCode, setProjectCode] = useState(module.projectCode ?? '');
  const [standard, setStandard] = useState<'DIN' | 'SMS'>(module.standard);
  const [valveControlUnit, setValveControlUnit] = useState<'NONE' | 'AS_I' | 'DC'>(module.valveControlUnit);

  // Tanker CIP
  const [hasTankerCip, setHasTankerCip] = useState(module.hasTankerCip);
  const [tankerCapacity, setTankerCapacity] = useState<number | null>(module.tankerCipCapacity);
  const [tankerPressure, setTankerPressure] = useState<number | null>(module.tankerCipPressure);
  const [tankerPumpModel, setTankerPumpModel] = useState(module.tankerCipPumpModel ?? '');
  const [tankerPumpKw, setTankerPumpKw] = useState<number | null>(module.tankerCipPumpKw);
  const [tankerPumpImpeller, setTankerPumpImpeller] = useState<number | null>(module.tankerCipPumpImpellerSize);

  // Lines
  const [lines, setLines] = useState<ReceptionLine[]>(module.receptionLines);
  const [lineCount, setLineCount] = useState<number>(lines.length || 1);
  const [updatingCount, setUpdatingCount] = useState(false);

  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState('');

  // Teklif Oluştur / Belge Geçmişi
  interface Template { id: string; name: string; description: string | null; isActive: boolean; moduleType?: string }
  interface GeneratedDoc { id: string; filename: string; filepath: string; size: number; createdAt: Date | string; template: { name: string } }
  const [showGenerate, setShowGenerate] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [docs, setDocs] = useState<GeneratedDoc[]>([]);

  useEffect(() => {
    fetch('/api/templates').then((r) => r.json()).then((j) => {
      if (j.success) {
        // Yalnızca MILK_RECEPTION şablonları (varsa) — yoksa hepsi gösterilir
        const all = (j.data as Template[]).filter((t) => t.isActive);
        const milk = all.filter((t) => t.moduleType === 'MILK_RECEPTION');
        setTemplates(milk.length > 0 ? milk : all);
      }
    });
    fetch(`/api/milk-reception-modules/${module.id}/documents`).then((r) => r.json()).then((j) => {
      if (j.success) setDocs(j.data as GeneratedDoc[]);
    });
  }, [module.id]);

  async function handleGenerate() {
    if (!selectedTemplate) { setGenerateError('Şablon seçin'); return; }
    setGenerating(true); setGenerateError('');
    try {
      const res = await fetch(`/api/milk-reception-modules/${module.id}/generate-doc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplate }),
      });
      const json = await res.json();
      if (!json.success) { setGenerateError(json.error ?? 'Hata'); return; }
      const a = document.createElement('a');
      a.href = json.data.downloadUrl as string;
      a.download = json.data.filename as string;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setShowGenerate(false);
      setSelectedTemplate('');
      const docsRes = await fetch(`/api/milk-reception-modules/${module.id}/documents`);
      const docsJson = await docsRes.json();
      if (docsJson.success) setDocs(docsJson.data as GeneratedDoc[]);
      router.refresh();
    } finally { setGenerating(false); }
  }

  // Hat başına hesaplanan çap (V=2, tüm hatlarda)
  const lineCalculations = useMemo(() => {
    return lines.map((l) => {
      if (!l.capacity || l.capacity <= 0) return { lineId: l.id, dn: null, inner: null };
      const d = calculatePipeDiameter({ capacityLh: l.capacity, velocity: 2.0 });
      try {
        const sel = selectDN(d.diameterMm, standard);
        return { lineId: l.id, dn: sel.dn, inner: sel.inner, raw: d.diameterMm };
      } catch {
        return { lineId: l.id, dn: null, inner: null, raw: d.diameterMm };
      }
    });
  }, [lines, standard]);

  async function handleSetLineCount() {
    setUpdatingCount(true); setError('');
    try {
      const res = await fetch(`/api/milk-reception-modules/${module.id}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: lineCount }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error ?? 'Hat sayısı güncellenemedi'); return; }
      setLines(json.data as ReceptionLine[]);
    } finally { setUpdatingCount(false); }
  }

  async function handleSaveHeader() {
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/milk-reception-modules/${module.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          customerName: customerName || null,
          projectCode: projectCode || null,
          standard,
          valveControlUnit,
          hasTankerCip,
          tankerCipCapacity: hasTankerCip ? tankerCapacity : null,
          tankerCipPressure: hasTankerCip ? tankerPressure : null,
          tankerCipPumpModel: hasTankerCip ? (tankerPumpModel || null) : null,
          tankerCipPumpKw: hasTankerCip ? tankerPumpKw : null,
          tankerCipPumpImpellerSize: hasTankerCip ? tankerPumpImpeller : null,
        }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error ?? 'Kaydedilemedi'); return; }
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      router.refresh();
    } finally { setSaving(false); }
  }

  return (
    <div className="max-w-5xl">
      <SaveRevisionButton moduleId={module.id} apiBase="/api/milk-reception-modules" />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-5">
        <Link href="/modules" className="hover:text-slate-900">Modüller</Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">{module.name}</span>
      </div>

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{module.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <ModuleStatusBadge status={module.status} />
            <span className="text-xs text-slate-500">
              {module.creator.name} · {formatDate(module.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/milk-reception-modules/${module.id}/preview`}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg"
          >
            Önizleme →
          </Link>
          <button
            type="button"
            onClick={() => { setShowGenerate(true); setGenerateError(''); }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Teklif Oluştur (.docx)
          </button>
        </div>
      </div>

      {/* Modül Bilgileri */}
      <Card title="Modül Bilgileri">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Modül Adı *">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Müşteri Adı">
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Proje Kodu">
            <input value={projectCode} onChange={(e) => setProjectCode(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label="Standart">
            <div className="flex gap-2">
              {(['DIN', 'SMS'] as const).map((s) => (
                <button key={s} type="button" onClick={() => setStandard(s)} className={pillCls(standard === s)}>{s}</button>
              ))}
            </div>
          </Field>
          <Field label="Vana Kontrol Ünitesi">
            <div className="flex gap-2">
              {([
                { v: 'NONE' as const, l: 'Yok (Pnömatik)' },
                { v: 'AS_I' as const, l: 'AS-i' },
                { v: 'DC' as const, l: 'DC' },
              ]).map((o) => (
                <button key={o.v} type="button" onClick={() => setValveControlUnit(o.v)} className={pillCls(valveControlUnit === o.v)}>{o.l}</button>
              ))}
            </div>
          </Field>
        </div>
        <p className="text-[11px] text-slate-500 mt-3">
          Sistem sabitleri (otomatik): Panel (hat sayısı kadar) · Degazör (her hatta — Air Exhaust ESV DN25/SMS25, LSH, LSL, Butterfly outlet ESV) · Flow Meter electromagnetic Krohne · Temperature sensor PT100 · Water inlet valve SW-CIP41.
        </p>
      </Card>

      {/* Süt Alım Hatları */}
      <Card title="Süt Alım Hatları">
        <div className="flex items-end gap-3 mb-4">
          <Field label="Hat sayısı">
            <input
              type="number"
              min={1}
              max={20}
              value={lineCount}
              onChange={(e) => setLineCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              className={`${inputCls} w-24`}
            />
          </Field>
          <button
            type="button"
            disabled={updatingCount || lineCount === lines.length}
            onClick={handleSetLineCount}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg"
          >
            {updatingCount ? 'Güncelleniyor...' : lineCount > lines.length ? `+ ${lineCount - lines.length} Hat Ekle` : lineCount < lines.length ? `- ${lines.length - lineCount} Hat Çıkar` : 'Onayla'}
          </button>
          <span className="text-xs text-slate-500 pb-2">Mevcut: {lines.length} hat</span>
        </div>

        {lines.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Henüz hat yok. Sayı belirleyip &quot;Hat Ekle&quot; deyin.</p>
        ) : (
          <div className="space-y-2">
            {lines.map((line, i) => {
              const calc = lineCalculations.find((c) => c.lineId === line.id);
              return (
                <div key={line.id}>
                  <ReceptionLineCard
                    moduleId={module.id}
                    line={line}
                    index={i}
                    onSaved={(updated) =>
                      setLines((curr) => curr.map((l) => (l.id === updated.id ? updated : l)))
                    }
                    onDeleted={(id) => setLines((curr) => curr.filter((l) => l.id !== id))}
                  />
                  {calc?.dn && (
                    <p className="text-[11px] text-slate-500 mt-0.5 ml-5">
                      Hesaplanan boru çapı (V=2): <strong className="text-slate-700 font-mono">{calc.dn}</strong> · iç çap {calc.inner} mm
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Tanker CIP */}
      <Card title="Tanker CIP Station">
        <div className="flex gap-2 mb-3">
          {[
            { v: true, l: 'Var' },
            { v: false, l: 'Yok' },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              onClick={() => setHasTankerCip(o.v)}
              className={pillCls(hasTankerCip === o.v) + ' max-w-32'}
            >
              {o.l}
            </button>
          ))}
        </div>
        {hasTankerCip && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Kapasite (L/h)">
                <NumberInputTR
                  value={tankerCapacity}
                  onChange={setTankerCapacity}
                  mode="integer"
                  className={inputCls}
                />
              </Field>
              <Field label="Basınç (Bar)">
                <NumberInputTR
                  value={tankerPressure}
                  onChange={setTankerPressure}
                  mode="decimal"
                  decimals={2}
                  className={inputCls}
                />
              </Field>
            </div>
            {(() => {
              const impellerOptions = getImpellersForPump(tankerPumpModel);
              const hasImpeller = pumpHasImpeller(tankerPumpModel);
              return (
                <div className={`grid gap-3 ${hasImpeller ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <Field label="Pompa Model">
                    <Combobox
                      value={tankerPumpModel}
                      onChange={(v) => {
                        setTankerPumpModel(v);
                        if (!pumpHasImpeller(v)) {
                          if (tankerPumpImpeller != null) setTankerPumpImpeller(null);
                        } else if (tankerPumpImpeller != null) {
                          const opts = getImpellersForPump(v);
                          if (opts.length > 0 && !opts.includes(tankerPumpImpeller)) {
                            setTankerPumpImpeller(null);
                          }
                        }
                      }}
                      options={PUMP_MODELS}
                      placeholder="Yazın veya listeden seçin"
                    />
                  </Field>
                  <Field label="Pompa kW">
                    <NumberInputTR
                      value={tankerPumpKw}
                      onChange={setTankerPumpKw}
                      mode="decimal"
                      decimals={2}
                      className={inputCls}
                    />
                  </Field>
                  {hasImpeller && (
                    <Field label="Çark Boyutu (mm)">
                      <Combobox
                        value={tankerPumpImpeller == null ? '' : String(tankerPumpImpeller)}
                        onChange={(v) => setTankerPumpImpeller(v ? Number(v) : null)}
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
            <p className="text-[11px] text-slate-500 mt-3">
              Tanker CIP sabit bileşenler: Degazör + Air Exhaust ESV (DN25/SMS25) + LSH + LSL + Butterfly outlet ESV + Check Valve VPN. CIP boru çapı V=2 ile ayrı hesaplanır.
            </p>
          </>
        )}
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600 mb-3">{error}</div>
      )}

      <div className="flex justify-end gap-3 mb-5">
        {savedFlash && <span className="text-sm text-green-600 self-center">✓ Kaydedildi</span>}
        <button
          type="button"
          onClick={handleSaveHeader}
          disabled={saving}
          className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg"
        >
          {saving ? 'Kaydediliyor...' : 'Modülü Kaydet'}
        </button>
      </div>

      {/* Belge Geçmişi */}
      {docs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-12">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Oluşturulan Belgeler</h3>
          <ul className="space-y-2">
            {docs.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-slate-700">{doc.filename}</span>
                  <span className="text-xs text-slate-400 ml-2">{doc.template.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{formatDate(doc.createdAt)}</span>
                  <span className="text-xs text-slate-400">{Math.round(doc.size / 1024)} KB</span>
                  <a
                    href={doc.filepath}
                    download
                    className="text-xs px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                  >
                    İndir
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Teklif Oluştur Modal */}
      <Modal open={showGenerate} onClose={() => { setShowGenerate(false); setGenerateError(''); }} title="Teklif Oluştur">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Belge oluşturulacak Word şablonunu seçin. Belge hazır olduğunda otomatik indirilir.
          </p>
          {templates.length === 0 ? (
            <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Aktif şablon bulunamadı. Admin panelinden Süt Alım için şablon yükleyin.
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTemplate(t.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                    selectedTemplate === t.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="font-medium">{t.name}</span>
                  {t.description && <span className="text-slate-500 ml-2 text-xs">{t.description}</span>}
                </button>
              ))}
            </div>
          )}
          {generateError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{generateError}</p>
          )}
          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={() => { setShowGenerate(false); setGenerateError(''); }}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!selectedTemplate || generating || templates.length === 0}
              className="px-4 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 rounded-lg transition-colors"
            >
              {generating ? 'Oluşturuluyor...' : 'Oluştur & İndir'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
function pillCls(active: boolean) {
  return `flex-1 py-1.5 px-3 rounded-lg border text-xs font-medium transition-colors ${active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 mb-4">{title}</h2>
      {children}
    </div>
  );
}
