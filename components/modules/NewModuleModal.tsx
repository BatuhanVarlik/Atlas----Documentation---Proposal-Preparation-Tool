'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/ui/Modal';

type ModuleTypeKey = 'STORAGE' | 'MILK_RECEPTION';

const MODULE_TYPE_OPTIONS: { value: ModuleTypeKey; label: string; description: string }[] = [
  {
    value: 'STORAGE',
    label: 'Raw Milk Storage',
    description: 'Valve Cluster (dolum/boşaltım) + Tanklar yapısı',
  },
  {
    value: 'MILK_RECEPTION',
    label: 'Raw Milk Reception (Süt Alım)',
    description: 'Süt alım hatları (Degazör + Filter + Clarifier + PHE) + Tanker CIP',
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  defaultType?: ModuleTypeKey;
}

export default function NewModuleModal({ open, onClose, defaultType = 'STORAGE' }: Props) {
  const router = useRouter();
  const [moduleType, setModuleType] = useState<ModuleTypeKey>(defaultType);
  const [name, setName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [standard, setStandard] = useState<'DIN' | 'SMS'>('DIN');
  const [productType, setProductType] = useState<'HYGIENIC' | 'ULTRA_HYGIENIC'>('HYGIENIC');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setModuleType(defaultType);
    setName(''); setCustomerName(''); setProjectCode('');
    setStandard('DIN'); setProductType('HYGIENIC');
    setError('');
  }

  function handleClose() {
    if (creating) return;
    reset();
    onClose();
  }

  async function handleCreate() {
    if (!name.trim()) { setError('Modül adı zorunludur'); return; }
    setCreating(true); setError('');
    try {
      if (moduleType === 'STORAGE') {
        const res = await fetch('/api/modules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            customerName: customerName.trim() || undefined,
            projectCode: projectCode.trim() || undefined,
            standard,
            productType,
          }),
        });
        const json = await res.json();
        if (!json.success) { setError(json.error ?? 'Hata'); return; }
        reset();
        onClose();
        router.push(`/modules/${json.data.id}`);
      } else {
        const res = await fetch('/api/milk-reception-modules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            customerName: customerName.trim() || undefined,
            projectCode: projectCode.trim() || undefined,
            standard,
          }),
        });
        const json = await res.json();
        if (!json.success) { setError(json.error ?? 'Hata'); return; }
        reset();
        onClose();
        router.push(`/milk-reception-modules/${json.data.id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Yeni Modül Oluştur">
      <div className="space-y-4">
        {/* Modül Tipi */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Modül Tipi <span className="text-red-500">*</span>
          </label>
          <select
            value={moduleType}
            onChange={(e) => setModuleType(e.target.value as ModuleTypeKey)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MODULE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500 mt-1">
            {MODULE_TYPE_OPTIONS.find((o) => o.value === moduleType)?.description}
          </p>
        </div>

        {/* Ortak alanlar */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Modül Adı <span className="text-red-500">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={moduleType === 'STORAGE' ? 'örn: Raw Milk Storage' : 'örn: Raw Milk Reception'}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
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
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Standart</label>
          <div className="flex gap-2">
            {(['DIN', 'SMS'] as const).map((s) => (
              <button
                key={s}
                type="button"
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

        {/* Storage'a özel: Ürün Tipi */}
        {moduleType === 'STORAGE' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Ürün Tipi</label>
            <div className="flex gap-2">
              {([
                { value: 'HYGIENIC', label: 'Hijyenik' },
                { value: 'ULTRA_HYGIENIC', label: 'Ultrahijyenik' },
              ] as const).map((pt) => (
                <button
                  key={pt.value}
                  type="button"
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
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3 justify-end pt-1">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg transition-colors"
          >
            {creating ? 'Oluşturuluyor...' : 'Oluştur'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
