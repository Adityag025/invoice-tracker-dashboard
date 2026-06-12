import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, AlertCircle, Clock, CheckCircle, IndianRupee, ArrowUpRight, ChevronRight, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { format, isPast } from 'date-fns';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const fmtCompact = (n: number) => {
  if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(1)}L`;
  if (n >= 1_00_000)  return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000)     return `₹${(n / 1_000).toFixed(0)}K`;
  return fmt(n);
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold text-gray-900">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

interface KPIProps {
  label: string; value: string; sub?: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
  valueColor?: string;
}
const KPICard = ({ label, value, sub, icon: Icon, iconBg, iconColor, valueColor = 'text-gray-900' }: KPIProps) => (
  <div className="card p-5">
    <div className="flex items-start justify-between mb-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <ArrowUpRight className="w-4 h-4 text-gray-300" />
    </div>
    <p className={`text-2xl font-bold tracking-tight ${valueColor}`}>{value}</p>
    <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
  </div>
);

export const DashboardPage = () => {
  const navigate = useNavigate();

  const { data: summary, isLoading } = useQuery({
    queryKey: ['reports', 'summary'],
    queryFn: () => api.get('/reports/summary').then(r => r.data),
  });

  const { data: revenue } = useQuery({
    queryKey: ['reports', 'revenue'],
    queryFn: () => api.get('/reports/revenue').then(r => r.data),
  });

  const { data: aging } = useQuery({
    queryKey: ['reports', 'ar-aging'],
    queryFn: () => api.get('/reports/ar-aging').then(r => r.data),
  });

  const { data: recentInvoices } = useQuery({
    queryKey: ['invoices', { limit: 6, sortBy: 'createdAt', order: 'desc' }],
    queryFn: () => api.get('/invoices', { params: { limit: 6, sortBy: 'createdAt', order: 'desc' } }).then(r => r.data),
  });

  if (isLoading) return <PageLoader />;

  const revenueData = revenue
    ? Object.keys(revenue.billed ?? {}).sort().slice(-6).map(month => ({
        month: format(new Date(month + '-01'), 'MMM'),
        Billed: revenue.billed[month] ?? 0,
        Collected: revenue.collected[month] ?? 0,
      }))
    : [];

  const agingData = aging
    ? Object.entries(aging).map(([bucket, invoices]) => ({
        bucket: bucket + 'd',
        amount: (invoices as { total: number }[]).reduce((s, inv) => s + (inv.total ?? 0), 0),
      }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard label="Total Outstanding" value={fmtCompact(summary?.totalOutstanding ?? 0)}
          sub={fmt(summary?.totalOutstanding ?? 0)} icon={IndianRupee}
          iconBg="bg-blue-50" iconColor="text-blue-600" />
        <KPICard label="Collected This Month" value={fmtCompact(summary?.totalCollected ?? 0)}
          icon={CheckCircle} iconBg="bg-green-50" iconColor="text-green-600" valueColor="text-green-700" />
        <KPICard label="Overdue Amount" value={fmtCompact(summary?.totalOverdue ?? 0)}
          sub={`${summary?.overdueCount ?? 0} invoices`} icon={AlertCircle}
          iconBg="bg-red-50" iconColor="text-red-500"
          valueColor={(summary?.totalOverdue ?? 0) > 0 ? 'text-red-600' : 'text-gray-900'} />
        <KPICard label="Pending Approval" value={String(summary?.pendingApproval ?? 0)}
          sub="invoices awaiting review" icon={Clock}
          iconBg="bg-amber-50" iconColor="text-amber-600"
          valueColor={(summary?.pendingApproval ?? 0) > 0 ? 'text-amber-600' : 'text-gray-900'} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="card p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-gray-900">Revenue Trend</h2>
              <p className="text-xs text-gray-400 mt-0.5">Billed vs collected · last 6 months</p>
            </div>
            <TrendingUp className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="gradBilled" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Billed" stroke="#3b82f6" strokeWidth={2} fill="url(#gradBilled)" dot={false} />
              <Area type="monotone" dataKey="Collected" stroke="#22c55e" strokeWidth={2} fill="url(#gradCollected)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-5 mt-3">
            <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-0.5 bg-blue-500 rounded-full inline-block" />Billed</span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-0.5 bg-green-500 rounded-full inline-block" />Collected</span>
          </div>
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-gray-900">AR Aging</h2>
              <p className="text-xs text-gray-400 mt-0.5">Outstanding by overdue bucket</p>
            </div>
            <AlertCircle className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={agingData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="amount" name="Outstanding" fill="#f97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Recent Invoices</h2>
          </div>
          <button onClick={() => navigate('/invoices')}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
            View all <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/60">
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Due Date</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!recentInvoices?.invoices?.length && (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400 text-sm">No invoices yet</td></tr>
            )}
            {recentInvoices?.invoices?.map((inv: { id: string; invoiceNumber: string; client?: { name: string }; dueDate: string; total: number; status: string }) => {
              const overdue = inv.status !== 'PAID' && inv.status !== 'CANCELLED' && isPast(new Date(inv.dueDate));
              return (
                <tr key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)}
                  className={`cursor-pointer transition-colors hover:bg-gray-50/60 ${overdue ? 'bg-red-50/40' : ''}`}>
                  <td className="px-5 py-3.5 font-mono font-semibold text-blue-600 text-xs">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3.5 text-gray-800 font-medium">{inv.client?.name ?? '—'}</td>
                  <td className={`px-4 py-3.5 text-sm ${overdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                    {format(new Date(inv.dueDate), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3.5 text-right font-bold text-gray-900">{fmt(inv.total)}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={inv.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
