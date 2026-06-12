import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, RefreshCw, ChevronRight, Briefcase, IndianRupee } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { StatusBadge } from '../../components/ui/StatusBadge';
import api from '../../lib/api';

interface Project {
  id: string;
  name: string;
  type: string;
  budget?: number;
  startDate?: string;
  endDate?: string;
  client: { id: string; name: string };
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    issueDate: string;
    dueDate: string;
    total: number;
  }>;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export const ProjectDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ['projects', id],
    queryFn: () => api.get(`/projects/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const generateRecurring = useMutation({
    mutationFn: () => api.post(`/invoices/from-project/${id}`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['projects', id] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Recurring invoice created as DRAFT');
      navigate(`/invoices/${res.data.id}`);
    },
    onError: (e: unknown) => {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed');
    },
  });

  if (isLoading) return <PageLoader />;
  if (!project) return <div className="text-center py-12 text-gray-400">Project not found</div>;

  const totalInvoiced = project.invoices.reduce((s, inv) => s + inv.total, 0);
  const isRetainer = project.type === 'RETAINER';

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Projects
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
        <span className="text-sm font-medium text-gray-900">{project.name}</span>
      </div>

      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isRetainer ? 'bg-purple-50' : 'bg-blue-50'}`}>
              {isRetainer
                ? <RefreshCw className="w-6 h-6 text-purple-600" />
                : <Briefcase className="w-6 h-6 text-blue-600" />
              }
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{project.client.name}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isRetainer ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                  {isRetainer ? 'Retainer' : 'One-off'}
                </span>
                {project.startDate && (
                  <span className="text-xs text-gray-400">
                    {format(new Date(project.startDate), 'dd MMM yyyy')}
                    {project.endDate && ` → ${format(new Date(project.endDate), 'dd MMM yyyy')}`}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            {project.budget && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Budget</p>
                <p className="text-xl font-bold text-gray-900">{fmt(project.budget)}</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-gray-100">
          <div className="bg-blue-50 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-blue-600" />
              <p className="text-xs text-gray-500">Total Invoiced</p>
            </div>
            <p className="font-bold text-blue-600 text-lg mt-1">{fmt(totalInvoiced)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-gray-400" />
              <p className="text-xs text-gray-500">Invoices</p>
            </div>
            <p className="font-bold text-gray-700 text-lg mt-1">{project.invoices.length}</p>
          </div>
        </div>

        {isRetainer && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={() => generateRecurring.mutate()}
              disabled={generateRecurring.isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              {generateRecurring.isPending ? 'Creating…' : 'Generate This Month\'s Invoice'}
            </button>
            <p className="text-xs text-gray-400 text-center mt-2">
              Clones the last invoice as a new DRAFT with today's dates
            </p>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Invoices</h2>
        </div>
        {project.invoices.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-10">No invoices yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/60">
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Issue Date</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Due Date</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {project.invoices.map(inv => (
                <tr
                  key={inv.id}
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                  className="cursor-pointer hover:bg-gray-50/60 transition-colors"
                >
                  <td className="px-5 py-3.5 font-mono font-semibold text-blue-600 text-xs">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3.5 text-gray-600">{format(new Date(inv.issueDate), 'dd MMM yyyy')}</td>
                  <td className="px-4 py-3.5 text-gray-600">{format(new Date(inv.dueDate), 'dd MMM yyyy')}</td>
                  <td className="px-4 py-3.5 text-right font-bold text-gray-900">{fmt(inv.total)}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
