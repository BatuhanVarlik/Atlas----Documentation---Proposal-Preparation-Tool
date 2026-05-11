'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ModuleStatusBadge } from '@/components/ui/StatusBadge';
import { formatDate } from '@/lib/utils';
import Modal from '@/components/ui/Modal';

interface Module {
  id: string;
  name: string;
  customerName: string | null;
  projectCode: string | null;
  standard: string;
  productType: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'REVIEW' | 'APPROVED' | 'DOCUMENT_GENERATED' | 'ARCHIVED' | 'CANCELLED';
  createdAt: Date | string;
  creator: { id: string; name: string };
  _count: { tanks: number };
}

interface Props {
  initialModules: Module[];
  userRole: string;
  userId: string;
}

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Tüm Durumlar' },
  { value: 'DRAFT', label: 'Taslak' },
  { value: 'IN_PROGRESS', label: 'Devam Ediyor' },
  { value: 'REVIEW', label: 'İncelemede' },
  { value: 'APPROVED', label: 'Onaylandı' },
  { value: 'DOCUMENT_GENERATED', label: 'Belge Oluşturuldu' },
  { value: 'ARCHIVED', label: 'Arşivlendi' },
];

const STANDARD_LABELS: Record<string, string> = { DIN: 'DIN', SMS: 'SMS' };
const PRODUCT_LABELS: Record<string, string> = {
  HYGIENIC: 'Hijyenik',
  ULTRA_HYGIENIC: 'Ultrahijyenik',
};

export default function ModulesClient({ initialModules, userRole, userId }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [standardFilter, setStandardFilter] = useState('');

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCustomer, setNewCustomer] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newStandard, setNewStandard] = useState<'DIN' | 'SMS'>('DIN');
  const [newProductType, setNewProductType] = useState<'HYGIENIC' | 'ULTRA_HYGIENIC'>('HYGIENIC');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const filtered = useMemo(() => {
    return initialModules.filter((m) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.customerName ?? '').toLowerCase().includes(q) ||
        (m.projectCode ?? '').toLowerCase().includes(q);
      const matchStatus = !statusFilter || m.status === statusFilter;
      const matchStandard = !standardFilter || m.standard === standardFilter;
      return matchSearch && matchStatus && matchStandard;
    });
  }, [initialModules, search, statusFilter, standardFilter]);

  function resetCreateForm() {
    setNewName(''); setNewCustomer(''); setNewCode('');
    setNewStandard('DIN'); setNewProductType('HYGIENIC');
    setCreateError('');
  }

  async function handleCreate() {
    if (!newName.trim()) { setCreateError('Modül adı zorunludur'); return; }
    setCreating(true); setCreateError('');
    try {
      const res = await fetch('/api/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          customerName: newCustomer.trim() || undefined,
          projectCode: newCode.trim() || undefined,
          standard: newStandard,
          productType: newProductType,
        }),
      });
      const json = await res.json();
      if (!json.success) { setCreateError(json.error ?? 'Hata'); return; }
      setShowCreate(false);
      resetCreateForm();
      router.push(`/modules/${json.data.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Modüller</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {filtered.length} / {initialModules.length} modül
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(true); resetCreateForm(); }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + Yeni Modül
        </button>
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          placeholder="Modül adı, müşteri veya kod ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-64"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUS_FILTER_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={standardFilter}
          onChange={(e) => setStandardFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tüm Standartlar</option>
          <option value="DIN">DIN</option>
          <option value="SMS">SMS</option>
        </select>
        {(search || statusFilter || standardFilter) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setStandardFilter(''); }}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Temizle
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-400 text-sm">
            {search || statusFilter || standardFilter
              ? 'Filtreyle eşleşen modül yok.'
              : 'Henüz modül yok. Yeni modül oluşturun.'}
          </p>
          {!search && !statusFilter && !standardFilter && (
            <button
              onClick={() => { setShowCreate(true); resetCreateForm(); }}
              className="inline-block mt-3 text-sm text-blue-600 hover:text-blue-700"
            >
              + Yeni Modül Oluştur
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Modül</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Müşteri</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Standart</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Ürün Tipi</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Durum</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Tanklar</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Oluşturan</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Tarih</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((mod) => (
                <tr key={mod.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/modules/${mod.id}`}
                      className="font-medium text-slate-900 hover:text-blue-600 transition-colors"
                    >
                      {mod.name}
                    </Link>
                    {mod.projectCode && (
                      <p className="text-xs text-slate-400 font-mono">{mod.projectCode}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {mod.customerName ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{STANDARD_LABELS[mod.standard]}</td>
                  <td className="px-4 py-3 text-slate-600">{PRODUCT_LABELS[mod.productType]}</td>
                  <td className="px-4 py-3"><ModuleStatusBadge status={mod.status} /></td>
                  <td className="px-4 py-3 text-slate-600">{mod._count.tanks}</td>
                  <td className="px-4 py-3 text-slate-500">{mod.creator.name}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(mod.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Yeni Modül Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); resetCreateForm(); }} title="Yeni Modül Oluştur">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Modül Adı <span className="text-red-500">*</span></label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="örn: Raw Milk Storage"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Müşteri Adı</label>
              <input
                value={newCustomer}
                onChange={(e) => setNewCustomer(e.target.value)}
                placeholder="örn: ABC Süt A.Ş."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Proje Kodu</label>
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="örn: PRJ-2025-001"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Standart</label>
            <div className="flex gap-2">
              {(['DIN', 'SMS'] as const).map((s) => (
                <button key={s} onClick={() => setNewStandard(s)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${newStandard === s ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Ürün Tipi</label>
            <div className="flex gap-2">
              {([{ value: 'HYGIENIC', label: 'Hijyenik' }, { value: 'ULTRA_HYGIENIC', label: 'Ultrahijyenik' }] as const).map((pt) => (
                <button key={pt.value} onClick={() => setNewProductType(pt.value)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${newProductType === pt.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`}>
                  {pt.label}
                </button>
              ))}
            </div>
          </div>
          {createError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{createError}</p>
          )}
          <div className="flex gap-3 justify-end pt-1">
            <button onClick={() => { setShowCreate(false); resetCreateForm(); }}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
              İptal
            </button>
            <button onClick={handleCreate} disabled={!newName.trim() || creating}
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg transition-colors">
              {creating ? 'Oluşturuluyor...' : 'Oluştur'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
