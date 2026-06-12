import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { format } from 'date-fns';
import { Download } from 'lucide-react';
import api from '../../lib/api';
import { PageLoader } from '../../components/ui/LoadingSpinner';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

type Tab = 'revenue' | 'aging' | 'gst' | 'ar-monthly';

interface GstRow {
  month: string;
  invoiceCount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  grandTotal: number;
}

interface ArMonthlyRow {
  label: string;
  totalRaised: number;
  totalReceived: number;
  pendingThisMonth: number;
  pendingPrevMonths: number;
  closingAR: number;
}

const FY_OPTIONS = [
  { label: 'FY 2025-26', start: '2025-04-01', end: '2026-03-31' },
  { label: 'FY 2024-25', start: '2024-04-01', end: '2025-03-31' },
  { label: 'FY 2023-24', start: '2023-04-01', end: '2024-03-31' },
  { label: 'Custom', start: '', end: '' },
];

export const ReportsPage = () => {
  const [tab, setTab] = useState<Tab>('revenue');
  const [fyLabel, setFyLabel] = useState('Custom');
  const [gstFrom, setGstFrom] = useState('');
  const [gstTo, setGstTo] = useState('');
  const [arMonth, setArMonth] = useState(new Date().toISOString().slice(0, 7));
  const [arGroupBy, setArGroupBy] = useState<'client' | 'pod' | 'ad'>('client');

  const selectedFy = FY_OPTIONS.find(f => f.label === fyLabel) ?? FY_OPTIONS[FY_OPTIONS.length - 1];
  const revenueFyStart = selectedFy.start || undefined;

  const applyFy = (label: string) => {
    setFyLabel(label);
    const fy = FY_OPTIONS.find(f => f.label === label);
    if (fy && fy.start) {
      setGstFrom(fy.start);
      setGstTo(fy.end);
    }
  };

  const { data: aging, isLoading: loadingAging } = useQuery({
    queryKey: ['reports', 'ar-aging'],
    queryFn: () => api.get('/reports/ar-aging').then(r => r.data),
  });

  const { data: revenue, isLoading: loadingRevenue } = useQuery({
    queryKey: ['reports', 'revenue', revenueFyStart],
    queryFn: () => api.get('/reports/revenue', { params: { fyStart: revenueFyStart, months: revenueFyStart ? undefined : '6' } }).then(r => r.data),
  });

  const { data: gstRows = [], isLoading: loadingGst } = useQuery<GstRow[]>({
    queryKey: ['reports', 'gst', gstFrom, gstTo],
    queryFn: () => api.get('/reports/gst', { params: { from: gstFrom || undefined, to: gstTo || undefined } }).then(r => r.data),
    enabled: tab === 'gst',
  });

  const { data: arMonthlyData, isLoading: loadingArMonthly } = useQuery({
    queryKey: ['reports', 'ar-monthly', arMonth, arGroupBy],
    queryFn: () => api.get('/reports/ar-monthly', { params: { month: arMonth, groupBy: arGroupBy } }).then(r => r.data) as Promise<{ month: string; groupBy: string; rows: ArMonthlyRow[] }>,
    enabled: tab === 'ar-monthly',
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

  const downloadGstCsv = () => {
    const headers = ['Month', 'Invoices', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total Tax', 'Grand Total'];
    const rows = gstRows.map(r => [
      r.month, r.invoiceCount, r.taxable.toFixed(2), r.cgst.toFixed(2), r.sgst.toFixed(2),
      r.igst.toFixed(2), r.totalTax.toFixed(2), r.grandTotal.toFixed(2),
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `gst-report-${gstFrom || 'all'}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadArCsv = () => {
    const rows = arMonthlyData?.rows ?? [];
    const headers = ['Group', 'Total Raised', 'Total Received', 'Pending (This Month)', 'Pending (Prev Months)', 'Closing AR'];
    const lines = rows.map(r => [r.label, r.totalRaised, r.totalReceived, r.pendingThisMonth, r.pendingPrevMonths, r.closingAR].join(','));
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `ar-monthly-${arMonth}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'revenue', label: 'Revenue' },
    { key: 'aging', label: 'AR Aging' },
    { key: 'gst', label: 'GST Report' },
    { key: 'ar-monthly', label: 'Monthly AR' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[28px] font-semibold text-on-surface">Reports</h1>
          <p className="text-outline text-sm mt-0.5">Financial insights and compliance reports</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-outline font-medium">Financial Year</label>
          <select
            className="input text-sm py-1.5"
            value={fyLabel}
            onChange={e => applyFy(e.target.value)}
          >
            {FY_OPTIONS.map(f => (
              <option key={f.label} value={f.label}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-surface-container rounded-xl p-1 w-fit flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-on-surface shadow-sm' : 'text-outline hover:text-on-surface'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'revenue' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-5">
            <h2 className="text-[18px] font-semibold text-on-surface mb-4">Revenue — Billed vs Collected</h2>
            {loadingRevenue ? <PageLoader /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e1eafa" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#74777f' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#74777f' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="Billed" fill="#0b61a1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Collected" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Collection Efficiency</h2>
            {loadingRevenue ? <PageLoader /> : (
              <div className="space-y-3 mt-2">
                {revenueData.map(d => {
                  const pct = d.Billed > 0 ? Math.round((d.Collected / d.Billed) * 100) : 0;
                  return (
                    <div key={d.month}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{d.month}</span>
                        <span className="font-medium text-gray-900">{pct}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'aging' && (
        <>
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
        </>
      )}

      {tab === 'gst' && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">GST Summary — GSTR-1 Style</h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">From</label>
                <input type="month" className="input text-sm py-1.5" value={gstFrom} onChange={e => setGstFrom(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">To</label>
                <input type="month" className="input text-sm py-1.5" value={gstTo} onChange={e => setGstTo(e.target.value)} />
              </div>
              {gstRows.length > 0 && (
                <button className="btn-secondary text-sm" onClick={downloadGstCsv}>
                  <Download className="w-4 h-4" /> CSV
                </button>
              )}
            </div>
          </div>

          {loadingGst ? <PageLoader /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Month</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Invoices</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Taxable Value</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 bg-blue-50/50">CGST</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 bg-blue-50/50">SGST</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 bg-purple-50/50">IGST</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Total Tax</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Grand Total</th>
                  </tr>
                </thead>
                <tbody>
                  {gstRows.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-10 text-gray-400">No data for selected period</td></tr>
                  )}
                  {gstRows.map(row => (
                    <tr key={row.month} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{format(new Date(row.month + '-01'), 'MMM yyyy')}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{row.invoiceCount}</td>
                      <td className="px-4 py-3 text-right font-medium">{fmt(row.taxable)}</td>
                      <td className="px-4 py-3 text-right text-blue-700 bg-blue-50/30">{row.cgst > 0 ? fmt(row.cgst) : '—'}</td>
                      <td className="px-4 py-3 text-right text-blue-700 bg-blue-50/30">{row.sgst > 0 ? fmt(row.sgst) : '—'}</td>
                      <td className="px-4 py-3 text-right text-purple-700 bg-purple-50/30">{row.igst > 0 ? fmt(row.igst) : '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(row.totalTax)}</td>
                      <td className="px-4 py-3 text-right font-bold text-blue-600">{fmt(row.grandTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                {gstRows.length > 1 && (
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr className="font-bold">
                      <td className="px-4 py-3 text-gray-700">Total</td>
                      <td className="px-4 py-3 text-right">{gstRows.reduce((s, r) => s + r.invoiceCount, 0)}</td>
                      <td className="px-4 py-3 text-right">{fmt(gstRows.reduce((s, r) => s + r.taxable, 0))}</td>
                      <td className="px-4 py-3 text-right text-blue-700">{fmt(gstRows.reduce((s, r) => s + r.cgst, 0))}</td>
                      <td className="px-4 py-3 text-right text-blue-700">{fmt(gstRows.reduce((s, r) => s + r.sgst, 0))}</td>
                      <td className="px-4 py-3 text-right text-purple-700">{fmt(gstRows.reduce((s, r) => s + r.igst, 0))}</td>
                      <td className="px-4 py-3 text-right">{fmt(gstRows.reduce((s, r) => s + r.totalTax, 0))}</td>
                      <td className="px-4 py-3 text-right text-blue-600">{fmt(gstRows.reduce((s, r) => s + r.grandTotal, 0))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'ar-monthly' && (
        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <h2 className="font-semibold text-gray-900 flex-1">Monthly AR Report</h2>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Month</label>
                <input type="month" className="input text-sm py-1.5" value={arMonth} onChange={e => setArMonth(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Group by</label>
                <select className="input text-sm py-1.5 w-auto" value={arGroupBy} onChange={e => setArGroupBy(e.target.value as 'client' | 'pod' | 'ad')}>
                  <option value="client">Client</option>
                  <option value="pod">POD</option>
                  <option value="ad">Account Director</option>
                </select>
              </div>
              {(arMonthlyData?.rows?.length ?? 0) > 0 && (
                <button className="btn-secondary text-sm" onClick={downloadArCsv}>
                  <Download className="w-4 h-4" /> CSV
                </button>
              )}
            </div>

            {loadingArMonthly ? <PageLoader /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-3 font-medium text-gray-600">
                        {arGroupBy === 'client' ? 'Client' : arGroupBy === 'pod' ? 'POD' : 'Account Director'}
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Total Raised</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Total Received</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Pending (This Month)</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Pending (Prev Months)</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600 text-red-600">Closing AR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!arMonthlyData?.rows?.length) && (
                      <tr><td colSpan={6} className="text-center py-10 text-gray-400">No data for selected month</td></tr>
                    )}
                    {arMonthlyData?.rows?.map((row, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{row.label}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmt(row.totalRaised)}</td>
                        <td className="px-4 py-3 text-right text-green-700">{fmt(row.totalReceived)}</td>
                        <td className="px-4 py-3 text-right text-amber-700">{fmt(row.pendingThisMonth)}</td>
                        <td className="px-4 py-3 text-right text-orange-700">{fmt(row.pendingPrevMonths)}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">{fmt(row.closingAR)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {(arMonthlyData?.rows?.length ?? 0) > 1 && (
                    <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                      <tr>
                        <td className="px-4 py-3 text-gray-700">Total</td>
                        <td className="px-4 py-3 text-right">{fmt(arMonthlyData!.rows.reduce((s, r) => s + r.totalRaised, 0))}</td>
                        <td className="px-4 py-3 text-right text-green-700">{fmt(arMonthlyData!.rows.reduce((s, r) => s + r.totalReceived, 0))}</td>
                        <td className="px-4 py-3 text-right text-amber-700">{fmt(arMonthlyData!.rows.reduce((s, r) => s + r.pendingThisMonth, 0))}</td>
                        <td className="px-4 py-3 text-right text-orange-700">{fmt(arMonthlyData!.rows.reduce((s, r) => s + r.pendingPrevMonths, 0))}</td>
                        <td className="px-4 py-3 text-right text-red-600">{fmt(arMonthlyData!.rows.reduce((s, r) => s + r.closingAR, 0))}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
