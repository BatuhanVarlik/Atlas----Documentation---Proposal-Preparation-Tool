'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ModuleStatusBadge } from '@/components/ui/StatusBadge';
import { formatDate } from '@/lib/utils';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ContextMenu, { type ContextMenuEntry } from '@/components/ui/ContextMenu';
import NewModuleModal from '@/components/modules/NewModuleModal';

export type ModuleType = 'STORAGE' | 'MILK_RECEPTION' | 'CIP';

export interface UnifiedModule {
  id: string;
  type: ModuleType;
  name: string;
  customerName: string | null;
  projectCode: string | null;
  standard: string;
  productType: string | null;
  status: 'DRAFT' | 'IN_PROGRESS' | 'REVIEW' | 'APPROVED' | 'DOCUMENT_GENERATED' | 'ARCHIVED' | 'CANCELLED';
  childCount: number;
  childLabel: string;
  createdAt: Date | string;
  creator: { id: string; name: string };
}

interface Props {
  initialModules: UnifiedModule[];
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

const TYPE_LABELS: Record<ModuleType, string> = {
  STORAGE: 'Raw Milk Storage',
  MILK_RECEPTION: 'Raw Milk Reception',
  CIP: 'CIP (Clean-in-Place)',
};

const PRODUCT_LABELS: Record<string, string> = {
  HYGIENIC: 'Hijyenik',
  ULTRA_HYGIENIC: 'Ultrahijyenik',
};

function moduleHref(m: UnifiedModule): string {
  if (m.type === 'STORAGE') return `/modules/${m.id}`;
  if (m.type === 'CIP') return `/cip-modules/${m.id}`;
  return `/milk-reception-modules/${m.id}`;
}

function moduleApiBase(m: UnifiedModule): string {
  if (m.type === 'STORAGE') return `/api/modules/${m.id}`;
  if (m.type === 'CIP') return `/api/cip-modules/${m.id}`;
  return `/api/milk-reception-modules/${m.id}`;
}

export default function ModulesClient({ initialModules }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [standardFilter, setStandardFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'' | ModuleType>('');

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; module: UnifiedModule } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UnifiedModule | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(moduleApiBase(deleteTarget), { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) {
        alert(json.error ?? 'Silinemedi');
        return;
      }
      setDeleteTarget(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  const [showCreate, setShowCreate] = useState(false);

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
      const matchType = !typeFilter || m.type === typeFilter;
      return matchSearch && matchStatus && matchStandard && matchType;
    });
  }, [initialModules, search, statusFilter, standardFilter, typeFilter]);

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
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-secondary hover:bg-secondary-container text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + Yeni Modül
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          placeholder="Modül adı, müşteri veya kod ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-64"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as '' | ModuleType)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tüm Modül Tipleri</option>
          <option value="STORAGE">Raw Milk Storage</option>
          <option value="MILK_RECEPTION">Raw Milk Reception</option>
          <option value="CIP">CIP (Clean-in-Place)</option>
        </select>
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
        {(search || statusFilter || standardFilter || typeFilter) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setStandardFilter(''); setTypeFilter(''); }}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Temizle
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-400 text-sm">
            {search || statusFilter || standardFilter || typeFilter
              ? 'Filtreyle eşleşen modül yok.'
              : 'Henüz modül yok. Yeni modül oluşturun.'}
          </p>
          {!search && !statusFilter && !standardFilter && !typeFilter && (
            <button
              onClick={() => setShowCreate(true)}
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
                <th className="text-left px-4 py-3 font-medium text-slate-600">Tip</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Müşteri</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Standart</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Ürün Tipi</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Durum</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Hat / Tank</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Oluşturan</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Tarih</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((mod) => (
                <tr
                  key={`${mod.type}-${mod.id}`}
                  onClick={() => router.push(moduleHref(mod))}
                  onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, module: mod }); }}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900 hover:text-blue-600 transition-colors">
                      {mod.name}
                    </span>
                    {mod.projectCode && (
                      <p className="text-xs text-slate-400 font-mono">{mod.projectCode}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${mod.type === 'STORAGE' ? 'bg-blue-50 text-blue-700' : mod.type === 'CIP' ? 'bg-teal-50 text-teal-700' : 'bg-purple-50 text-purple-700'}`}>
                      {TYPE_LABELS[mod.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {mod.customerName ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{mod.standard}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {mod.productType ? (PRODUCT_LABELS[mod.productType] ?? mod.productType) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3"><ModuleStatusBadge status={mod.status} /></td>
                  <td className="px-4 py-3 text-slate-600">
                    {mod.childCount} <span className="text-[11px] text-slate-400">{mod.childLabel}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{mod.creator.name}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(mod.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewModuleModal open={showCreate} onClose={() => setShowCreate(false)} defaultType="STORAGE" />

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={[
            {
              label: 'Modülü Sil',
              variant: 'danger',
              onClick: () => setDeleteTarget(ctxMenu.module),
            } as ContextMenuEntry,
          ]}
          onClose={() => setCtxMenu(null)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Modülü Sil"
        message={
          deleteTarget && (
            <>
              <strong>{deleteTarget.name}</strong> modülü ve ilişkili tüm verileri kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam edilsin mi?
            </>
          )
        }
        confirmLabel="Sil"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
      />
    </div>
  );
}
