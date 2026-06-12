import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Download, Send, CheckCircle, XCircle, Paperclip, Trash2, ExternalLink, FileText, Image, File, CreditCard, Bell, BellOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useInvoice, useUpdateInvoiceStatus } from '../../hooks/useInvoices';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { FileUpload } from '../../components/ui/FileUpload';
import { RecordPaymentModal } from '../../components/ui/RecordPaymentModal';
import api from '../../lib/api';

interface Payment {
  id: string;
  amount: number;
  paymentDate: string;
  method: string;
  referenceNumber?: string;
  notes?: string;
  recordedBy?: { name: string };
}

interface ReminderLog {
  id: string;
  reminderType: string;
  sentAt: string;
  emailTo: string;
  status: string;
}

interface Attachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  storageType: string;
  uploadedBy?: { name: string };
  createdAt: string;
}

function AttachmentIcon({ mime }: { mime: string }) {
  if (mime === 'application/pdf') return <FileText className="w-4 h-4 text-red-500" />;
  if (mime.startsWith('image/')) return <Image className="w-4 h-4 text-blue-500" />;
  return <File className="w-4 h-4 text-gray-500" />;
}

const fmtSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export const InvoiceDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: invoice, isLoading } = useInvoice(id!);
  const updateStatus = useUpdateInvoiceStatus();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);

  const { data: attachments = [] } = useQuery<Attachment[]>({
    queryKey: ['attachments', id],
    queryFn: () => api.get(`/invoices/${id}/attachments`).then(r => r.data),
    enabled: !!id,
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ['payments', id],
    queryFn: () => api.get(`/invoices/${id}/payments`).then(r => r.data),
    enabled: !!id,
  });

  const { data: reminderLogs = [] } = useQuery<ReminderLog[]>({
    queryKey: ['reminders', id],
    queryFn: () => api.get(`/invoices/${id}/reminders`).then(r => r.data),
    enabled: !!id,
  });

  const recordPayment = useMutation({
    mutationFn: (data: { amount: number; paymentDate: string; method: string; referenceNumber?: string; notes?: string }) =>
      api.post(`/invoices/${id}/payments`, {
        ...data,
        paymentDate: new Date(data.paymentDate).toISOString(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments', id] });
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      setShowPaymentModal(false);
      toast.success('Payment recorded');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to record payment';
      toast.error(msg);
    },
  });

  const paidSoFar = payments.reduce((s, p) => s + p.amount, 0);

  const sendReminder = async () => {
    setSendingReminder(true);
    try {
      await api.post(`/invoices/${id}/reminders/send`);
      qc.invalidateQueries({ queryKey: ['reminders', id] });
      toast.success('Reminder sent');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to send reminder';
      toast.error(msg);
    } finally {
      setSendingReminder(false);
    }
  };

  const deleteAttachment = useMutation({
    mutationFn: (attachmentId: string) => api.delete(`/invoices/${id}/attachments/${attachmentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attachments', id] });
      toast.success('File deleted');
    },
    onError: () => toast.error('Delete failed'),
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await api.post(`/invoices/${id}/attachments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      qc.invalidateQueries({ queryKey: ['attachments', id] });
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      toast.success('File uploaded');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Upload failed';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const downloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const res = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice?.invoiceNumber ?? id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('PDF generation failed');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const transition = async (status: string) => {
    try {
      await updateStatus.mutateAsync({ id: id!, status });
      toast.success(`Invoice marked as ${status.toLowerCase().replace(/_/g, ' ')}`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to update status';
      toast.error(msg);
    }
  };

  if (isLoading) return <PageLoader />;
  if (!invoice) return <div className="text-center py-12 text-gray-400">Invoice not found</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/invoices')} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{invoice.invoiceNumber}</h1>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={invoice.status} />
            <span className="text-gray-400 text-sm">•</span>
            <span className="text-gray-500 text-sm">{invoice.client?.name}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {invoice.status === 'DRAFT' && (
            <button className="btn-primary" onClick={() => transition('SENT')}>
              <Send className="w-4 h-4" /> Send Invoice
            </button>
          )}
          {['SENT', 'VIEWED', 'PART_PAID', 'OVERDUE'].includes(invoice.status) && (
            <button className="btn-primary" onClick={() => setShowPaymentModal(true)}>
              <CreditCard className="w-4 h-4" /> Record Payment
            </button>
          )}
          {['SENT', 'VIEWED', 'PART_PAID', 'OVERDUE'].includes(invoice.status) && (
            <button className="btn-secondary" onClick={sendReminder} disabled={sendingReminder}>
              {sendingReminder ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              {sendingReminder ? 'Sending…' : 'Send Reminder'}
            </button>
          )}
          {['SENT', 'VIEWED', 'PART_PAID'].includes(invoice.status) && (
            <button className="btn-secondary text-green-700 border-green-200 hover:bg-green-50" onClick={() => transition('PAID')}>
              <CheckCircle className="w-4 h-4" /> Mark Paid
            </button>
          )}
          {!['PAID', 'CANCELLED'].includes(invoice.status) && (
            <button className="btn-secondary text-red-600 border-red-200 hover:bg-red-50" onClick={() => transition('CANCELLED')}>
              <XCircle className="w-4 h-4" /> Cancel
            </button>
          )}
          <button className="btn-secondary" onClick={downloadPdf} disabled={downloadingPdf}>
            {downloadingPdf ? <LoadingSpinner size="sm" /> : <Download className="w-4 h-4" />}
            {downloadingPdf ? 'Generating…' : 'PDF'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Issue Date</p>
          <p className="font-semibold">{format(new Date(invoice.issueDate), 'dd MMM yyyy')}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Due Date</p>
          <p className="font-semibold">{format(new Date(invoice.dueDate), 'dd MMM yyyy')}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Total Amount</p>
          <p className="font-bold text-xl text-blue-600">{fmt(invoice.total)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Balance Due</p>
          <p className={`font-bold text-xl ${invoice.total - paidSoFar <= 0 ? 'text-green-600' : 'text-orange-600'}`}>
            {fmt(Math.max(0, invoice.total - paidSoFar))}
          </p>
        </div>
      </div>

      {invoice.poNumber && (
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">PO Number</p>
          <p className="font-medium font-mono">{invoice.poNumber}</p>
        </div>
      )}

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
            {invoice.items?.map((item: { id: string; description: string; hsnSac?: string; quantity: number; unitRate: number; taxRate: number; taxType: string; lineTotal: number }) => (
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
            <tr><td colSpan={5} className="px-4 py-2 text-right text-gray-500 text-sm">Subtotal</td><td className="px-4 py-2 text-right font-medium">{fmt(invoice.subtotal)}</td></tr>
            <tr><td colSpan={5} className="px-4 py-2 text-right text-gray-500 text-sm">Tax</td><td className="px-4 py-2 text-right font-medium">{fmt(invoice.taxTotal)}</td></tr>
            <tr className="border-t border-gray-200"><td colSpan={5} className="px-4 py-3 text-right font-bold">Total</td><td className="px-4 py-3 text-right font-bold text-blue-600 text-lg">{fmt(invoice.total)}</td></tr>
          </tfoot>
        </table>
      </div>

      {/* Payments */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-gray-900">Payments</h3>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{payments.length}</span>
          </div>
          {['SENT', 'VIEWED', 'PART_PAID', 'OVERDUE'].includes(invoice.status) && (
            <button className="btn-primary text-sm py-1.5 px-3" onClick={() => setShowPaymentModal(true)}>
              + Record Payment
            </button>
          )}
        </div>

        {payments.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Date</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Method</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Reference</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Recorded By</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 text-gray-700">{format(new Date(p.paymentDate), 'dd MMM yyyy')}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{p.method}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.referenceNumber ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{p.recordedBy?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">{fmt(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={4} className="px-4 py-2.5 text-right text-sm font-medium text-gray-700">Total Paid</td>
                  <td className="px-4 py-2.5 text-right font-bold text-green-600">{fmt(paidSoFar)}</td>
                </tr>
                {paidSoFar < invoice.total && (
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-right text-sm font-medium text-gray-700">Balance Due</td>
                    <td className="px-4 py-2 text-right font-bold text-orange-600">{fmt(invoice.total - paidSoFar)}</td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">No payments recorded yet.</p>
        )}
      </div>

      {/* Reminder Logs */}
      {reminderLogs.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-gray-900">Reminder History</h3>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{reminderLogs.length}</span>
          </div>
          <div className="space-y-2">
            {reminderLogs.map(r => (
              <div key={r.id} className="flex items-center gap-3 text-sm px-3 py-2 bg-gray-50 rounded-lg">
                <span className={`w-2 h-2 rounded-full shrink-0 ${r.status === 'SENT' ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="font-medium text-gray-700 capitalize">{r.reminderType.replace(/_/g, ' ').toLowerCase()}</span>
                <span className="text-gray-400">→ {r.emailTo}</span>
                <span className="text-gray-400 ml-auto">{format(new Date(r.sentAt), 'dd MMM yyyy, HH:mm')}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${r.status === 'SENT' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attachments */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Paperclip className="w-4 h-4 text-gray-500" />
          <h3 className="font-semibold text-gray-900">Attachments</h3>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{attachments.length}</span>
        </div>

        {attachments.length > 0 && (
          <div className="space-y-2 mb-4">
            {attachments.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100">
                <AttachmentIcon mime={a.mimeType} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{a.originalName}</p>
                  <p className="text-xs text-gray-400">
                    {fmtSize(a.size)}
                    {a.uploadedBy && <> · {a.uploadedBy.name}</>}
                    {' · '}{format(new Date(a.createdAt), 'dd MMM yyyy')}
                  </p>
                </div>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-700 transition-colors"
                  title="Open"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => deleteAttachment.mutate(a.id)}
                  disabled={deleteAttachment.isPending}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <FileUpload
          onUpload={handleUpload}
          isUploading={uploading}
          label="Attach invoice document, PO, or any supporting file"
        />
      </div>

      {invoice.events && invoice.events.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Activity Timeline</h3>
          <div className="space-y-3">
            {invoice.events.map((event: { id: string; eventType: string; actor?: { name: string }; createdAt: string }) => (
              <div key={event.id} className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <div>
                  <span className="font-medium text-gray-700">{event.eventType.replace(/_/g, ' ')}</span>
                  {event.actor && <span className="text-gray-400"> by {event.actor.name}</span>}
                  <span className="text-gray-400 ml-2">{format(new Date(event.createdAt), 'dd MMM yyyy, HH:mm')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showPaymentModal && (
        <RecordPaymentModal
          invoiceTotal={invoice.total}
          paidSoFar={paidSoFar}
          isSubmitting={recordPayment.isPending}
          onClose={() => setShowPaymentModal(false)}
          onConfirm={async (data) => { await recordPayment.mutateAsync(data); }}
        />
      )}
    </div>
  );
};
