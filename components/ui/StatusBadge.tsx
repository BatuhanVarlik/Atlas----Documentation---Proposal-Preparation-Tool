import { cn } from '@/lib/utils';

type ModuleStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'APPROVED'
  | 'DOCUMENT_GENERATED'
  | 'ARCHIVED'
  | 'CANCELLED';

type ProjectStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';

const MODULE_STATUS_MAP: Record<ModuleStatus, { label: string; className: string }> = {
  DRAFT:              { label: 'Taslak',           className: 'bg-slate-100 text-slate-600' },
  IN_PROGRESS:        { label: 'Devam Ediyor',     className: 'bg-blue-100 text-blue-700' },
  REVIEW:             { label: 'İncelemede',       className: 'bg-amber-100 text-amber-700' },
  APPROVED:           { label: 'Onaylandı',        className: 'bg-green-100 text-green-700' },
  DOCUMENT_GENERATED: { label: 'Belge Oluşturuldu', className: 'bg-purple-100 text-purple-700' },
  ARCHIVED:           { label: 'Arşivlendi',       className: 'bg-slate-100 text-slate-500' },
  CANCELLED:          { label: 'İptal',            className: 'bg-red-100 text-red-600' },
};

const PROJECT_STATUS_MAP: Record<ProjectStatus, { label: string; className: string }> = {
  ACTIVE:    { label: 'Aktif',       className: 'bg-green-100 text-green-700' },
  ON_HOLD:   { label: 'Beklemede',   className: 'bg-amber-100 text-amber-700' },
  COMPLETED: { label: 'Tamamlandı',  className: 'bg-blue-100 text-blue-700' },
  ARCHIVED:  { label: 'Arşivlendi', className: 'bg-slate-100 text-slate-500' },
};

interface ModuleBadgeProps {
  status: ModuleStatus;
}

interface ProjectBadgeProps {
  status: ProjectStatus;
}

export function ModuleStatusBadge({ status }: ModuleBadgeProps) {
  const config = MODULE_STATUS_MAP[status] ?? { label: status, className: 'bg-slate-100 text-slate-600' };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}

export function ProjectStatusBadge({ status }: ProjectBadgeProps) {
  const config = PROJECT_STATUS_MAP[status] ?? { label: status, className: 'bg-slate-100 text-slate-600' };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}
