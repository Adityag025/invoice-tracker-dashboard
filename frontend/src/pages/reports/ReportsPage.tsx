import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { format } from 'date-fns';
import api from '../../lib/api';
import { PageLoader } from '../../components/ui/LoadingSpinner';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export const ReportsPage = () => {
  const { data: aging, isLoading: loadingAging } = useQuery({
    queryKey: ['reports', 'ar-aging'],
    queryFn: () => api.get('/reports/ar-aging').then(r => r.data),
  });

  const { data: revenue, isLoading: loadingRevenue } = useQuery({
    queryKey: ['reports', 'revenue'],
    queryFn: () => api.get('/reports/revenue').then(r => r.data),
  });

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
        amount: (invoices as { total: number }[]).reduce((s, inv) => s + (inv.total ?? 0), 0),
        count: (invoices as unknown[]).length,
      }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 text-sm mt-0.5">Financial insights and AR aging</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">AR Aging Buckets</h2>
          {loadingAging ? <PageLoader /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={agingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Outstanding" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Revenue — Billed vs Collected</h2>
          {loadingRevenue ? <PageLoader /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="Billed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Collected" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 font-medium text-gray-700">AR Aging Detail</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Bucket</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Count</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {agingData.map(row => (
              <tr key={row.bucket} className="border-b border-gray-50">
                <td className="px-4 py-3 font-medium">{row.bucket} days</td>
                <td className="px-4 py-3 text-right">{row.count}</td>
                <td className="px-4 py-3 text-right font-semibold">{fmt(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
