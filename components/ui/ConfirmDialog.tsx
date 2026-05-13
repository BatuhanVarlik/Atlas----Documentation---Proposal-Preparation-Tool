'use client';

import Modal from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Onayla',
  cancelLabel = 'İptal',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmClass =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-300'
      : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300';

  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <div className="text-sm text-slate-600 dark:text-slate-300">{message}</div>
      <div className="flex justify-end gap-2 mt-5">
        <button
          onClick={onCancel}
          disabled={loading}
          className="px-3 py-1.5 text-xs border border-slate-300 dark:border-white/15 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`px-3 py-1.5 text-xs text-white rounded-lg transition-colors ${confirmClass}`}
        >
          {loading ? 'İşleniyor...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
