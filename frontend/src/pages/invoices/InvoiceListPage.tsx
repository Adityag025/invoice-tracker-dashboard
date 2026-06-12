import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Download, Bell, CheckSquare, Square } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { useInvoices } from '../../hooks/useInvoices';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { clsx } from 'clsx';
import api from '../../lib/api';
import toast from 'react-hot-toast';

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

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  client?: { name: string };
  issueDate: string;
  dueDate: string;
  total: number;
  status: string;
};

export const InvoiceListPage = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendingReminder, setSendingReminder] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useInvoices({ status: status || undefined, page, search: search || undefined });
  const invoices: InvoiceRow[] = data?.invoices ?? [];

  const allSelected = invoices.length > 0 && invoices.every(inv => selectedIds.has(inv.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invoices.map(inv => inv.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const exportCSV = () => {
    const rows = invoices.filter(inv => selectedIds.has(inv.id));
    const header = 'Invoice #,Client,Issue Date,Due Date,Amount,Status';
    const lines = rows.map(inv =>
      [inv.invoiceNumber, inv.client?.name ?? '', format(new Date(inv.issueDate), 'dd/MM/yyyy'), format(new Date(inv.dueDate), 'dd/MM/yyyy'), inv.total, inv.status].join(',')
    );
    const blob = new Blob([header + '\n' + lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'invoices.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const sendBulkReminder = async () => {
    setSendingReminder(true);
    try {
      const { data: result } = await api.post('/invoices/bulk-remind', { ids: Array.from(selectedIds) });
      toast.success(`Reminder queued for ${result.sent} invoice(s). ${result.skipped} skipped.`);
      setSelectedIds(new Set());
    } catch {
      toast.error('Failed to send reminders');
    } finally {
      setSendingReminder(false);
    }
  };

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
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search invoices…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_PILLS.map(pill => (
            <button key={pill.value}
              onClick={() => { setStatus(pill.value); setPage(1); setSelectedIds(new Set()); }}
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

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
          <span className="text-sm font-medium text-blue-700">{selectedIds.size} selected</span>
          <div className="flex gap-2 ml-auto">
            <button className="btn-secondary text-xs py-1.5 px-3" onClick={exportCSV}>
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button className="btn-secondary text-xs py-1.5 px-3" onClick={sendBulkReminder} disabled={sendingReminder}>
              <Bell className="w-3.5 h-3.5" /> Send Reminder
            </button>
            <button className="text-xs text-gray-500 hover:text-gray-700 px-2" onClick={() => setSelectedIds(new Set())}>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Desktop table */}
      <div className="card overflow-hidden hidden md:block">
        {isLoading ? <PageLoader /> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="px-4 py-3 w-10">
                  <button onClick={toggleAll} className="text-gray-400 hover:text-gray-700">
                    {allSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Issue Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Due Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <p className="text-3xl mb-2">📄</p>
                    <p className="text-sm font-medium text-gray-500">No invoices found</p>
                    <p className="text-xs text-gray-400 mt-1">Try a different filter or create a new invoice</p>
                  </td>
                </tr>
              )}
              {invoices.map(inv => {
                const overdue = inv.status !== 'PAID' && inv.status !== 'CANCELLED' && isPast(new Date(inv.dueDate));
                const selected = selectedIds.has(inv.id);
                return (
                  <tr key={inv.id}
                    className={clsx(
                      'transition-colors hover:bg-gray-50/60',
                      overdue && 'bg-red-50/40 hover:bg-red-50/70',
                      selected && 'bg-blue-50/50'
                    )}>
                    <td className="px-4 py-3.5" onClick={e => { e.stopPropagation(); toggleOne(inv.id); }}>
                      {selected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-gray-300" />}
                    </td>
                    <td className="px-3 py-3.5 font-mono font-semibold text-blue-600 text-xs tracking-wide cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>{inv.invoiceNumber}</td>
                    <td className="px-4 py-3.5 font-medium text-gray-900 cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>{inv.client?.name ?? '—'}</td>
                    <td className="px-4 py-3.5 text-gray-500 cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>{format(new Date(inv.issueDate), 'dd MMM yyyy')}</td>
                    <td className={clsx('px-4 py-3.5 cursor-pointer', overdue ? 'text-red-600 font-semibold' : 'text-gray-500')} onClick={() => navigate(`/invoices/${inv.id}`)}>
                      {format(new Date(inv.dueDate), 'dd MMM yyyy')}
                    </td>
                    <td className={clsx('px-4 py-3.5 text-right font-bold cursor-pointer',
                      inv.status === 'PAID' ? 'text-green-600' :
                      overdue ? 'text-red-600' : 'text-gray-900'
                    )} onClick={() => navigate(`/invoices/${inv.id}`)}>{fmt(inv.total)}</td>
                    <td className="px-5 py-3.5 cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}><StatusBadge status={inv.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {isLoading ? <PageLoader /> : invoices.length === 0 ? (
          <div className="text-center py-16 card">
            <p className="text-3xl mb-2">📄</p>
            <p className="text-sm font-medium text-gray-500">No invoices found</p>
          </div>
        ) : invoices.map(inv => {
          const overdue = inv.status !== 'PAID' && inv.status !== 'CANCELLED' && isPast(new Date(inv.dueDate));
          return (
            <div key={inv.id}
              onClick={() => navigate(`/invoices/${inv.id}`)}
              className={clsx(
                'card p-4 cursor-pointer',
                overdue && 'border-red-200 bg-red-50/30'
              )}>
              <div className="flex items-start justify-between mb-2">
                <span className="font-mono font-semibold text-blue-600 text-xs">{inv.invoiceNumber}</span>
                <StatusBadge status={inv.status} />
              </div>
              <p className="font-medium text-gray-900 text-sm mb-1">{inv.client?.name ?? '—'}</p>
              <div className="flex items-center justify-between">
                <span className={clsx('text-xs', overdue ? 'text-red-600 font-semibold' : 'text-gray-400')}>
                  Due {format(new Date(inv.dueDate), 'dd MMM yyyy')}
                </span>
                <span className={clsx('font-bold text-sm', inv.status === 'PAID' ? 'text-green-600' : overdue ? 'text-red-600' : 'text-gray-900')}>
                  {fmt(inv.total)}
                </span>
              </div>
            </div>
          );
        })}
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
