import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, AlertCircle, Clock, CheckCircle, IndianRupee, ChevronRight, FileText, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { format, isPast } from 'date-fns';
import { useAuthStore } from '../../stores/authStore';
import { ROLE_LABEL } from '../../lib/roles';
import type { UserRole } from '../../types';

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
    <div className="bg-white border border-outline-variant rounded-xl shadow-card-md p-3 text-xs">
      <p className="font-semibold text-on-surface mb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-outline">{p.name}:</span>
          <span className="font-semibold text-on-surface">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

interface KPIProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  valueColor?: string;
  accentBorder?: string;
}

const KPICard = ({ label, value, sub, icon: Icon, iconBg, iconColor, valueColor = 'text-on-surface', accentBorder }: KPIProps) => (
  <div className={`bg-white rounded-xl border border-outline-variant shadow-card p-4 ${accentBorder ? `border-l-4 ${accentBorder}` : ''}`}>
    <div className="flex items-start justify-between mb-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
    </div>
    <p className={`text-[22px] font-bold tracking-tight tabular-nums leading-tight ${valueColor}`}>{value}</p>
    <p className="text-xs text-on-surface-variant font-medium mt-0.5 uppercase tracking-wider">{label}</p>
    {sub && <p className="text-xs text-outline mt-1">{sub}</p>}
  </div>
);

