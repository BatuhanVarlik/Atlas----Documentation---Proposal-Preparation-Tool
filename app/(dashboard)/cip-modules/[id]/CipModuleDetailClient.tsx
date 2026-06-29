'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Modal from '@/components/ui/Modal';
import { ModuleStatusBadge } from '@/components/ui/StatusBadge';
import { formatDate } from '@/lib/utils';
import CipTankCard, { type CipTank, type CipTankType } from '@/components/cip-builder/CipTankCard';
import CipLineRow, { type CipLine } from '@/components/cip-builder/CipLineRow';
import CipLineBulkForm, { type CipLineBulkPayload } from '@/components/cip-builder/CipLineBulkForm';

interface ModuleData {
  id: string;
  name: string;
  customerName: string | null;
  projectCode: string | null;
  standard: 'DIN' | 'SMS';
  valveControlUnit: 'NONE' | 'AS_I' | 'DC';
  systemType: 'FORWARD' | 'CIRCULATED';
  samplingValve: 'NONE' | 'MANUAL' | 'WITH_ACTUATOR';
  hasManholeSwitch: boolean;
  status: 'DRAFT' | 'IN_PROGRESS' | 'REVIEW' | 'APPROVED' | 'DOCUMENT_GENERATED' | 'ARCHIVED' | 'CANCELLED';
  quotationNo: string | null;
  customerContactPerson: string | null;
  deliveryWeeks: number | null;
  deliveryPlace: string | null;
  offerValidityDays: number | null;
  createdAt: Date | string;
  creator: { id: string; name: string };
  tanks: CipTank[];
  lines: CipLine[];
}

interface Props {
  module: ModuleData;
  userRole: string;
  userId: string;
}

const TANK_TYPES: { type: CipTankType; label: string }[] = [
  { type: 'CAUSTIC', label: 'Caustic Tank' },
  { type: 'ACID', label: 'Acid Tank' },
  { type: 'HOT_WATER', label: 'Hot Water Tank' },
  { type: 'RECOVERY', label: 'Recovery Tank' },
  { type: 'FRESH_WATER', label: 'Fresh Water Tank' },
];

