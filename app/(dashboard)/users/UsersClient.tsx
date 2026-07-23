'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ContextMenu, { type ContextMenuEntry } from '@/components/ui/ContextMenu';
import { formatDate } from '@/lib/utils';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Yönetici',
  CEO: 'Genel Müdür',
  FINANCE_MANAGER: 'Finans Genel Müdürü',
  DEPARTMENT_MANAGER: 'Departman Müdürü',
  QUALITY_OBSERVER: 'Kalite Gözlemcisi',
  MEMBER: 'Üye',
};

const ROLE_OPTIONS = [
  { value: 'MEMBER', label: 'Üye' },
  { value: 'QUALITY_OBSERVER', label: 'Kalite Gözlemcisi' },
  { value: 'DEPARTMENT_MANAGER', label: 'Departman Müdürü' },
  { value: 'FINANCE_MANAGER', label: 'Finans Genel Müdürü' },
  { value: 'CEO', label: 'Genel Müdür' },
  { value: 'ADMIN', label: 'Yönetici' },
];

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date | string;
  department: { id: string; name: string; color: string | null } | null;
}

interface ResetRequest {
  id: string;
  requestedAt: Date | string;
  user: {
    id: string;
    name: string;
    email: string;
    department: { name: string } | null;
  };
}

interface Props {
  currentUserId: string;
  isAdmin: boolean;
  initialUsers: User[];
  departments: { id: string; name: string }[];
  initialResetRequests: ResetRequest[];
}

type SimpleModal =
  | { type: 'changeDept'; user: User }
  | { type: 'changeRole'; user: User }
  | null;

