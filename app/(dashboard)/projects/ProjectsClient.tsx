'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Modal from '@/components/ui/Modal';
import { ProjectStatusBadge } from '@/components/ui/StatusBadge';
import { formatDate } from '@/lib/utils';

interface Department {
  id: string;
  name: string;
  color: string | null;
}

interface Project {
  id: string;
  name: string;
  customerName: string | null;
  code: string;
  status: 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
  createdAt: Date | string;
  department: { id: string; name: string; color: string | null };
  creator: { id: string; name: string };
}

interface Props {
  initialProjects: Project[];
  departments: Department[];
  userRole: string;
  userDepartmentId: string;
}

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Aktif' },
  { value: 'ON_HOLD', label: 'Beklemede' },
  { value: 'COMPLETED', label: 'Tamamlandı' },
  { value: 'ARCHIVED', label: 'Arşivlendi' },
];

export default function ProjectsClient({
  initialProjects,
  departments,
  userRole,
  userDepartmentId,
}: Props) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [showCreate, setShowCreate] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.customerName ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function handleCreate(data: {
    name: string;
    code: string;
    customerName: string;
    description: string;
    departmentId: string;
  }) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? 'Hata oluştu');
        return;
      }
      setProjects((prev) => [json.data, ...prev]);
      setShowCreate(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleEdit(data: { name: string; customerName: string; description: string; status: string }) {
    if (!editProject) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${editProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? 'Hata oluştu');
        return;
      }
      setProjects((prev) => prev.map((p) => (p.id === editProject.id ? json.data : p)));
      setEditProject(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${deleteId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setProjects((prev) => prev.filter((p) => p.id !== deleteId));
        setDeleteId(null);
      }
    } finally {
      setLoading(false);
    }
  }

  const canDelete = userRole === 'ADMIN' || userRole === 'DEPARTMENT_MANAGER';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projeler</h1>
          <p className="text-slate-500 text-sm mt-0.5">{projects.length} proje</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Yeni Proje
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Proje adı, kodu veya müşteri ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-sm px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-400 text-sm">
            {searchQuery ? 'Aramanızla eşleşen proje yok.' : 'Henüz proje yok.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Proje</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Müşteri</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Departman</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Durum</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Modüller</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Tarih</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((project) => (
                <tr
                  key={project.id}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-medium text-slate-900 hover:text-blue-600 transition-colors"
                    >
                      {project.name}
                    </Link>
                    <p className="text-xs text-slate-400 mt-0.5">{project.code}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {project.customerName ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs"
                      style={{ color: project.department.color ?? '#64748b' }}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: project.department.color ?? '#64748b' }}
                      />
                      {project.department.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ProjectStatusBadge status={project.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">—</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {formatDate(project.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setEditProject(project)}
                        className="text-xs text-slate-500 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                      >
                        Düzenle
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => setDeleteId(project.id)}
                          className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                        >
                          Sil
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Yeni Proje Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setError(''); }} title="Yeni Proje">
        <ProjectForm
          departments={departments}
          userRole={userRole}
          userDepartmentId={userDepartmentId}
          loading={loading}
          error={error}
          onCancel={() => { setShowCreate(false); setError(''); }}
          onSubmit={(data) => handleCreate(data as Parameters<typeof handleCreate>[0])}
        />
      </Modal>

      {/* Düzenle Modal */}
      <Modal open={!!editProject} onClose={() => { setEditProject(null); setError(''); }} title="Projeyi Düzenle">
        {editProject && (
          <EditProjectForm
            project={editProject}
            loading={loading}
            error={error}
            onCancel={() => { setEditProject(null); setError(''); }}
            onSubmit={handleEdit}
          />
        )}
      </Modal>

      {/* Sil Onay Modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Projeyi Sil" size="sm">
        <p className="text-sm text-slate-600 mb-5">
          Bu projeyi ve içindeki tüm modülleri silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setDeleteId(null)}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-lg transition-colors"
          >
            {loading ? 'Siliniyor...' : 'Sil'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ---- Form Bileşenleri ----

interface ProjectFormProps {
  departments: Department[];
  userRole: string;
  userDepartmentId: string;
  loading: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (data: {
    name: string;
    code: string;
    customerName: string;
    description: string;
    departmentId: string;
  }) => void;
}

function ProjectForm({ departments, userRole, userDepartmentId, loading, error, onCancel, onSubmit }: ProjectFormProps) {
  const [form, setForm] = useState({
    name: '',
    code: '',
    customerName: '',
    description: '',
    departmentId: userRole === 'ADMIN' ? departments[0]?.id ?? '' : userDepartmentId,
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const isValid = form.name.trim() && form.code.trim() && form.departmentId;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Proje Adı *</label>
        <input
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="örn: ABC Süt — Hat 2 Yenileme"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Proje Kodu *</label>
        <input
          value={form.code}
          onChange={(e) => set('code', e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="örn: PRJ-2025-001"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Müşteri Adı</label>
        <input
          value={form.customerName}
          onChange={(e) => set('customerName', e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="örn: ABC Süt A.Ş."
        />
      </div>
      {userRole === 'ADMIN' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Departman *</label>
          <select
            value={form.departmentId}
            onChange={(e) => set('departmentId', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label>
        <textarea
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Kısa açıklama..."
        />
      </div>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}
      <div className="flex gap-3 justify-end pt-1">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
          İptal
        </button>
        <button
          disabled={!isValid || loading}
          onClick={() => onSubmit(form)}
          className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg transition-colors"
        >
          {loading ? 'Oluşturuluyor...' : 'Oluştur'}
        </button>
      </div>
    </div>
  );
}

interface EditProjectFormProps {
  project: Project;
  loading: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (data: { name: string; customerName: string; description: string; status: string }) => void;
}

function EditProjectForm({ project, loading, error, onCancel, onSubmit }: EditProjectFormProps) {
  const [form, setForm] = useState({
    name: project.name,
    customerName: project.customerName ?? '',
    description: '',
    status: project.status,
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Proje Adı</label>
        <input
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Müşteri Adı</label>
        <input
          value={form.customerName}
          onChange={(e) => set('customerName', e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Durum</label>
        <select
          value={form.status}
          onChange={(e) => set('status', e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}
      <div className="flex gap-3 justify-end pt-1">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
          İptal
        </button>
        <button
          disabled={loading}
          onClick={() => onSubmit(form)}
          className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg transition-colors"
        >
          {loading ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
    </div>
  );
}
