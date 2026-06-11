'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ModuleStatusBadge } from '@/components/ui/StatusBadge';
import { formatDate } from '@/lib/utils';
import ValveClusterPanel from '@/components/module-builder/ValveClusterPanel';
import TanksPanel from '@/components/module-builder/TanksPanel';
import TankCipReturnPanel from '@/components/module-builder/TankCipReturnPanel';
import SaveRevisionButton from '@/components/module-builder/SaveRevisionButton';
import Modal from '@/components/ui/Modal';
import { useModuleBuilder } from '@/store/moduleBuilderStore';

interface FillingLine {
  id: string;
  name: string;
  order: number;
  capacity: number;
  calculatedDiameter: number | null;
  valveType: string;
  valveControlUnit: string;
  connectedTankCount: number;
}

interface DischargeLine {
  id: string;
  name: string;
  order: number;
  capacity: number;
  pressure: number;
  calculatedDiameter: number | null;
  valveType: string;
  valveControlUnit: string;
  pumpModel: string | null;
  pumpKw: number | null;
  pumpImpellerSize: number | null;
  hasFlowMeter: boolean;
  hasPressureTransmitter: boolean;
  waterInletType: string | null;
  connectedTankCount: number;
}

interface Tank {
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

interface Module {
  id: string;
  name: string;
  customerName: string | null;
  projectCode: string | null;
  standard: string;
  productType: string;
  valveType: string | null;
  valveControlUnit: string | null;
  cipReturnValveType: string | null;
  waterInletValveType: string | null;
  tankCipInletValveType: string | null;
  tankCipInletDiameter: string | null;
  tankCipReturnManifoldExists: boolean;
  tankCipReturnLineCount: number;
  tankCipReturnPumpModel: string | null;
  tankCipReturnPumpKw: number | null;
  tankCipReturnPumpImpellerSize: number | null;
  // Teklif (commercial) bilgileri
  quotationNo: string | null;
  customerContactPerson: string | null;
  deliveryWeeks: number | null;
  deliveryPlace: string | null;
  offerValidityDays: number | null;
  status: 'DRAFT' | 'IN_PROGRESS' | 'REVIEW' | 'APPROVED' | 'DOCUMENT_GENERATED' | 'ARCHIVED' | 'CANCELLED';
  selectedDN: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  creator: { id: string; name: string };
  valveCluster: {
    id: string;
    fillingLines: FillingLine[];
    dischargeLines: DischargeLine[];
  } | null;
  tanks: Tank[];
}

interface Props {
  module: Module;
  userRole: string;
  userId: string;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  moduleType?: string;
}

interface GeneratedDoc {
  id: string;
  filename: string;
  filepath: string;
  size: number;
  createdAt: Date | string;
  template: { name: string };
}

export default function ModuleDetailClient({ module, userRole, userId }: Props) {
  const router = useRouter();
  const liveCalc = useModuleBuilder((s) => s.liveCalc);
  const pipeSize = liveCalc?.selectedDN.dn ?? module.selectedDN ?? '—';
  const drainSize = liveCalc?.drainValveSize ?? '—';
  const cipSize = liveCalc?.cipReturnSize ?? module.selectedDN ?? '—';
  const leakageSize = liveCalc ? `${liveCalc.leakageChamberMm} mm` : '25 mm';
  const [name, setName] = useState(module.name);
  const [customerName, setCustomerName] = useState(module.customerName ?? '');
  const [projectCode, setProjectCode] = useState(module.projectCode ?? '');
  // Teklif (commercial) bilgileri — doküman için
  const [contactPerson, setContactPerson] = useState(module.customerContactPerson ?? '');
  const [deliveryWeeks, setDeliveryWeeks] = useState<number | null>(module.deliveryWeeks);
  const [deliveryPlace, setDeliveryPlace] = useState(module.deliveryPlace ?? 'Customer Factory');
  const [offerValidityDays, setOfferValidityDays] = useState<number | null>(module.offerValidityDays ?? 30);
  const [standard, setStandard] = useState(module.standard);
  const [productType, setProductType] = useState(module.productType);
  const initialValveType =
    module.valveType ?? (module.productType === 'ULTRA_HYGIENIC' ? 'DA44' : 'SDE44');
  const initialControlUnit = module.valveControlUnit ?? 'AS_I';
  const initialCipReturnValveType = module.cipReturnValveType ?? 'SW_CIP41';
  const initialWaterInletValveType = module.waterInletValveType ?? '';
  const initialTankCipInletValveType = module.tankCipInletValveType ?? '';
  const initialTankCipInletDiameter = module.tankCipInletDiameter ?? '';
  const [valveType, setValveType] = useState<string>(initialValveType);
  const [valveControlUnit, setValveControlUnit] = useState<string>(initialControlUnit);
  const [cipReturnValveType, setCipReturnValveType] = useState<string>(initialCipReturnValveType);
  const [waterInletValveType, setWaterInletValveType] = useState<string>(initialWaterInletValveType);
  const [tankCipInletValveType, setTankCipInletValveType] = useState<string>(initialTankCipInletValveType);
  const [tankCipInletDiameter, setTankCipInletDiameter] = useState<string>(initialTankCipInletDiameter);
  const hasTankCipInlet = tankCipInletValveType !== '';

  const SMS_DIAMETERS = ['1"', '1,5"', '2"', '2,5"', '3"', '4"'] as const;
  const DIN_DIAMETERS = ['DN25', 'DN40', 'DN50', 'DN65', 'DN80', 'DN100'] as const;
  const tankCipDiameterOptions = standard === 'SMS' ? SMS_DIAMETERS : DIN_DIAMETERS;

  // Standart değişince mevcut çap uyumsuzsa temizle
  useEffect(() => {
    if (tankCipInletDiameter && !(tankCipDiameterOptions as readonly string[]).includes(tankCipInletDiameter)) {
      setTankCipInletDiameter('');
    }
  }, [standard, tankCipInletDiameter, tankCipDiameterOptions]);

  const availableValves: readonly string[] =
    productType === 'ULTRA_HYGIENIC' ? ['DA44'] : ['SDE44', 'D44', 'D44SL'];

  // Ürün tipi değişirse seçili vana uyumsuzsa otomatik sıfırla
  useEffect(() => {
    if (productType === 'ULTRA_HYGIENIC' && valveType !== 'DA44') {
      setValveType('DA44');
    } else if (productType === 'HYGIENIC' && valveType === 'DA44') {
      setValveType('SDE44');
    }
  }, [productType, valveType]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [showGenerate, setShowGenerate] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [docs, setDocs] = useState<GeneratedDoc[]>([]);

  useEffect(() => {
    fetch('/api/templates').then((r) => r.json()).then((j) => {
      if (j.success) {
        // Depolama + Genel (GENERIC) şablonlar — yoksa hepsi gösterilir
        const all = (j.data as Template[]).filter((t) => t.isActive);
        const storage = all.filter((t) => t.moduleType === 'STORAGE' || t.moduleType === 'GENERIC');
        setTemplates(storage.length > 0 ? storage : all);
      }
    });
    fetch(`/api/modules/${module.id}/documents`).then((r) => r.json()).then((j) => {
      if (j.success) setDocs(j.data as GeneratedDoc[]);
    });
  }, [module.id]);

  async function handleGenerate() {
    if (!selectedTemplate) { setGenerateError('Şablon seçin'); return; }
    setGenerating(true); setGenerateError('');
    try {
      const res = await fetch(`/api/modules/${module.id}/generate-doc`, {
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
      const docsRes = await fetch(`/api/modules/${module.id}/documents`);
      const docsJson = await docsRes.json();
      if (docsJson.success) setDocs(docsJson.data as GeneratedDoc[]);
      router.refresh();
    } finally { setGenerating(false); }
  }

  const isDirty =
    name !== module.name ||
    customerName !== (module.customerName ?? '') ||
    projectCode !== (module.projectCode ?? '') ||
    standard !== module.standard ||
    productType !== module.productType ||
    valveType !== initialValveType ||
    valveControlUnit !== initialControlUnit ||
    cipReturnValveType !== initialCipReturnValveType ||
    waterInletValveType !== initialWaterInletValveType ||
    tankCipInletValveType !== initialTankCipInletValveType ||
    tankCipInletDiameter !== initialTankCipInletDiameter ||
    contactPerson !== (module.customerContactPerson ?? '') ||
    deliveryWeeks !== module.deliveryWeeks ||
    deliveryPlace !== (module.deliveryPlace ?? 'Customer Factory') ||
    offerValidityDays !== (module.offerValidityDays ?? 30);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/modules/${module.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          customerName: customerName || null,
          projectCode: projectCode || null,
          standard,
          productType,
          valveType,
          valveControlUnit,
          cipReturnValveType,
          waterInletValveType: waterInletValveType || null,
          tankCipInletValveType: tankCipInletValveType || null,
          tankCipInletDiameter: hasTankCipInlet ? (tankCipInletDiameter || null) : null,
          customerContactPerson: contactPerson || null,
          deliveryWeeks,
          deliveryPlace: deliveryPlace || null,
          offerValidityDays,
        }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error ?? 'Hata oluştu'); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <SaveRevisionButton moduleId={module.id} />

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
            href={`/modules/${module.id}/preview`}
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

      {/* Header Kartı */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            {module.selectedDN && (
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                {module.selectedDN}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400">
            Güncellendi: {formatDate(module.updatedAt)}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Modül Adı</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Müşteri Adı</label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="örn: ABC Süt A.Ş."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Proje Kodu</label>
              <input
                value={projectCode}
                onChange={(e) => setProjectCode(e.target.value)}
                placeholder="örn: PRJ-2025-001"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Teklif Bilgileri (doküman) */}
          <div className="pt-3 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 mb-2">Teklif Bilgileri (Doküman)</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Teklif No (otomatik)</label>
                <input
                  value={module.quotationNo ?? '—'}
                  readOnly
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono bg-slate-100 text-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Müşteri İlgili Kişisi</label>
                <input
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="örn: Mrs Jane Doe"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Teslim Yeri</label>
                <input
                  value={deliveryPlace}
                  onChange={(e) => setDeliveryPlace(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Teslim Süresi (hafta)</label>
                <input
                  type="number"
                  min={0}
                  value={deliveryWeeks ?? ''}
                  onChange={(e) => setDeliveryWeeks(e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Teklif Geçerliliği (gün)</label>
                <input
                  type="number"
                  min={0}
                  value={offerValidityDays ?? ''}
                  onChange={(e) => setOfferValidityDays(e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Equipment tablosundaki adetler (Vana, Tank, Agitatör, Pompa, Flow Meter, Sensör) sistem tarafından
              otomatik hesaplanır; adedi 0 olan kalem belgede gösterilmez.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Standart</label>
              <div className="flex gap-2">
                {(['DIN', 'SMS'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStandard(s)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      standard === s
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-300 text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Ürün Tipi</label>
              <div className="flex gap-2">
                {([
                  { value: 'HYGIENIC', label: 'Hijyenik' },
                  { value: 'ULTRA_HYGIENIC', label: 'Ultrahijyenik' },
                ] as const).map((pt) => (
                  <button
                    key={pt.value}
                    onClick={() => setProductType(pt.value)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      productType === pt.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-300 text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Vana Tipi
                <span className="ml-2 text-xs font-normal text-slate-400">Tüm hatlara uygulanır</span>
              </label>
              <div className="flex gap-2 flex-wrap">
                {availableValves.map((v) => (
                  <button
                    key={v}
                    onClick={() => setValveType(v)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      valveType === v
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-300 text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Seçilen çap: <span className="font-mono text-slate-700">{pipeSize}</span>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Kontrol Ünitesi
                <span className="ml-2 text-xs font-normal text-slate-400">Tüm hatlara uygulanır</span>
              </label>
              <div className="flex gap-2">
                {([
                  { value: 'NONE', label: 'Yok' },
                  { value: 'AS_I', label: 'AS-i' },
                  { value: 'DC', label: 'DC' },
                ] as const).map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setValveControlUnit(c.value)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      valveControlUnit === c.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-300 text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                CIP Giriş/Dönüş Vana Tipi
                <span className="ml-2 text-xs font-normal text-slate-400">Her hatta sabit olarak eklenir</span>
              </label>
              <div className="flex gap-2">
                {([
                  { value: 'SW_CIP41', label: 'SW CIP41' },
                  { value: 'SD41', label: 'SD41' },
                ] as const).map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setCipReturnValveType(c.value)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      cipReturnValveType === c.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-300 text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Su Giriş Vanası Tipi
                <span className="ml-2 text-xs font-normal text-slate-400">Boşaltım hatlarına sabit eklenir</span>
              </label>
              <div className="flex gap-2">
                {([
                  { value: '', label: 'Yok' },
                  { value: 'SW_CIP42', label: 'SW CIP 42' },
                  { value: 'SD42', label: 'SD42' },
                ] as const).map((c) => (
                  <button
                    key={c.value || 'none'}
                    onClick={() => setWaterInletValveType(c.value)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      waterInletValveType === c.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-300 text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tank CIP Inlet Vanası */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tank CIP Inlet Vanası</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setTankCipInletValveType(''); setTankCipInletDiameter(''); }}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      !hasTankCipInlet ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:border-slate-400'
                    }`}
                  >Yok</button>
                  <button
                    onClick={() => { if (!hasTankCipInlet) setTankCipInletValveType('SW43'); }}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      hasTankCipInlet ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:border-slate-400'
                    }`}
                  >Var</button>
                </div>
              </div>
              {hasTankCipInlet && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Vana Tipi</label>
                  <div className="flex gap-2">
                    {(['SW43', 'SW44'] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setTankCipInletValveType(v)}
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          tankCipInletValveType === v ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:border-slate-400'
                        }`}
                      >{v}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {hasTankCipInlet && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Çap
                  <span className="ml-2 text-xs font-normal text-slate-400">{standard} standardı için seçenekler</span>
                </label>
                <select
                  value={tankCipInletDiameter}
                  onChange={(e) => setTankCipInletDiameter(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Çap seçin —</option>
                  {tankCipDiameterOptions.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-700 mb-1">Dolum Hatlarında Sabit Vana Grubu (+3 / hat)</p>
              <p className="flex items-center justify-between gap-2">
                <span>• Drain Vanası — <strong>SW41</strong></span>
                <span className="text-blue-700 font-mono text-[11px]">Çap: {drainSize}</span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>• Leakage Vanası — <strong>ESV</strong></span>
                <span className="text-blue-700 font-mono text-[11px]">Çap: {leakageSize} (sabit)</span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>• CIP Dönüş Vanası — <strong>{cipReturnValveType === 'SD41' ? 'SD41' : 'SW CIP41'}</strong></span>
                <span className="text-blue-700 font-mono text-[11px]">Çap: {cipSize}</span>
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-700 mb-1">
                Boşaltım Hatlarında Sabit Vana Grubu ({waterInletValveType ? '+3' : '+2'} / hat)
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>• CIP Giriş Vanası — <strong>{cipReturnValveType === 'SD41' ? 'SD41' : 'SW CIP41'}</strong></span>
                <span className="text-blue-700 font-mono text-[11px]">Çap: {cipSize}</span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>• Leakage Vana — <strong>ESV</strong></span>
                <span className="text-blue-700 font-mono text-[11px]">Çap: {leakageSize} (sabit)</span>
              </p>
              {waterInletValveType && (
                <p className="flex items-center justify-between gap-2">
                  <span>• Su Giriş Vanası — <strong>{waterInletValveType === 'SD42' ? 'SD42' : 'SW CIP 42'}</strong></span>
                  <span className="text-blue-700 font-mono text-[11px]">Çap: {pipeSize}</span>
                </p>
              )}
              {!waterInletValveType && (
                <p className="text-slate-400 italic">Su Giriş Vanası seçilmediği için hesaba dahil edilmez.</p>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Vana sayısı hesabı: (hatta bağlı tank) + dolum hatlarında 3, boşaltım hatlarında {waterInletValveType ? '3' : '2'} sabit.
          </p>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
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

      </div>

      {/* Valve Cluster Builder */}
      <div className="mb-5">
        <h2 className="text-base font-semibold text-slate-800 mb-3">Valve Cluster</h2>
        <ValveClusterPanel
          moduleId={module.id}
          standard={module.standard as 'DIN' | 'SMS'}
          valveCluster={module.valveCluster ?? null}
          hasWaterInlet={!!waterInletValveType}
        />
      </div>

      {/* Tank Builder */}
      <div className="mb-5">
        <h2 className="text-base font-semibold text-slate-800 mb-3">Tanklar</h2>
        <TanksPanel moduleId={module.id} tanks={module.tanks} />
      </div>

      {/* Tank CIP Dönüş */}
      <div className="mb-5">
        <h2 className="text-base font-semibold text-slate-800 mb-3">Tank CIP Dönüş</h2>
        <TankCipReturnPanel
          moduleId={module.id}
          tankCount={module.tanks.length}
          initial={{
            manifoldExists: module.tankCipReturnManifoldExists,
            lineCount: module.tankCipReturnLineCount,
            pumpModel: module.tankCipReturnPumpModel,
            pumpKw: module.tankCipReturnPumpKw,
            pumpImpellerSize: module.tankCipReturnPumpImpellerSize,
          }}
        />
      </div>

      {/* Belge Geçmişi */}
      {docs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
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
                  <a href={`/api/modules/${module.id}/documents/${doc.id}`} download
                    className="text-xs px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors">
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
              Aktif şablon bulunamadı. Admin panelinden şablon yükleyin.
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <button key={t.id} onClick={() => setSelectedTemplate(t.id)}
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
            <button onClick={() => { setShowGenerate(false); setGenerateError(''); }}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">İptal</button>
            <button onClick={handleGenerate} disabled={!selectedTemplate || generating || templates.length === 0}
              className="px-4 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 rounded-lg transition-colors">
              {generating ? 'Oluşturuluyor...' : 'Oluştur & İndir'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
