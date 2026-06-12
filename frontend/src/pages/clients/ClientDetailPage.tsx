import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Download, Building2, Mail, Phone, MapPin, FileText, TrendingDown, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageLoader } from '../../components/ui/LoadingSpinner';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

interface StatementLine {
  date: string;
  type: 'INVOICE' | 'PAYMENT';
  description: string;
  debit: number;
  credit: number;
  balance: number;
  invoiceNumber?: string;
  status?: string;
}

interface StatementData {
  client: {
    id: string; name: string; gstin?: string; stateCode: string;
    contactName: string; contactEmail: string; contactPhone?: string; address?: string;
    billingTerms: string;
  };
  lines: StatementLine[];
  closingBalance: number;
}

export const ClientDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const { data: client, isLoading: loadingClient } = useQuery({
    queryKey: ['client', id],
    queryFn: () => api.get(`/clients/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const { data: statement, isLoading: loadingStatement } = useQuery<StatementData>({
    queryKey: ['statement', id, from, to],
    queryFn: () => api.get(`/clients/${id}/statement`, { params: { from: from || undefined, to: to || undefined } }).then(r => r.data),
    enabled: !!id,
  });

  const downloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await api.get(`/clients/${id}/statement.pdf?${params}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `statement-${client?.name ?? id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to generate statement PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loadingClient) return <PageLoader />;
  if (!client) return <div className="text-center py-12 text-gray-400">Client not found</div>;

  const totalInvoiced = statement?.lines.filter(l => l.type === 'INVOICE').reduce((s, l) => s + l.debit, 0) ?? 0;
  const totalCollected = statement?.lines.filter(l => l.type === 'PAYMENT').reduce((s, l) => s + l.credit, 0) ?? 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/clients')} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex-1">
          <h1 className="text-[28px] font-semibold text-on-surface">{client.name}</h1>
          {client.gstin && <p className="text-sm text-gray-400 font-mono mt-0.5">{client.gstin}</p>}
        </div>
      </div>

      {/* Client Info */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Contact</p>
              <p className="font-medium text-gray-900">{client.contactName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Billing Terms</p>
              <p className="font-medium text-gray-900">{client.billingTerms.replace('_', ' ')}</p>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <Mail className="w-4 h-4 text-gray-400" />
              {client.contactEmail}
            </div>
            {client.contactPhone && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <Phone className="w-4 h-4 text-gray-400" />
                {client.contactPhone}
              </div>
            )}
            {client.address && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600 col-span-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                {client.address}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Statement */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-gray-900">Account Statement</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">From</label>
              <input type="date" className="input text-sm py-1.5" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">To</label>
              <input type="date" className="input text-sm py-1.5" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <button className="btn-secondary text-sm" onClick={downloadPdf} disabled={downloadingPdf}>
              <Download className="w-4 h-4" />
              {downloadingPdf ? 'Generating…' : 'Download PDF'}
            </button>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <p className="text-xs text-gray-500">Total Invoiced</p>
            </div>
            <p className="font-bold text-xl text-blue-600">{fmt(totalInvoiced)}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-green-500" />
              <p className="text-xs text-gray-500">Total Collected</p>
            </div>
            <p className="font-bold text-xl text-green-600">{fmt(totalCollected)}</p>
          </div>
          <div className={`rounded-xl p-4 ${(statement?.closingBalance ?? 0) > 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
            <p className="text-xs text-gray-500 mb-1">Closing Balance</p>
            <p className={`font-bold text-xl ${(statement?.closingBalance ?? 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {fmt(Math.abs(statement?.closingBalance ?? 0))}
              <span className="text-sm font-normal ml-1">{(statement?.closingBalance ?? 0) > 0 ? 'Due' : 'Advance'}</span>
            </p>
          </div>
        </div>

        {loadingStatement ? <PageLoader /> : (
          <div className="overflow-hidden rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Debit (₹)</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Credit (₹)</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Balance (₹)</th>
                </tr>
              </thead>
              <tbody>
                {statement?.lines.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400">No transactions in this period</td></tr>
                )}
                {statement?.lines.map((line, idx) => (
                  <tr key={idx} className={`border-b border-gray-50 ${line.type === 'PAYMENT' ? 'bg-green-50/30' : ''}`}>
                    <td className="px-4 py-2.5 text-gray-500">{format(new Date(line.date), 'dd MMM yyyy')}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{line.description}</td>
                    <td className="px-4 py-2.5">
                      {line.status && <StatusBadge status={line.status} />}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{line.debit > 0 ? fmt(line.debit) : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-green-600 font-medium">{line.credit > 0 ? fmt(line.credit) : '—'}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${line.balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {fmt(Math.abs(line.balance))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
