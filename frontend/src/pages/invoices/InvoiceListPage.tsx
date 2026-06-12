import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { useInvoices } from '../../hooks/useInvoices';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { clsx } from 'clsx';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const STATUS_PILLS = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_APPROVAL', label: 'Pending' },
  { value: 'READY_TO_SEND', label: 'Ready' },
  { value: 'SENT', label: 'Sent' },
  { value: 'PART_PAID', label: 'Part Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'PAID', label: 'Paid' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const InvoiceListPage = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useInvoices({ status: status || undefined, page });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Invoices</h1>
          <p className="text-gray-500 text-sm mt-0.5">{data?.total ?? 0} total</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/invoices/new')}>
          <Plus className="w-4 h-4" /> New Invoice
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Search invoices…" readOnly />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_PILLS.map(pill => (
            <button key={pill.value}
              onClick={() => { setStatus(pill.value); setPage(1); }}
              className={clsx(
                'px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border',
                status === pill.value
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}>
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? <PageLoader /> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Issue Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Due Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data?.invoices?.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <p className="text-3xl mb-2">📄</p>
                    <p className="text-sm font-medium text-gray-500">No invoices found</p>
                    <p className="text-xs text-gray-400 mt-1">Try a different filter or create a new invoice</p>
                  </td>
                </tr>
              )}
              {data?.invoices?.map((inv: { id: string; invoiceNumber: string; client?: { name: string }; issueDate: string; dueDate: string; total: number; status: string }) => {
                const overdue = inv.status !== 'PAID' && inv.status !== 'CANCELLED' && isPast(new Date(inv.dueDate));
                return (
                  <tr key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)}
                    className={clsx(
                      'cursor-pointer transition-colors hover:bg-gray-50/60',
                      overdue && 'bg-red-50/40 hover:bg-red-50/70'
                    )}>
                    <td className="px-5 py-3.5 font-mono font-semibold text-blue-600 text-xs tracking-wide">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3.5 font-medium text-gray-900">{inv.client?.name ?? '—'}</td>
                    <td className="px-4 py-3.5 text-gray-500">{format(new Date(inv.issueDate), 'dd MMM yyyy')}</td>
                    <td className={clsx('px-4 py-3.5', overdue ? 'text-red-600 font-semibold' : 'text-gray-500')}>
                      {format(new Date(inv.dueDate), 'dd MMM yyyy')}
                    </td>
                    <td className={clsx('px-4 py-3.5 text-right font-bold',
                      inv.status === 'PAID' ? 'text-green-600' :
                      overdue ? 'text-red-600' : 'text-gray-900'
                    )}>{fmt(inv.total)}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={inv.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {data && data.total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, data.total)} of {data.total}
          </p>
          <div className="flex gap-2">
            <button className="btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Previous</button>
            <button className="btn-secondary" disabled={page * 20 >= data.total} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      )}
    </div>
  );
};
