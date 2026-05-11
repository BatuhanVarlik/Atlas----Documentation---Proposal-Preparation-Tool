'use client';

import Link from 'next/link';
import { ProjectStatusBadge } from '@/components/ui/StatusBadge';
import { formatDate } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  customerName: string | null;
  code: string;
  description: string | null;
  status: 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
  createdAt: Date | string;
  department: { id: string; name: string; color: string | null };
  creator: { id: string; name: string };
}

interface Props {
  project: Project;
  userRole: string;
  userId: string;
}

export default function ProjectDetailClient({ project }: Props) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-5">
        <Link href="/projects" className="hover:text-slate-900 transition-colors">Projeler</Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">{project.name}</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-slate-900">{project.name}</h1>
              <ProjectStatusBadge status={project.status} />
            </div>
            <p className="text-sm text-slate-500 font-mono">{project.code}</p>
            {project.customerName && (
              <p className="text-sm text-slate-600 mt-1">Müşteri: {project.customerName}</p>
            )}
            {project.description && (
              <p className="text-sm text-slate-500 mt-2">{project.description}</p>
            )}
          </div>
          <div className="text-right text-xs text-slate-400 space-y-1">
            <p>
              <span
                className="inline-block w-2 h-2 rounded-full mr-1"
                style={{ backgroundColor: project.department.color ?? '#64748b' }}
              />
              {project.department.name}
            </p>
            <p>Oluşturan: {project.creator.name}</p>
            <p>{formatDate(project.createdAt)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
