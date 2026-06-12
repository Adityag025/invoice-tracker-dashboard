import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Download, Bell, CheckSquare, Square, ChevronDown, Calendar, TrendingUp, Lightbulb, MoreHorizontal, ChevronLeft, ChevronRight, ShieldCheck, X } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { useInvoices } from '../../hooks/useInvoices';
import { useQuery } from '@tanstack/react-query';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { clsx } from 'clsx';
import api from '../../lib/api';
import toast from 'react-hot-toast';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const fmtCompact = (n: number) => {
  if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(2)}L`;
  if (n >= 1_00_000)  return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000)     return `₹${(n / 1_000).toFixed(0)}K`;
  return fmt(n);
};

const STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'READY_TO_SEND', label: 'Ready to Send' },
  { value: 'SENT', label: 'Sent' },
  { value: 'PART_PAID', label: 'Part Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'PAID', label: 'Paid' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const DATE_RANGES = [
  { value: '30', label: 'Last 30 Days' },
  { value: '60', label: 'Last 60 Days' },
  { value: '90', label: 'Last 90 Days' },
  { value: 'all', label: 'All Time' },
];

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  client?: { name: string };
  project?: { name: string } | null;
  issueDate: string;
  dueDate: string;
  total: number;
  status: string;
};

const FilterDropdown = ({
  label,
  options,
  value,
  onChange,
  icon,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  icon?: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
          value
            ? 'bg-secondary/10 text-secondary border-secondary/30'
            : 'bg-white text-on-surface-variant border-outline-variant hover:border-outline hover:bg-surface-container-low'
        )}
      >
        {icon}
        <span>{selected?.label ?? label}</span>
        <ChevronDown className="w-3 h-3 ml-0.5 opacity-60" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-44 bg-white rounded-xl border border-outline-variant shadow-card-md z-20 overflow-hidden">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={clsx(
                'w-full text-left px-3.5 py-2 text-xs transition-colors',
                opt.value === value
                  ? 'bg-secondary/10 text-secondary font-semibold'
                  : 'text-on-surface hover:bg-surface-container-low'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ActionsMenu = ({ onView }: { onView: () => void }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-outline hover:bg-surface-container-low hover:text-on-surface transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 w-36 bg-white rounded-xl border border-outline-variant shadow-card-md z-20 overflow-hidden">
          <button
            onClick={e => { e.stopPropagation(); onView(); setOpen(false); }}
            className="w-full text-left px-3.5 py-2 text-xs text-on-surface hover:bg-surface-container-low transition-colors"
          >
            View Details
          </button>
        </div>
      )}
    </div>
  );
};

const PAGE_SIZE = 10;

export const InvoiceListPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState(() => searchParams.get('status') ?? '');
  const [dateRange, setDateRange] = useState('30');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') ?? '');
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendingReminder, setSendingReminder] = useState(false);

  useEffect(() => {
    const incoming = searchParams.get('search') ?? '';
    if (incoming) { setSearchInput(incoming); setSearch(incoming); }
    const incomingStatus = searchParams.get('status') ?? '';
    if (incomingStatus) setStatus(incomingStatus);
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useInvoices({ status: status || undefined, page, limit: PAGE_SIZE, search: search || undefined });
  const invoices: InvoiceRow[] = data?.invoices ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const { data: summary } = useQuery({
    queryKey: ['reports', 'summary'],
    queryFn: () => api.get('/reports/summary').then(r => r.data),
    staleTime: 60_000,
  });

  const allSelected = invoices.length > 0 && invoices.every(inv => selectedIds.has(inv.id));

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(invoices.map(inv => inv.id)));
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
    const header = 'Invoice #,Client,Project,Issue Date,Due Date,Amount,Status';
    const lines = rows.map(inv =>
      [inv.invoiceNumber, inv.client?.name ?? '', inv.project?.name ?? '', format(new Date(inv.issueDate), 'dd/MM/yyyy'), format(new Date(inv.dueDate), 'dd/MM/yyyy'), inv.total, inv.status].join(',')
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

  const hasFilters = status || search;

  const overdueAmount = summary?.totalOverdue ?? 0;
  const dueThisMonth = (summary?.totalOutstanding ?? 0) - overdueAmount;

  const pageNums = () => {
    const nums: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) nums.push(i);
    } else {
      nums.push(1);
      if (page > 3) nums.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) nums.push(i);
      if (page < totalPages - 2) nums.push('...');
      nums.push(totalPages);
    }
    return nums;
  };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-semibold text-on-surface tracking-tight">Invoice Tracker</h1>
          <p className="text-outline text-sm mt-0.5">Manage and track your agency's financial pipeline.</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/invoices/new')}>
          <Plus className="w-4 h-4" /> Create Invoice
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mr-1">Filters:</span>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline" />
          <input
            className="pl-8 pr-3 py-1.5 text-xs border border-outline-variant rounded-lg focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 bg-white text-on-surface placeholder:text-outline w-48"
            placeholder="Search by #ID or client…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>

        <FilterDropdown
          label="All Statuses"
          options={STATUSES}
          value={status}
          onChange={v => { setStatus(v); setPage(1); setSelectedIds(new Set()); }}
        />

        <FilterDropdown
          label="Date Range"
          options={DATE_RANGES}
          value={dateRange}
          onChange={setDateRange}
          icon={<Calendar className="w-3 h-3" />}
        />

        {hasFilters && (
          <button
            onClick={() => { setStatus(''); setSearch(''); setSearchInput(''); setPage(1); }}
            className="flex items-center gap-1 text-xs text-secondary hover:text-secondary/80 font-medium ml-1"
          >
            <X className="w-3 h-3" /> Clear all
          </button>
        )}

        <span className="ml-auto text-xs text-outline">{total} invoice{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-secondary/5 border border-secondary/20 rounded-xl px-4 py-2.5">
          <span className="text-sm font-medium text-secondary">{selectedIds.size} selected</span>
          <div className="flex gap-2 ml-auto">
            <button className="btn-secondary text-xs py-1.5 px-3" onClick={exportCSV}>
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button className="btn-secondary text-xs py-1.5 px-3" onClick={sendBulkReminder} disabled={sendingReminder}>
              <Bell className="w-3.5 h-3.5" /> {sendingReminder ? 'Sending…' : 'Send Reminder'}
            </button>
            <button className="text-xs text-outline hover:text-on-surface px-2" onClick={() => setSelectedIds(new Set())}>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Desktop table */}
      <div className="card overflow-hidden hidden md:block">
        {isLoading ? (
          <PageLoader />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-4 py-3 w-10">
                  <button onClick={toggleAll} className="text-outline hover:text-on-surface">
                    {allSelected
                      ? <CheckSquare className="w-4 h-4 text-secondary" />
                      : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Invoice #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden lg:table-cell">Project</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden xl:table-cell">Issue Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Due Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Amount (₹)</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 w-12 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16">
                    <div className="w-12 h-12 bg-surface-container-low rounded-xl flex items-center justify-center mx-auto mb-3">
                      <Search className="w-5 h-5 text-outline" />
                    </div>
                    <p className="text-sm font-medium text-on-surface">No invoices found</p>
                    <p className="text-xs text-outline mt-1">Try adjusting your filters or create a new invoice</p>
                  </td>
                </tr>
              ) : invoices.map(inv => {
                const overdue = inv.status !== 'PAID' && inv.status !== 'CANCELLED' && isPast(new Date(inv.dueDate));
                const selected = selectedIds.has(inv.id);
                return (
                  <tr
                    key={inv.id}
                    className={clsx(
                      'transition-colors cursor-pointer hover:bg-surface-container-low/50',
                      overdue && 'bg-error-container/10 hover:bg-error-container/20',
                      selected && 'bg-secondary/5'
                    )}
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                  >
                    <td className="px-4 py-3.5" onClick={e => { e.stopPropagation(); toggleOne(inv.id); }}>
                      {selected
                        ? <CheckSquare className="w-4 h-4 text-secondary" />
                        : <Square className="w-4 h-4 text-outline-variant" />}
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="font-mono font-bold text-secondary text-xs tracking-wide">{inv.invoiceNumber}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-medium text-on-surface">{inv.client?.name ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <span className="text-outline text-xs">{inv.project?.name ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3.5 text-outline text-xs hidden xl:table-cell">
                      {format(new Date(inv.issueDate), 'MMM dd, yyyy')}
                    </td>
                    <td className={clsx('px-4 py-3.5 text-xs font-medium', overdue ? 'text-error' : 'text-outline')}>
                      {format(new Date(inv.dueDate), 'MMM dd, yyyy')}
                    </td>
                    <td className={clsx('px-4 py-3.5 text-right font-bold tabular-nums text-sm',
                      inv.status === 'PAID' ? 'text-green-600' : overdue ? 'text-error' : 'text-on-surface'
                    )}>
                      {fmt(inv.total)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <ActionsMenu onView={() => navigate(`/invoices/${inv.id}`)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <PageLoader />
        ) : invoices.length === 0 ? (
          <div className="text-center py-16 card">
            <p className="text-sm font-medium text-outline">No invoices found</p>
          </div>
        ) : invoices.map(inv => {
          const overdue = inv.status !== 'PAID' && inv.status !== 'CANCELLED' && isPast(new Date(inv.dueDate));
          return (
            <div
              key={inv.id}
              onClick={() => navigate(`/invoices/${inv.id}`)}
              className={clsx('card p-4 cursor-pointer', overdue && 'border-error/30')}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="font-mono font-bold text-secondary text-xs">{inv.invoiceNumber}</span>
                <StatusBadge status={inv.status} />
              </div>
              <p className="font-medium text-on-surface text-sm mb-0.5">{inv.client?.name ?? '—'}</p>
              {inv.project?.name && <p className="text-xs text-outline mb-2">{inv.project.name}</p>}
              <div className="flex items-center justify-between">
                <span className={clsx('text-xs', overdue ? 'text-error font-semibold' : 'text-outline')}>
                  Due {format(new Date(inv.dueDate), 'dd MMM yyyy')}
                </span>
                <span className={clsx('font-bold text-sm tabular-nums', inv.status === 'PAID' ? 'text-green-600' : overdue ? 'text-error' : 'text-on-surface')}>
                  {fmt(inv.total)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-outline">
            Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-outline-variant text-outline hover:bg-surface-container-low disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {pageNums().map((n, i) => (
              n === '...'
                ? <span key={`ellipsis-${i}`} className="w-7 text-center text-xs text-outline">…</span>
                : <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={clsx(
                      'w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition-colors',
                      n === page
                        ? 'bg-secondary text-white'
                        : 'border border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
                    )}
                  >
                    {n}
                  </button>
            ))}
            <button
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-outline-variant text-outline hover:bg-surface-container-low disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom summary row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Unpaid Revenue Pipeline */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-secondary" />
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Unpaid Revenue Pipeline</p>
          </div>
          <p className="text-[28px] font-bold text-on-surface tracking-tight tabular-nums leading-none mb-3">
            {fmtCompact((summary?.totalOutstanding ?? 0))}
          </p>
          <div className="flex gap-4 mb-3">
            <div>
              <p className="text-xs text-outline mb-0.5">Overdue</p>
              <p className="text-sm font-semibold text-error tabular-nums">{fmt(overdueAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-outline mb-0.5">Due This Month</p>
              <p className="text-sm font-semibold text-amber-600 tabular-nums">{fmt(Math.max(0, dueThisMonth))}</p>
            </div>
          </div>
          {/* Mini bar */}
          {(summary?.totalOutstanding ?? 0) > 0 && (
            <div className="h-2 w-full rounded-full bg-surface-container-low overflow-hidden">
              <div
                className="h-full bg-error rounded-full"
                style={{ width: `${Math.min(100, Math.round((overdueAmount / (summary?.totalOutstanding ?? 1)) * 100))}%` }}
              />
            </div>
          )}
        </div>

        {/* Quick Insights */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Quick Insights</p>
          </div>
          {(summary?.pendingApproval ?? 0) > 0 ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-secondary/5 rounded-lg p-3">
                <ShieldCheck className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                <p className="text-sm text-on-surface-variant">
                  You have <span className="font-semibold text-secondary">{summary.pendingApproval} invoice{summary.pendingApproval !== 1 ? 's' : ''}</span> awaiting client approval. Follow up with the relevant team for the pending Q3 statement.
                </p>
              </div>
              <button
                onClick={() => navigate('/approvals')}
                className="text-xs font-semibold text-secondary hover:underline flex items-center gap-1"
              >
                View Approval Queue →
              </button>
            </div>
          ) : (summary?.overdueCount ?? 0) > 0 ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-error/5 rounded-lg p-3">
                <TrendingUp className="w-4 h-4 text-error shrink-0 mt-0.5" />
                <p className="text-sm text-on-surface-variant">
                  <span className="font-semibold text-error">{summary.overdueCount} invoice{summary.overdueCount !== 1 ? 's' : ''}</span> are overdue. Send reminders to accelerate collections.
                </p>
              </div>
              <button
                onClick={() => { setStatus('OVERDUE'); setPage(1); }}
                className="text-xs font-semibold text-error hover:underline flex items-center gap-1"
              >
                View Overdue Invoices →
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-3 bg-green-50 rounded-lg p-3">
              <ShieldCheck className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <p className="text-sm text-on-surface-variant">All invoices are up to date. No pending actions required.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
