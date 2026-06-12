import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageLoader } from '../../components/ui/LoadingSpinner';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export const EstimatesPage = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ['estimates', { status, search }],
    queryFn: () => api.get('/estimates', { params: { status: status || undefined, search: search || undefined } }).then(r => r.data),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold text-on-surface">Estimates</h1>
          <p className="text-outline text-sm mt-0.5">{data?.total ?? 0} total estimates</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/estimates/new')}>
          <Plus className="w-4 h-4" /> New Estimate
        </button>
      </div>

      <div className="card p-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search estimates…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['DRAFT', 'SENT', 'APPROVED', 'EXPIRED', 'CONVERTED'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? <PageLoader /> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estimate #</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Valid Until</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.estimates?.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">No estimates found</td></tr>
              )}
              {data?.estimates?.map((est: { id: string; estimateNumber: string; client?: { name: string }; validUntil?: string; total: number; status: string }) => (
                <tr
                  key={est.id}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/estimates/${est.id}`)}
                >
                  <td className="px-4 py-3 font-mono font-medium text-blue-600">{est.estimateNumber}</td>
                  <td className="px-4 py-3 text-gray-900">{est.client?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {est.validUntil ? format(new Date(est.validUntil), 'dd MMM yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(est.total)}</td>
                  <td className="px-4 py-3"><StatusBadge status={est.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