const SCOPE_LABEL: Partial<Record<UserRole, string>> = {
  CEO: 'All agency data',
  ACCOUNT_DIRECTOR: 'All agency data',
  POD_HEAD: 'Your POD',
  ACCOUNT_MANAGER: 'Your invoices',
  SUB_MANAGER: 'Your invoices',
};

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const scopeLabel = SCOPE_LABEL[user?.role as UserRole] ?? 'Your data';

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

  const currentMonth = new Date().toISOString().slice(0, 7);
  const { data: arMonthly } = useQuery({
    queryKey: ['reports', 'ar-monthly', currentMonth],
    queryFn: () => api.get('/reports/ar-monthly', { params: { month: currentMonth } }).then(r => r.data),
  });

  const { data: recentInvoices } = useQuery({
    queryKey: ['invoices', { limit: 6, sortBy: 'createdAt', order: 'desc' }],
    queryFn: () => api.get('/invoices', { params: { limit: 6, sortBy: 'createdAt', order: 'desc' } }).then(r => r.data),
  });

  if (isLoading) return <PageLoader />;

  const revenueData = revenue
    ? Object.keys(revenue.billed ?? {}).sort().slice(-12).map(month => ({
        month: format(new Date(month + '-01'), 'MMM'),
        Billed: revenue.billed[month] ?? 0,
        Collected: revenue.collected[month] ?? 0,
      }))
    : [];

  const totalBilledFYTD = revenueData.reduce((s, d) => s + d.Billed, 0);
  const totalCollectedFYTD = revenueData.reduce((s, d) => s + d.Collected, 0);

  // AR Aging segments
  const agingBuckets = {
    '0-30': (aging?.['0-30'] as { total: number; client?: { name: string } }[] | undefined) ?? [],
    '31-60': (aging?.['31-60'] as { total: number; client?: { name: string } }[] | undefined) ?? [],
    '61-90': (aging?.['61-90'] as { total: number; client?: { name: string } }[] | undefined) ?? [],
    '90+': (aging?.['90+'] as { total: number; client?: { name: string } }[] | undefined) ?? [],
  };

  const bucketTotals = {
    '0-30': agingBuckets['0-30'].reduce((s, i) => s + (i.total ?? 0), 0),
    '31-60': agingBuckets['31-60'].reduce((s, i) => s + (i.total ?? 0), 0),
    '61-90': agingBuckets['61-90'].reduce((s, i) => s + (i.total ?? 0), 0),
    '90+': agingBuckets['90+'].reduce((s, i) => s + (i.total ?? 0), 0),
  };
  const agingTotal = Object.values(bucketTotals).reduce((s, v) => s + v, 0);

  const pct = (v: number) => agingTotal > 0 ? `${Math.round((v / agingTotal) * 100)}%` : '0%';

  // Top overdue clients from 90+ and 61-90 buckets
  const overdueClients: { name: string; amount: number; days: string }[] = [];
  agingBuckets['90+'].forEach(inv => {
    if (inv.client?.name) {
      const ex = overdueClients.find(c => c.name === inv.client!.name);
      if (ex) ex.amount += inv.total;
      else overdueClients.push({ name: inv.client.name, amount: inv.total, days: '90+' });
    }
  });
  agingBuckets['61-90'].forEach(inv => {
    if (inv.client?.name) {
      const ex = overdueClients.find(c => c.name === inv.client!.name);
      if (ex) ex.amount += inv.total;
      else overdueClients.push({ name: inv.client.name, amount: inv.total, days: '61-90' });
    }
  });
  overdueClients.sort((a, b) => b.amount - a.amount);

  const monthlyRows: { totalRaised: number; totalReceived: number; pendingThisMonth: number; pendingPrevMonths: number; closingAR: number }[] =
    arMonthly?.rows ?? [];
  const kpi = monthlyRows.reduce(
    (acc, r) => ({
      totalRaised: acc.totalRaised + r.totalRaised,
      totalReceived: acc.totalReceived + r.totalReceived,
      pendingThisMonth: acc.pendingThisMonth + r.pendingThisMonth,
      pendingPrevMonths: acc.pendingPrevMonths + r.pendingPrevMonths,
      closingAR: acc.closingAR + r.closingAR,
    }),
    { totalRaised: 0, totalReceived: 0, pendingThisMonth: 0, pendingPrevMonths: 0, closingAR: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold text-primary tracking-tight">Dashboard</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-on-surface-variant uppercase tracking-wider">
              Viewing as {ROLE_LABEL[user?.role as UserRole] ?? user?.role}
            </p>
            <span className="h-1 w-1 rounded-full bg-outline-variant" />
            <p className="text-xs text-outline">{scopeLabel}</p>
            <span className="h-1 w-1 rounded-full bg-outline-variant" />
            <button className="flex items-center gap-1 text-secondary text-sm font-medium">
              {format(new Date(), 'MMMM yyyy')}
            </button>
          </div>
        </div>

        {/* Approval callout */}
        {(summary?.pendingApproval ?? 0) > 0 && (
          <div className="bg-surface-container-high border border-secondary-container/30 rounded-xl px-4 py-3 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-secondary-container/20 flex items-center justify-center text-secondary shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Awaiting Approval</p>
              <p className="text-sm text-on-surface-variant">
                {summary.pendingApproval} pending invoice{summary.pendingApproval !== 1 ? 's' : ''} need your sign-off.
              </p>
            </div>
            <button onClick={() => navigate('/approvals')} className="ml-auto btn-primary text-xs py-1.5 px-3">
              Review
            </button>
          </div>
        )}
      </div>

      {/* 5 KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <KPICard
          label="Raised this month"
          value={fmtCompact(kpi.totalRaised)}
          icon={IndianRupee}
          iconBg="bg-surface-container-low"
          iconColor="text-secondary"
          sub={fmt(kpi.totalRaised)}
        />
        <KPICard
          label="Received this month"
          value={fmtCompact(kpi.totalReceived)}
          icon={CheckCircle}
          iconBg="bg-green-50"
          iconColor="text-green-600"
          valueColor="text-green-700"
        />
        <KPICard
          label="Pending this month"
          value={fmtCompact(kpi.pendingThisMonth)}
          icon={Clock}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          valueColor="text-amber-700"
          accentBorder="border-l-amber-500"
          sub="Action required"
        />
        <KPICard
          label="Pending prev months"
          value={fmtCompact(kpi.pendingPrevMonths)}
          icon={AlertCircle}
          iconBg="bg-error-container"
          iconColor="text-error"
          valueColor="text-error"
          accentBorder="border-l-error"
          sub={`${summary?.overdueCount ?? 0} overdue`}
        />
        <KPICard
          label="Closing AR"
          value={fmtCompact(kpi.closingAR)}
          icon={IndianRupee}
          iconBg="bg-surface-container-low"
          iconColor="text-secondary"
          sub="Total outstanding"
        />
      </div>

      {/* Middle: AR Aging + Top Overdue Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* AR Aging — horizontal segmented bar */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-[18px] font-semibold text-primary">AR Aging</h2>
              <p className="text-xs text-outline mt-0.5">Outstanding receivables by overdue bucket</p>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-3">
              {[
                { label: '0–30d', color: 'bg-slate-300' },
                { label: '31–60d', color: 'bg-amber-200' },
                { label: '61–90d', color: 'bg-amber-400' },
                { label: '90+d', color: 'bg-error/70' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
                  <span className="text-xs text-on-surface-variant">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Segmented bar */}
          {agingTotal > 0 ? (
            <>
              <div className="flex h-12 w-full rounded-lg overflow-hidden mb-3">
                {bucketTotals['0-30'] > 0 && (
                  <div
                    className="h-full bg-slate-300 hover:opacity-80 transition-opacity"
                    style={{ width: pct(bucketTotals['0-30']) }}
                    title={`0-30 days: ${fmt(bucketTotals['0-30'])}`}
                  />
                )}
                {bucketTotals['31-60'] > 0 && (
                  <div
                    className="h-full bg-amber-200 hover:opacity-80 transition-opacity"
                    style={{ width: pct(bucketTotals['31-60']) }}
                    title={`31-60 days: ${fmt(bucketTotals['31-60'])}`}
                  />
                )}
                {bucketTotals['61-90'] > 0 && (
                  <div
                    className="h-full bg-amber-400 hover:opacity-80 transition-opacity"
                    style={{ width: pct(bucketTotals['61-90']) }}
                    title={`61-90 days: ${fmt(bucketTotals['61-90'])}`}
                  />
                )}
                {bucketTotals['90+'] > 0 && (
                  <div
                    className="h-full bg-error/70 hover:opacity-80 transition-opacity"
                    style={{ width: pct(bucketTotals['90+']) }}
                    title={`90+ days: ${fmt(bucketTotals['90+'])}`}
                  />
                )}
              </div>
              <div className="flex justify-between text-xs text-on-surface-variant mb-5">
                <span>Total Aging Base: <span className="font-semibold text-primary">{fmt(agingTotal)}</span></span>
                <span className="text-outline">Updated just now</span>
              </div>
            </>
          ) : (
            <div className="h-12 w-full rounded-lg bg-surface-container mb-3 flex items-center justify-center">
              <span className="text-xs text-outline">No outstanding AR</span>
            </div>
          )}

          {/* Bucket breakdown */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: '0–30 days', val: bucketTotals['0-30'], color: 'text-on-surface' },
              { label: '31–60 days', val: bucketTotals['31-60'], color: 'text-amber-700' },
              { label: '61–90 days', val: bucketTotals['61-90'], color: 'text-amber-600' },
              { label: '90+ days', val: bucketTotals['90+'], color: 'text-error' },
            ].map(b => (
              <div key={b.label} className="text-center p-3 bg-surface border border-outline-variant rounded-lg">
                <p className="text-xs text-on-surface-variant mb-1">{b.label}</p>
                <p className={`text-sm font-bold tabular-nums ${b.color}`}>{fmtCompact(b.val)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Top Overdue Clients */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[18px] font-semibold text-primary">Top Overdue Clients</h2>
            <button
              onClick={() => navigate('/invoices?status=OVERDUE')}
              className="text-xs text-secondary hover:underline font-medium"
            >
              View All
            </button>
          </div>

          {overdueClients.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-outline">No overdue clients</p>
            </div>
          ) : (
            <div className="space-y-1">
              {overdueClients.slice(0, 5).map(c => (
                <div
                  key={c.name}
                  className="flex items-center justify-between p-3 hover:bg-surface transition-colors rounded-lg border border-transparent hover:border-outline-variant cursor-pointer"
                  onClick={() => navigate('/invoices?status=OVERDUE')}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {c.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-on-surface leading-tight">{c.name}</p>
                      <p className="text-xs text-outline">{c.days} days overdue</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-error tabular-nums">{fmtCompact(c.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Revenue Trend — full width */}
      <div className="card p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-5 gap-3">
          <div>
            <h2 className="text-[18px] font-semibold text-primary">Revenue Trend</h2>
            <p className="text-xs text-outline mt-0.5">12-month trailing billed vs collected revenue</p>
          </div>
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5 text-xs text-outline">
              <span className="w-6 h-0.5 bg-secondary rounded-full inline-block" />Billed
            </span>
            <span className="flex items-center gap-1.5 text-xs text-outline">
              <span className="w-6 h-0.5 bg-green-500 rounded-full inline-block" />Collected
            </span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={revenueData}>
            <defs>
              <linearGradient id="gradBilled" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0b61a1" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#0b61a1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e1eafa" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#74777f' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#74777f' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="Billed" stroke="#0b61a1" strokeWidth={2} fill="url(#gradBilled)" dot={false} />
            <Area type="monotone" dataKey="Collected" stroke="#22c55e" strokeWidth={2} fill="url(#gradCollected)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>

        {/* FYTD totals */}
        <div className="mt-4 pt-4 border-t border-outline-variant/30 flex justify-end gap-8">
          <div className="text-right">
            <p className="text-xs text-on-surface-variant uppercase tracking-wider">Total Billed (FYTD)</p>
            <p className="font-bold text-primary tabular-nums">{fmt(totalBilledFYTD)}</p>
          </div>
          <div className="text-right pl-8 border-l border-outline-variant/30">
            <p className="text-xs text-on-surface-variant uppercase tracking-wider">Total Collected (FYTD)</p>
            <p className="font-bold text-green-700 tabular-nums">{fmt(totalCollectedFYTD)}</p>
          </div>
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-outline" />
            <h2 className="text-[18px] font-semibold text-on-surface">Recent Invoices</h2>
          </div>
          <button
            onClick={() => navigate('/invoices')}
            className="flex items-center gap-1 text-xs font-medium text-secondary hover:text-[#0952a5] transition-colors"
          >
            View all <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant">
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Invoice</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Client</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Due Date</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Amount</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/30">
            {!recentInvoices?.invoices?.length && (
              <tr>
                <td colSpan={5} className="text-center py-10 text-outline text-sm">No invoices yet</td>
              </tr>
            )}
            {recentInvoices?.invoices?.map((inv: { id: string; invoiceNumber: string; client?: { name: string }; dueDate: string; total: number; status: string }) => {
              const overdue = inv.status !== 'PAID' && inv.status !== 'CANCELLED' && isPast(new Date(inv.dueDate));
              return (
                <tr
                  key={inv.id}
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                  className={`cursor-pointer transition-colors hover:bg-surface-container-low/60 ${overdue ? 'bg-error-container/10' : ''}`}
                >
                  <td className="px-5 py-3.5 font-mono font-semibold text-secondary text-xs">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3.5 text-on-surface font-medium">{inv.client?.name ?? '—'}</td>
                  <td className={`px-4 py-3.5 text-sm ${overdue ? 'text-error font-semibold' : 'text-outline'}`}>
                    {format(new Date(inv.dueDate), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3.5 text-right font-bold text-on-surface tabular-nums">{fmt(inv.total)}</td>
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
