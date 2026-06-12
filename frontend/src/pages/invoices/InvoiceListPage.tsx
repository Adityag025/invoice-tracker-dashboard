import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { useInvoices } from '../../hooks/useInvoices';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageLoader } from '../../components/ui/LoadingSpinner';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'READY_TO_SEND', 'SENT', 'VIEWED', 'PART_PAID', 'PAID', 'OVERDUE', 'CANCELLED'];

export const InvoiceListPage = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useInvoices({ status: status || undefined, page });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 text-sm mt-0.5">{data?.total ?? 0} total invoices</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/invoices/new')}>
          <Plus className="w-4 h-4" />
          New Invoice
        </button>
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Search invoices…" readOnly />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select className="input w-auto" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? <PageLoader /> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Invoice #</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Issue Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Due Date</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.invoices?.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No invoices found</td></tr>
              )}
              {data?.invoices?.map((inv: { id: string; invoiceNumber: string; client?: { name: string }; issueDate: string; dueDate: string; total: number; status: string }) => (
                <tr
                  key={inv.id}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                >
                  <td className="px-4 py-3 font-mono font-medium text-blue-600">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3 text-gray-900">{inv.client?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{format(new Date(inv.issueDate), 'dd MMM yyyy')}</td>
                  <td className="px-4 py-3 text-gray-500">{format(new Date(inv.dueDate), 'dd MMM yyyy')}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(inv.total)}</td>
                  <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.total > 20 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {page} of {Math.ceil(data.total / 20)}</span>
          <div className="flex gap-2">
            <button className="btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            <button className="btn-secondary" disabled={page * 20 >= data.total} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
};