export default function CipModuleDetailClient({ module }: Props) {
  const router = useRouter();

  const [name, setName] = useState(module.name);
  const [customerName, setCustomerName] = useState(module.customerName ?? '');
  const [projectCode, setProjectCode] = useState(module.projectCode ?? '');
  const [standard, setStandard] = useState<'DIN' | 'SMS'>(module.standard);
  const [valveControlUnit, setValveControlUnit] = useState<'NONE' | 'AS_I' | 'DC'>(module.valveControlUnit);
  const [systemType, setSystemType] = useState<'FORWARD' | 'CIRCULATED'>(module.systemType);
  const [samplingValve, setSamplingValve] = useState<'NONE' | 'MANUAL' | 'WITH_ACTUATOR'>(module.samplingValve);
  const [hasManholeSwitch, setHasManholeSwitch] = useState(module.hasManholeSwitch);

  const [contactPerson, setContactPerson] = useState(module.customerContactPerson ?? '');
  const [deliveryWeeks, setDeliveryWeeks] = useState<number | null>(module.deliveryWeeks);
  const [deliveryPlace, setDeliveryPlace] = useState(module.deliveryPlace ?? 'Customer Factory');
  const [offerValidityDays, setOfferValidityDays] = useState<number | null>(module.offerValidityDays ?? 30);

  const [tanks, setTanks] = useState<CipTank[]>(module.tanks);
  const [lines, setLines] = useState<CipLine[]>(module.lines);

  const dischargeLines = lines.filter((l) => l.lineKind === 'DISCHARGE');
  const returnLines = lines.filter((l) => l.lineKind === 'RETURN');
  const [updatingLines, setUpdatingLines] = useState(false);

  // İlk kapasitesi girilen tankın değeri — hat ekleme formuna otomatik aktarılır.
  const suggestedCapacity = tanks.find((t) => t.capacity > 0)?.capacity ?? null;

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
        const all = (j.data as Template[]).filter((t) => t.isActive);
        const cip = all.filter((t) => t.moduleType === 'CIP' || t.moduleType === 'GENERIC');
        setTemplates(cip.length > 0 ? cip : all);
      }
    });
    fetch(`/api/cip-modules/${module.id}/documents`).then((r) => r.json()).then((j) => {
      if (j.success) setDocs(j.data as GeneratedDoc[]);
    });
  }, [module.id]);

  async function handleBulkLines(lineKind: 'DISCHARGE' | 'RETURN', payload: CipLineBulkPayload) {
    setUpdatingLines(true); setError('');
    try {
      const res = await fetch(`/api/cip-modules/${module.id}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineKind, ...payload }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error ?? 'Hatlar güncellenemedi'); return; }
      setLines(json.data as CipLine[]);
    } finally { setUpdatingLines(false); }
  }

  async function handleSaveHeader() {
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/cip-modules/${module.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          customerName: customerName || null,
          projectCode: projectCode || null,
          standard,
          valveControlUnit,
          systemType,
          samplingValve,
          hasManholeSwitch,
          customerContactPerson: contactPerson || null,
          deliveryWeeks,
          deliveryPlace: deliveryPlace || null,
          offerValidityDays,
        }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error ?? 'Kaydedilemedi'); return; }
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      router.refresh();
    } finally { setSaving(false); }
  }

  async function handleGenerate() {
    if (!selectedTemplate) { setGenerateError('Şablon seçin'); return; }
    setGenerating(true); setGenerateError('');
    try {
      const res = await fetch(`/api/cip-modules/${module.id}/generate-doc`, {
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
      const docsRes = await fetch(`/api/cip-modules/${module.id}/documents`);
      const docsJson = await docsRes.json();
      if (docsJson.success) setDocs(docsJson.data as GeneratedDoc[]);
      router.refresh();
    } finally { setGenerating(false); }
  }

  async function handleDeleteDoc(docId: string) {
    if (!confirm('Bu belgeyi silmek istediğinize emin misiniz?')) return;
    const res = await fetch(`/api/cip-modules/${module.id}/documents/${docId}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) setDocs((prev) => prev.filter((d) => d.id !== docId));
    else alert(json.error ?? 'Belge silinemedi');
  }

  return (
    <div className="max-w-5xl">
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
            <span className="text-xs text-slate-500">{module.creator.name} · {formatDate(module.createdAt)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/cip-modules/${module.id}/preview`} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg">
            Önizleme →
          </Link>
          <button type="button" onClick={() => { setShowGenerate(true); setGenerateError(''); }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors">
            Teklif Oluştur (.docx)
          </button>
        </div>
      </div>

      {/* Genel Bilgiler */}
      <Card title="Genel Seçimler">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Modül Adı *"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
          <Field label="Müşteri Adı"><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputCls} /></Field>
          <Field label="Proje Kodu"><input value={projectCode} onChange={(e) => setProjectCode(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <Field label="Standart">
            <div className="flex gap-2">
              {(['DIN', 'SMS'] as const).map((s) => (
                <button key={s} type="button" onClick={() => setStandard(s)} className={pillCls(standard === s)}>{s}</button>
              ))}
            </div>
          </Field>
          <Field label="Valve Control Unit">
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
          <Field label="Sistem Tipi">
            <div className="flex gap-2">
              {([
                { v: 'FORWARD' as const, l: 'Forward' },
                { v: 'CIRCULATED' as const, l: 'Circulated' },
              ]).map((o) => (
                <button key={o.v} type="button" onClick={() => setSystemType(o.v)} className={pillCls(systemType === o.v)}>{o.l}</button>
              ))}
            </div>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label="Sampling Valve (tüm tanklar)">
            <div className="flex gap-2">
              {([
                { v: 'NONE' as const, l: 'Yok' },
                { v: 'MANUAL' as const, l: 'Manuel' },
                { v: 'WITH_ACTUATOR' as const, l: 'Aktüatörlü' },
              ]).map((o) => (
                <button key={o.v} type="button" onClick={() => setSamplingValve(o.v)} className={pillCls(samplingValve === o.v)}>{o.l}</button>
              ))}
            </div>
          </Field>
          <Field label="Manhole Switch">
            <div className="flex gap-2">
              {[
                { v: true, l: 'Var' },
                { v: false, l: 'Yok' },
              ].map((o) => (
                <button key={String(o.v)} type="button" onClick={() => setHasManholeSwitch(o.v)} className={pillCls(hasManholeSwitch === o.v)}>{o.l}</button>
              ))}
            </div>
          </Field>
        </div>
      </Card>

      {/* Teklif Bilgileri */}
      <Card title="Teklif Bilgileri (Doküman)">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Teklif No (otomatik)">
            <input value={module.quotationNo ?? '—'} readOnly className={`${inputCls} bg-slate-100 text-slate-500`} />
          </Field>
          <Field label="Müşteri İlgili Kişisi">
            <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Mrs Jane Doe" className={inputCls} />
          </Field>
          <Field label="Teslim Yeri">
            <input value={deliveryPlace} onChange={(e) => setDeliveryPlace(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label="Teslim Süresi (hafta)">
            <input type="number" min={0} value={deliveryWeeks ?? ''} onChange={(e) => setDeliveryWeeks(e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0))} className={inputCls} />
          </Field>
          <Field label="Teklif Geçerliliği (gün)">
            <input type="number" min={0} value={offerValidityDays ?? ''} onChange={(e) => setOfferValidityDays(e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0))} className={inputCls} />
          </Field>
        </div>
      </Card>

      {/* Tanklar */}
      <Card title="Tanklar">
        <div className="space-y-2">
          {TANK_TYPES.map(({ type, label }) => (
            <CipTankCard
              key={type}
              moduleId={module.id}
              tankType={type}
              label={label}
              tank={tanks.find((t) => t.tankType === type) ?? null}
              onChanged={setTanks}
            />
          ))}
        </div>
      </Card>

      {/* Hatlar */}
      <Card title={`Hatlar — ${systemType === 'FORWARD' ? 'Forward System' : 'Circulated System'}`}>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Discharge Lines (V=1.5 m/s)</h3>
            <CipLineBulkForm
              kind="DISCHARGE"
              standard={standard}
              currentCount={dischargeLines.length}
              busy={updatingLines}
              defaultCapacity={suggestedCapacity}
              onSubmit={(p) => handleBulkLines('DISCHARGE', p)}
            />
            <div className="space-y-2">
              {dischargeLines.map((line) => (
                <CipLineRow
                  key={line.id}
                  moduleId={module.id}
                  standard={standard}
                  line={line}
                  onSaved={(u) => setLines((curr) => curr.map((l) => (l.id === u.id ? u : l)))}
                  onDeleted={async (id) => {
                    await fetch(`/api/cip-modules/${module.id}/lines/${id}`, { method: 'DELETE' });
                    setLines((curr) => curr.filter((l) => l.id !== id));
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Return Lines (V=2.0 m/s)</h3>
            <CipLineBulkForm
              kind="RETURN"
              standard={standard}
              currentCount={returnLines.length}
              busy={updatingLines}
              defaultCapacity={suggestedCapacity}
              onSubmit={(p) => handleBulkLines('RETURN', p)}
            />
            <div className="space-y-2">
              {returnLines.map((line) => (
                <CipLineRow
                  key={line.id}
                  moduleId={module.id}
                  standard={standard}
                  line={line}
                  onSaved={(u) => setLines((curr) => curr.map((l) => (l.id === u.id ? u : l)))}
                  onDeleted={async (id) => {
                    await fetch(`/api/cip-modules/${module.id}/lines/${id}`, { method: 'DELETE' });
                    setLines((curr) => curr.filter((l) => l.id !== id));
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600 mb-3">{error}</div>
      )}

      <div className="flex justify-end gap-3 mb-5">
        {savedFlash && <span className="text-sm text-green-600 self-center">✓ Kaydedildi</span>}
        <button type="button" onClick={handleSaveHeader} disabled={saving}
          className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg">
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
                  <a href={`/api/cip-modules/${module.id}/documents/${doc.id}`} download
                    className="text-xs px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors">İndir</a>
                  <button onClick={() => handleDeleteDoc(doc.id)}
                    className="text-xs px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors">Sil</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Teklif Oluştur Modal */}
      <Modal open={showGenerate} onClose={() => { setShowGenerate(false); setGenerateError(''); }} title="Teklif Oluştur">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Belge oluşturulacak Word şablonunu seçin. Belge hazır olduğunda otomatik indirilir.</p>
          {templates.length === 0 ? (
            <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Aktif şablon bulunamadı. Admin panelinden CIP için şablon yükleyin.
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <button key={t.id} type="button" onClick={() => setSelectedTemplate(t.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                    selectedTemplate === t.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-slate-300'
                  }`}>
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
            <button type="button" onClick={() => { setShowGenerate(false); setGenerateError(''); }}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
            <button type="button" onClick={handleGenerate} disabled={!selectedTemplate || generating || templates.length === 0}
              className="px-4 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 rounded-lg transition-colors">
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