export default function UsersClient({
  currentUserId,
  isAdmin,
  initialUsers,
  departments,
  initialResetRequests,
}: Props) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [resetRequests, setResetRequests] = useState(initialResetRequests);

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? '');
  const [role, setRole] = useState<'ADMIN' | 'DEPARTMENT_MANAGER' | 'MEMBER'>('MEMBER');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Edit modal
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editDepartmentId, setEditDepartmentId] = useState('');
  const [editRole, setEditRole] = useState<'ADMIN' | 'DEPARTMENT_MANAGER' | 'MEMBER'>('MEMBER');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Simple modals (change dept / role)
  const [simpleModal, setSimpleModal] = useState<SimpleModal>(null);
  const [simpleValue, setSimpleValue] = useState('');
  const [simpleSaving, setSimpleSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; user: User } | null>(null);

  // Reset request resolving
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  function resetForm() {
    setName(''); setEmail(''); setPassword(''); setShowAddPassword(false);
    setDepartmentId(departments[0]?.id ?? '');
    setRole('MEMBER');
    setError('');
  }

  function openEdit(u: User) {
    setEditTarget(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPassword('');
    setShowEditPassword(false);
    setEditDepartmentId(u.department?.id ?? departments[0]?.id ?? '');
    setEditRole(u.role as typeof editRole);
    setEditError('');
  }

  function openSimple(type: 'changeDept' | 'changeRole', u: User) {
    setSimpleModal({ type, user: u } as SimpleModal);
    if (type === 'changeDept') setSimpleValue(u.department?.id ?? departments[0]?.id ?? '');
    else setSimpleValue(u.role);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Şifre en az 8 karakter olmalı'); return; }
    if (!departmentId) { setError('Departman seçin'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, departmentId, role }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error ?? 'Kullanıcı eklenemedi'); return; }
      setUsers((u) => [json.data, ...u]);
      setShowAdd(false);
      resetForm();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setEditError('');
    if (editPassword && editPassword.length < 8) {
      setEditError('Şifre en az 8 karakter olmalı'); return;
    }
    setEditSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: editName.trim(),
        email: editEmail.trim(),
        departmentId: editDepartmentId,
        role: editRole,
      };
      if (editPassword) payload.password = editPassword;

      const res = await fetch(`/api/users/${editTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) { setEditError(json.error ?? 'Güncellenemedi'); return; }
      setUsers((arr) => arr.map((u) => (u.id === editTarget.id ? json.data : u)));
      setEditTarget(null);
      router.refresh();
    } finally {
      setEditSaving(false);
    }
  }

  async function handleSimpleSave() {
    if (!simpleModal) return;
    setSimpleSaving(true);
    try {
      const payload: Record<string, unknown> = simpleModal.type === 'changeDept'
        ? { departmentId: simpleValue }
        : { role: simpleValue };
      const res = await fetch(`/api/users/${simpleModal.user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error ?? 'İşlem başarısız');
        return;
      }
      setUsers((arr) => arr.map((u) => (u.id === simpleModal.user.id ? json.data : u)));
      setSimpleModal(null);
      router.refresh();
    } finally {
      setSimpleSaving(false);
    }
  }

  // "Aktif Yap" — pasif kullanıcıyı yeniden aktifleştirir. isActive ORTAK DB'ye de yazılır
  // (PUT route setSharedUserActive çağırır) → sync geri almaz, kalıcı olur.
  async function handleActivate(u: User) {
    const res = await fetch(`/api/users/${u.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: true }),
    });
    const json = await res.json();
    if (!json.success) {
      alert(json.error ?? 'Aktifleştirilemedi');
      return;
    }
    setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, isActive: true } : x)));
    setCtxMenu(null);
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) {
        alert(json.error ?? 'Pasife alınamadı');
        return;
      }
      // Silme değil pasifleştirme → satır listede kalır, "Pasif" olur.
      setUsers((u) => u.map((x) => (x.id === deleteTarget.id ? { ...x, isActive: false } : x)));
      setDeleteTarget(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function resolveReset(id: string, action: 'approve' | 'reject') {
    setResolvingId(id);
    try {
      const res = await fetch(`/api/password-reset/requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error ?? 'İşlem başarısız');
        return;
      }
      setResetRequests((rs) => rs.filter((r) => r.id !== id));
      router.refresh();
    } finally {
      setResolvingId(null);
    }
  }

  function onRowContextMenu(e: React.MouseEvent<HTMLTableRowElement>, u: User) {
    if (!isAdmin) return;
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, user: u });
  }

  const ctxItems: ContextMenuEntry[] = ctxMenu
    ? [
        { label: 'Düzenle', onClick: () => openEdit(ctxMenu.user) },
        { label: 'Departman Değiştir', onClick: () => openSimple('changeDept', ctxMenu.user) },
        { label: 'Rol Değiştir', onClick: () => openSimple('changeRole', ctxMenu.user) },
        { divider: true },
        ctxMenu.user.isActive
          ? {
              label: 'Pasife Al',
              onClick: () => setDeleteTarget(ctxMenu.user),
              variant: 'danger',
              disabled: ctxMenu.user.id === currentUserId,
            }
          : {
              label: 'Aktif Yap',
              onClick: () => handleActivate(ctxMenu.user),
              disabled: ctxMenu.user.id === currentUserId,
            },
      ]
    : [];

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Kullanıcılar</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {users.length} kullanıcı{isAdmin ? ' · Sağ tık ile işlemler' : ''}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { resetForm(); setShowAdd(true); }}
            className="px-4 py-2 bg-secondary hover:bg-secondary-container text-white text-sm font-semibold rounded-lg transition-colors"
          >
            + Kullanıcı Ekle
          </button>
        )}
      </div>

      {isAdmin && resetRequests.length > 0 && (
        <section className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-3">
            Bekleyen Şifre Sıfırlama Talepleri ({resetRequests.length})
          </h2>
          <ul className="space-y-2">
            {resetRequests.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between bg-white dark:bg-[#0a2147] border border-amber-200 dark:border-amber-800/50 rounded-lg px-4 py-3"
              >
                <div className="text-sm">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {r.user.name} <span className="text-slate-400 font-normal">·</span>{' '}
                    <span className="text-slate-500 dark:text-slate-400">{r.user.email}</span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {r.user.department?.name ?? '—'} · {formatDate(r.requestedAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => resolveReset(r.id, 'reject')}
                    disabled={resolvingId === r.id}
                    className="px-3 py-1.5 text-xs border border-slate-300 dark:border-white/15 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50"
                  >
                    Reddet
                  </button>
                  <button
                    onClick={() => resolveReset(r.id, 'approve')}
                    disabled={resolvingId === r.id}
                    className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
                  >
                    {resolvingId === r.id ? '...' : 'Onayla'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bg-white dark:bg-[#0a2147] border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-[#06203f] border-b border-slate-200 dark:border-white/10">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Ad Soyad</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">E-posta</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Rol</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Departman</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Kayıt</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                onContextMenu={(e) => onRowContextMenu(e, u)}
                className={`border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${isAdmin ? 'cursor-context-menu' : ''}`}
              >
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{u.name}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono text-xs">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/30">
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.department ? (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full border"
                      style={{
                        color: u.department.color ?? '#475569',
                        borderColor: u.department.color ?? '#cbd5e1',
                        backgroundColor: (u.department.color ?? '#475569') + '15',
                      }}
                    >
                      {u.department.name}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{formatDate(u.createdAt)}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                  Henüz kullanıcı yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxItems}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* Add modal */}
      {isAdmin && (
        <Modal open={showAdd} onClose={() => { setShowAdd(false); resetForm(); }} title="Yeni Kullanıcı">
          <form onSubmit={handleAdd} className="space-y-3">
            <Field label="İsim Soyisim *">
              <input
                value={name} onChange={(e) => setName(e.target.value)} required minLength={2}
                className={INPUT_CLS}
              />
            </Field>
            <Field label="E-posta *">
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className={INPUT_CLS}
              />
            </Field>
            <Field label="Şifre *" help="En az 8 karakter">
              <PasswordInput
                value={password}
                onChange={setPassword}
                show={showAddPassword}
                onToggle={() => setShowAddPassword((s) => !s)}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Departman *">
                <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} required className={INPUT_CLS}>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Rol *">
                <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className={INPUT_CLS}>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </Field>
            </div>
            {error && <ErrorBox>{error}</ErrorBox>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setShowAdd(false); resetForm(); }} className={BTN_SECONDARY}>İptal</button>
              <button type="submit" disabled={saving} className={BTN_PRIMARY}>
                {saving ? 'Ekleniyor...' : 'Kullanıcıyı Ekle'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit modal */}
      {isAdmin && (
        <Modal open={editTarget !== null} onClose={() => { if (!editSaving) setEditTarget(null); }} title="Kullanıcıyı Düzenle">
          {editTarget && (
            <form onSubmit={handleEditSave} className="space-y-3">
              <Field label="İsim Soyisim *">
                <input value={editName} onChange={(e) => setEditName(e.target.value)} required minLength={2} className={INPUT_CLS} />
              </Field>
              <Field label="E-posta *">
                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required className={INPUT_CLS} />
              </Field>
              <Field label="Şifre" help="Değiştirmek istemiyorsanız boş bırakın (min 8 karakter)">
                <PasswordInput
                  value={editPassword}
                  onChange={setEditPassword}
                  show={showEditPassword}
                  onToggle={() => setShowEditPassword((s) => !s)}
                  placeholder="••••••••"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Departman *">
                  <select value={editDepartmentId} onChange={(e) => setEditDepartmentId(e.target.value)} required className={INPUT_CLS}>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Rol *">
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as typeof editRole)}
                    className={INPUT_CLS}
                    disabled={editTarget.id === currentUserId}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  {editTarget.id === currentUserId && (
                    <p className="text-[10px] text-slate-400 mt-1">Kendi rolünüzü değiştiremezsiniz.</p>
                  )}
                </Field>
              </div>
              {editError && <ErrorBox>{editError}</ErrorBox>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditTarget(null)} disabled={editSaving} className={BTN_SECONDARY}>İptal</button>
                <button type="submit" disabled={editSaving} className={BTN_PRIMARY}>
                  {editSaving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* Simple modals — departman / rol değiştir */}
      <Modal
        open={simpleModal !== null}
        onClose={() => { if (!simpleSaving) setSimpleModal(null); }}
        title={simpleModal?.type === 'changeDept' ? 'Departman Değiştir' : 'Rol Değiştir'}
      >
        {simpleModal && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <strong>{simpleModal.user.name}</strong> için yeni{' '}
              {simpleModal.type === 'changeDept' ? 'departman' : 'rol'} seçin.
            </p>
            <select
              value={simpleValue}
              onChange={(e) => setSimpleValue(e.target.value)}
              className={INPUT_CLS}
              disabled={simpleModal.type === 'changeRole' && simpleModal.user.id === currentUserId}
            >
              {simpleModal.type === 'changeDept'
                ? departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)
                : ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            {simpleModal.type === 'changeRole' && simpleModal.user.id === currentUserId && (
              <p className="text-xs text-amber-600 dark:text-amber-400">Kendi rolünüzü değiştiremezsiniz.</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setSimpleModal(null)} disabled={simpleSaving} className={BTN_SECONDARY}>İptal</button>
              <button
                onClick={handleSimpleSave}
                disabled={simpleSaving || (simpleModal.type === 'changeRole' && simpleModal.user.id === currentUserId)}
                className={BTN_PRIMARY}
              >
                {simpleSaving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Pasife alma onayı */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Kullanıcıyı Pasife Al"
        message={
          deleteTarget && (
            <>
              <strong>{deleteTarget.name}</strong> ({deleteTarget.email}) pasife alınacak; giriş yapamaz ama tüm kayıtları korunur. Bu işlem tüm uygulamalara yansır. Devam edilsin mi?
            </>
          )
        }
        confirmLabel="Pasife Al"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
      />
    </div>
  );
}

const INPUT_CLS =
  'w-full px-3 py-2 text-sm border border-slate-300 dark:border-white/15 bg-white dark:bg-[#06203f] dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60';
const BTN_PRIMARY =
  'px-4 py-2 text-sm font-semibold bg-secondary hover:bg-secondary-container text-white rounded-lg disabled:opacity-60 disabled:cursor-not-allowed';
const BTN_SECONDARY =
  'px-3 py-2 text-sm border border-slate-300 dark:border-white/15 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50';

function Field({ label, children, help }: { label: string; children: React.ReactNode; help?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">{label}</label>
      {children}
      {help && <p className="text-[10px] text-slate-400 mt-1">{help}</p>}
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
      {children}
    </p>
  );
}

function EyeIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-6.5 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function PasswordInput({
  value,
  onChange,
  show,
  onToggle,
  required,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={required ? 8 : undefined}
        autoComplete="new-password"
        placeholder={placeholder ?? '••••••••'}
        className={INPUT_CLS + ' pr-10 font-mono'}
      />
      <button
        type="button"
        onClick={onToggle}
        tabIndex={-1}
        aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'}
        title={show ? 'Şifreyi gizle' : 'Şifreyi göster'}
        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
