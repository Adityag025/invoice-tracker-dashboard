import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, Search, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import api from '../../lib/api';

interface Project {
  id: string;
  name: string;
  type: string;
  budget?: number;
  client: { name: string };
  startDate?: string;
  endDate?: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export const ProjectsListPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery<{ projects: Project[]; total: number }>({
    queryKey: ['projects', search],
    queryFn: () => api.get('/projects', { params: { search: search || undefined } }).then(r => r.data),
  });

  const filtered = data?.projects ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold text-on-surface">Projects</h1>
          <p className="text-outline text-sm mt-0.5">{data?.total ?? 0} projects</p>
        </div>
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search projects…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-10">No projects found</p>
          )}
          {filtered.map(project => (
            <div
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                project.type === 'RETAINER' ? 'bg-purple-50' : 'bg-blue-50'
              }`}>
                {project.type === 'RETAINER'
                  ? <RefreshCw className="w-5 h-5 text-purple-600" />
                  : <Briefcase className="w-5 h-5 text-blue-600" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{project.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{project.client.name}</p>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  project.type === 'RETAINER' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {project.type === 'ONE_OFF' ? 'One-off' : 'Retainer'}
                </span>
                {project.budget && (
                  <p className="text-xs text-gray-500 mt-1">{fmt(project.budget)}</p>
                )}
              </div>
              {project.startDate && (
                <div className="text-right text-xs text-gray-400 shrink-0 hidden md:block">
                  <p>{format(new Date(project.startDate), 'dd MMM yyyy')}</p>
                  {project.endDate && <p>→ {format(new Date(project.endDate), 'dd MMM yyyy')}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
