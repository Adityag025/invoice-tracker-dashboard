import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, AlertCircle, Clock, CheckCircle, IndianRupee } from 'lucide-react';
import api from '../../lib/api';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { format } from 'date-fns';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const KPICard = ({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string;
}) => (
  <div className="card p-5 flex items-start gap-4">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

export const DashboardPage = () => {
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['reports', 'summary'],
    queryFn: () => api.get('/reports/summary').then(r => r.data),
  });

  const { data: revenue, isLoading: loadingRevenue } = useQuery({
    queryKey: ['reports', 'revenue'],
    queryFn: () => api.get('/reports/revenue').then(r => r.data),
  });

  const { data: aging } = useQuery({
    queryKey: ['reports', 'ar-aging'],
    queryFn: () => api.get('/reports/ar-aging').then(r => r.data),
  });

  if (loadingSummary) return <PageLoader />;

  const revenueData = revenue
    ? Object.keys(revenue.billed ?? {}).sort().map(month => ({
        month: format(new Date(month + '-01'), 'MMM yy'),
        Billed: revenue.billed[month] ?? 0,
        Collected: revenue.collected[month] ?? 0,
      }))
    : [];

  const agingData = aging
    ? Object.entries(aging).map(([bucket, invoices]) => ({
        bucket,
        count: (invoices as unknown[]).length,
        amount: (invoices as { total: number }[]).reduce((s, inv) => s + (inv.total ?? 0), 0),
      }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Overview of your invoicing activity</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard label="Total Outstanding" value={fmt(summary?.totalOutstanding ?? 0)} icon={IndianRupee} color="bg-blue-50 text-blue-600" />
        <KPICard label="Collected This Month" value={fmt(summary?.totalCollected ?? 0)} icon={CheckCircle} color="bg-green-50 text-green-600" />
        <KPICard label="Overdue Amount" value={fmt(summary?.totalOverdue ?? 0)} icon={AlertCircle} color="bg-red-50 text-red-600" />
        <KPICard label="Pending Approval" value={String(summary?.pendingApproval ?? 0)} sub="invoices" icon={Clock} color="bg-amber-50 text-amber-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900">Revenue Trend</h2>
          </div>
          {loadingRevenue ? <PageLoader /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Line type="monotone" dataKey="Billed" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Collected" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900">AR Aging</h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={agingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Amount" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
