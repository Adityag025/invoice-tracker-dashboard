import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, CheckCircle, XCircle, RefreshCw, Upload, ExternalLink, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { FileUpload } from '../../components/ui/FileUpload';
import api from '../../lib/api';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

interface PurchaseOrder {
  id: string;
  poNumber: string;
  poDate: string;
  poValue: number;
  documentUrl?: string;
}

interface Estimate {
  id: string;
  estimateNumber: string;
  status: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  validUntil?: string;
  notes?: string;
  client?: { name: string; stateCode: string };
  project?: { name: string };
  items: { id: string; description: string; hsnSac?: string; quantity: number; unitRate: number; taxRate: number; taxType: string; lineTotal: number }[];
  purchaseOrders: PurchaseOrder[];
}

export const EstimateDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [uploadingPo, setUploadingPo] = useState(false);
  const [showPoForm, setShowPoForm] = useState(false);
  const [poFields, setPoFields] = useState({ poNumber: '', poDate: '', poValue: '' });

  const { data: estimate, isLoading } = useQuery<Estimate>({
    queryKey: ['estimate', id],
    queryFn: () => api.get(`/estimates/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/estimates/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estimate', id] });
      qc.invalidateQueries({ queryKey: ['estimates'] });
      toast.success('Status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const convertToInvoice = useMutation({
    mutationFn: () => api.post(`/estimates/${id}/convert`),
    onSuccess: (res) => {
      toast.success('Converted to invoice');
      navigate(`/invoices/${res.data.id}`);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Conversion failed';
      toast.error(msg);
    },
  });

  const handlePoUpload = async (file: File) => {
    if (!poFields.poNumber || !poFields.poDate || !poFields.poValue) {
      toast.error('Fill in PO number, date, and value before uploading');
      return;
    }
    setUploadingPo(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('poNumber', poFields.poNumber);
      form.append('poDate', new Date(poFields.poDate).toISOString());
      form.append('poValue', poFields.poValue);
      await api.post(`/estimates/${id}/purchase-order`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      qc.invalidateQueries({ queryKey: ['estimate', id] });
      setPoFields({ poNumber: '', poDate: '', poValue: '' });
      setShowPoForm(false);
      toast.success('Purchase order attached');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Upload failed';
      toast.error(msg);
    } finally {
      setUploadingPo(false);
    }
  };

  if (isLoading) return <PageLoader />;
  if (!estimate) return <div className="text-center py-12 text-gray-400">Estimate not found</div>;

  const canConvert = estimate.status === 'APPROVED';
  const canApprove = estimate.status === 'SENT';
  const canSend = estimate.status === 'DRAFT';

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/estimates')} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{estimate.estimateNumber}</h1>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={estimate.status} />
            <span className="text-gray-400 text-sm">•</span>
            <span className="text-gray-500 text-sm">{estimate.client?.name}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {canSend && (
            <button className="btn-primary" onClick={() => updateStatus.mutate('SENT')}>
              <Upload className="w-4 h-4" /> Send to Client
            </button>
          )}
          {canApprove && (
            <button className="btn-primary" onClick={() => updateStatus.mutate('APPROVED')}>
              <CheckCircle className="w-4 h-4" /> Mark Approved
            </button>
          )}
          {canConvert && (
            <button className="btn-primary" onClick={() => convertToInvoice.mutate()} disabled={convertToInvoice.isPending}>
              <RefreshCw className="w-4 h-4" />
              {convertToInvoice.isPending ? 'Converting…' : 'Convert to Invoice'}
            </button>
          )}
          {!['CONVERTED', 'EXPIRED'].includes(estimate.status) && (
            <button
              className="btn-secondary text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => updateStatus.mutate('EXPIRED')}
            >
              <XCircle className="w-4 h-4" /> Expire
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {estimate.validUntil && (
          <div className="card p-4">
            <p className="text-xs text-gray-500 mb-1">Valid Until</p>
            <p className="font-semibold">{format(new Date(estimate.validUntil), 'dd MMM yyyy')}</p>
          </div>
        )}
        {estimate.project && (
          <div className="card p-4">
            <p className="text-xs text-gray-500 mb-1">Project</p>
            <p className="font-semibold">{estimate.project.name}</p>
          </div>
        )}
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Total Amount</p>
          <p className="font-bold text-xl text-blue-600">{fmt(estimate.total)}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-medium text-gray-700">Line Items</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-2 text-gray-500 font-medium">Description</th>
              <th className="text-left px-4 py-2 text-gray-500 font-medium">HSN/SAC</th>
              <th className="text-right px-4 py-2 text-gray-500 font-medium">Qty</th>
              <th className="text-right px-4 py-2 text-gray-500 font-medium">Rate</th>
              <th className="text-right px-4 py-2 text-gray-500 font-medium">Tax</th>
              <th className="text-right px-4 py-2 text-gray-500 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {estimate.items.map(item => (
              <tr key={item.id} className="border-b border-gray-50">
                <td className="px-4 py-3">{item.description}</td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{item.hsnSac ?? '—'}</td>
                <td className="px-4 py-3 text-right">{item.quantity}</td>
                <td className="px-4 py-3 text-right">{fmt(item.unitRate)}</td>
                <td className="px-4 py-3 text-right text-gray-500">{item.taxRate}% {item.taxType === 'IGST' ? 'IGST' : 'CGST+SGST'}</td>
                <td className="px-4 py-3 text-right font-medium">{fmt(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr><td colSpan={5} className="px-4 py-2 text-right text-gray-500 text-sm">Subtotal</td><td className="px-4 py-2 text-right font-medium">{fmt(estimate.subtotal)}</td></tr>
            <tr><td colSpan={5} className="px-4 py-2 text-right text-gray-500 text-sm">Tax</td><td className="px-4 py-2 text-right font-medium">{fmt(estimate.taxTotal)}</td></tr>
            <tr className="border-t border-gray-200"><td colSpan={5} className="px-4 py-3 text-right font-bold">Total</td><td className="px-4 py-3 text-right font-bold text-blue-600 text-lg">{fmt(estimate.total)}</td></tr>
          </tfoot>
        </table>
      </div>

      {/* Purchase Orders */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-gray-900">Purchase Orders</h3>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{estimate.purchaseOrders.length}</span>
          </div>
          {!showPoForm && (
            <button className="btn-secondary text-sm" onClick={() => setShowPoForm(true)}>
              + Attach PO
            </button>
          )}
        </div>

        {estimate.purchaseOrders.length > 0 && (
          <div className="space-y-2 mb-4">
            {estimate.purchaseOrders.map(po => (
              <div key={po.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100">
                <FileText className="w-4 h-4 text-orange-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{po.poNumber}</p>
                  <p className="text-xs text-gray-400">
                    {format(new Date(po.poDate), 'dd MMM yyyy')} · {fmt(po.poValue)}
                  </p>
                </div>
                {po.documentUrl && (
                  <a
                    href={po.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700 transition-colors"
                    title="View document"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {showPoForm && (
          <div className="border border-blue-200 rounded-xl p-4 bg-blue-50 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">PO Number *</label>
                <input
                  className="input text-sm"
                  placeholder="PO-2024-001"
                  value={poFields.poNumber}
                  onChange={e => setPoFields(f => ({ ...f, poNumber: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">PO Date *</label>
                <input
                  type="date"
                  className="input text-sm"
                  value={poFields.poDate}
                  onChange={e => setPoFields(f => ({ ...f, poDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">PO Value (₹) *</label>
                <input
                  type="number"
                  className="input text-sm"
                  placeholder="0"
                  value={poFields.poValue}
                  onChange={e => setPoFields(f => ({ ...f, poValue: e.target.value }))}
                />
              </div>
            </div>
            <FileUpload
              onUpload={handlePoUpload}
              isUploading={uploadingPo}
              label="Upload PO document (PDF or image)"
              accept=".pdf,.png,.jpg,.jpeg"
            />
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary text-sm" onClick={() => { setShowPoForm(false); setPoFields({ poNumber: '', poDate: '', poValue: '' }); }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {!showPoForm && estimate.purchaseOrders.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No purchase orders attached yet.</p>
        )}
      </div>

      {estimate.notes && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-2">Notes</h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{estimate.notes}</p>
        </div>
      )}
    </div>
  );
};
