import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, isPast } from 'date-fns';
import {
  ArrowLeft, Download, Send, CheckCircle, XCircle, Paperclip,
  Trash2, ExternalLink, FileText, Image, File, CreditCard,
  Bell, BellOff, ReceiptText, Calendar, Building2, Hash,
  Clock, ChevronRight, ShieldCheck, ShieldX, Link2, Copy, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useInvoice, useUpdateInvoiceStatus } from '../../hooks/useInvoices';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { FileUpload } from '../../components/ui/FileUpload';
import { RecordPaymentModal } from '../../components/ui/RecordPaymentModal';
import { RaiseCreditNoteModal } from '../../components/ui/RaiseCreditNoteModal';
import { RejectModal } from '../../components/ui/RejectModal';
import { useAuthStore } from '../../stores/authStore';
import { hasMinRole } from '../../lib/roles';
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

const STATUS_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  DRAFT:            { bg: 'bg-gray-50',    border: 'border-gray-200',   dot: 'bg-gray-400' },
  PENDING_APPROVAL: { bg: 'bg-yellow-50',  border: 'border-yellow-200', dot: 'bg-yellow-500' },
  READY_TO_SEND:    { bg: 'bg-violet-50',  border: 'border-violet-200', dot: 'bg-violet-500' },
  SENT:             { bg: 'bg-blue-50',    border: 'border-blue-200',   dot: 'bg-blue-500' },
  VIEWED:           { bg: 'bg-indigo-50',  border: 'border-indigo-200', dot: 'bg-indigo-500' },
  PART_PAID:        { bg: 'bg-amber-50',   border: 'border-amber-200',  dot: 'bg-amber-500' },
  PAID:             { bg: 'bg-green-50',   border: 'border-green-200',  dot: 'bg-green-500' },
  OVERDUE:          { bg: 'bg-red-50',     border: 'border-red-200',    dot: 'bg-red-500' },
  CANCELLED:        { bg: 'bg-gray-50',    border: 'border-gray-200',   dot: 'bg-gray-400' },
};

const EVENT_LABELS: Record<string, string> = {
  CREATED: 'Invoice created',
  SENT: 'Sent to client',
  VIEWED: 'Viewed by client',
  PAYMENT_RECORDED: 'Payment recorded',
  STATUS_CHANGED: 'Status updated',
  CONVERTED_FROM_ESTIMATE: 'Converted from estimate',
  CREDIT_NOTE_RAISED: 'Credit note raised',
  FILE_ATTACHED: 'File attached',
  SUBMITTED_FOR_APPROVAL: 'Submitted for approval',
  APPROVED: 'Invoice approved',
  REJECTED: 'Returned to draft',
  PAYMENT_LINK_CREATED: 'Payment link generated',
};

export const InvoiceDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: invoice, isLoading } = useInvoice(id!);
  const updateStatus = useUpdateInvoiceStatus();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const { user } = useAuthStore();
  const isAdmin = hasMinRole(user?.role, 'ACCOUNT_DIRECTOR');

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
      api.post(`/invoices/${id}/payments`, { ...data, paymentDate: new Date(data.paymentDate).toISOString() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments', id] });
      qc.invalidateQueries({ queryKey: ['invoices', id] });
      setShowPaymentModal(false);
      toast.success('Payment recorded');
    },
    onError: (e: unknown) => {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to record payment');
    },
  });

  const raiseCreditNote = useMutation({
    mutationFn: (data: { type: 'FULL' | 'PARTIAL'; reason: string; amount: number }) =>
      api.post('/credit-notes', { invoiceId: id, ...data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices', id] });
      qc.invalidateQueries({ queryKey: ['credit-notes'] });
      setShowCreditNoteModal(false);
      toast.success('Credit note raised');
    },
    onError: (e: unknown) => {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to raise credit note');
    },
  });

  const submitForApproval = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/approval/submit`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices', id] }); toast.success('Submitted for approval'); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed'),
  });

  const approveInvoice = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/approval/approve`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices', id] }); toast.success('Invoice approved — ready to send'); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed'),
  });

  const rejectInvoice = useMutation({
    mutationFn: (reason: string) => api.post(`/invoices/${id}/approval/reject`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices', id] }); setShowRejectModal(false); toast.success('Invoice returned to draft'); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed'),
  });

  const generatePaymentLink = async () => {
    setGeneratingLink(true);
    try {
      await api.post(`/invoices/${id}/payment-link`);
      qc.invalidateQueries({ queryKey: ['invoices', id] });
      toast.success('Payment link generated and sent to client');
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to generate payment link');
    } finally { setGeneratingLink(false); }
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const deleteAttachment = useMutation({
    mutationFn: (attachmentId: string) => api.delete(`/invoices/${id}/attachments/${attachmentId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attachments', id] }); toast.success('File deleted'); },
    onError: () => toast.error('Delete failed'),
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await api.post(`/invoices/${id}/attachments`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      qc.invalidateQueries({ queryKey: ['attachments', id] });
      qc.invalidateQueries({ queryKey: ['invoices', id] });
      toast.success('File uploaded');
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Upload failed');
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
    } catch { toast.error('PDF generation failed'); }
    finally { setDownloadingPdf(false); }
  };

  const sendReminder = async () => {
    setSendingReminder(true);
    try {
      await api.post(`/invoices/${id}/reminders/send`);
      qc.invalidateQueries({ queryKey: ['reminders', id] });
      toast.success('Reminder sent');
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to send reminder');
    } finally { setSendingReminder(false); }
  };

  const transition = async (status: string) => {
    try {
      await updateStatus.mutateAsync({ id: id!, status });
      toast.success(`Invoice ${status.toLowerCase().replace(/_/g, ' ')}`);
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed');
    }
  };

  if (isLoading) return <PageLoader />;
  if (!invoice) return <div className="text-center py-12 text-gray-400">Invoice not found</div>;

  const paidSoFar = payments.reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, invoice.total - paidSoFar);
  const paidPct = Math.min(100, invoice.total > 0 ? Math.round((paidSoFar / invoice.total) * 100) : 0);
  const isOverdue = invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && isPast(new Date(invoice.dueDate));
  const statusColors = STATUS_COLORS[invoice.status] ?? STATUS_COLORS['DRAFT'];

  const canRecord = ['SENT', 'VIEWED', 'PART_PAID', 'OVERDUE'].includes(invoice.status);
  const canRemind = canRecord;
  const canMarkPaid = ['SENT', 'VIEWED', 'PART_PAID'].includes(invoice.status);
  const canCancel = !['PAID', 'CANCELLED'].includes(invoice.status);
  const canCreditNote = invoice.status !== 'CANCELLED';
  const canSubmitApproval = invoice.status === 'DRAFT';
  const canApproveReject = invoice.status === 'PENDING_APPROVAL' && isAdmin;
  const canSend = invoice.status === 'READY_TO_SEND';
  const canPaymentLink = !['PAID', 'CANCELLED', 'DRAFT'].includes(invoice.status) && balance > 0;

  return (
    <div className="max-w-6xl">
      {/* ── Top nav bar ── */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/invoices')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Invoices
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
        <span className="text-sm font-medium text-gray-900">{invoice.invoiceNumber}</span>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-6 items-start">
        {/* ════════════════════ LEFT COLUMN ════════════════════ */}
        <div className="space-y-5">

          {/* ── Invoice header card ── */}
          <div className={`rounded-2xl border p-6 ${statusColors.bg} ${statusColors.border}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{invoice.invoiceNumber}</h1>
                  <StatusBadge status={invoice.status} />
                  {isOverdue && invoice.status !== 'OVERDUE' && (
                    <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">Overdue</span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                    {invoice.client?.name}
                  </span>
                  {invoice.poNumber && (
                    <span className="flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-gray-400" />
                      PO: <span className="font-mono font-medium">{invoice.poNumber}</span>
                    </span>
                  )}
                  {invoice.project && (
                    <span className="text-gray-400">{invoice.project.name}</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-0.5">Invoice Total</p>
                <p className="text-3xl font-bold text-gray-900">{fmt(invoice.total)}</p>
              </div>
            </div>

            <div className="flex items-center gap-6 mt-5 pt-5 border-t border-black/5">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">Issued</span>
                <span className="font-medium text-gray-900">{format(new Date(invoice.issueDate), 'dd MMM yyyy')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">Due</span>
                <span className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                  {format(new Date(invoice.dueDate), 'dd MMM yyyy')}
                </span>
              </div>
            </div>
          </div>

          {/* ── Line items ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Line Items</h2>
              <span className="text-xs text-gray-400">{invoice.items?.length ?? 0} item{invoice.items?.length !== 1 ? 's' : ''}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">HSN/SAC</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rate</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tax</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoice.items?.map((item: { id: string; description: string; hsnSac?: string; quantity: number; unitRate: number; taxRate: number; taxType: string; lineTotal: number }) => (
                  <tr key={item.id} className="hover:bg-gray-50/40 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-900">{item.description}</td>
                    <td className="px-3 py-3.5 text-gray-400 font-mono text-xs">{item.hsnSac ?? '—'}</td>
                    <td className="px-3 py-3.5 text-right text-gray-600">{item.quantity}</td>
                    <td className="px-3 py-3.5 text-right text-gray-600">{fmt(item.unitRate)}</td>
                    <td className="px-3 py-3.5 text-right">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium">
                        {item.taxRate}% {item.taxType === 'IGST' ? 'IGST' : 'GST'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-gray-900">{fmt(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-100">
                  <td colSpan={5} className="px-5 py-2 text-right text-sm text-gray-500">Subtotal</td>
                  <td className="px-5 py-2 text-right text-sm font-medium text-gray-700">{fmt(invoice.subtotal)}</td>
                </tr>
                <tr>
                  <td colSpan={5} className="px-5 py-2 text-right text-sm text-gray-500">Tax</td>
                  <td className="px-5 py-2 text-right text-sm font-medium text-gray-700">{fmt(invoice.taxTotal)}</td>
                </tr>
                <tr className="border-t-2 border-gray-100 bg-gray-50/60">
                  <td colSpan={5} className="px-5 py-3.5 text-right font-bold text-gray-900">Total</td>
                  <td className="px-5 py-3.5 text-right font-bold text-blue-600 text-base">{fmt(invoice.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── Payments ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <h2 className="font-semibold text-gray-900">Payments</h2>
                {payments.length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                    {payments.length}
                  </span>
                )}
              </div>
              {canRecord && (
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  + Record Payment
                </button>
              )}
            </div>

            {payments.length > 0 ? (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/60">
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Method</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reference</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Recorded By</th>
                      <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {payments.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50/40 transition-colors">
                        <td className="px-5 py-3 text-gray-700">{format(new Date(p.paymentDate), 'dd MMM yyyy')}</td>
                        <td className="px-3 py-3">
                          <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">{p.method}</span>
                        </td>
                        <td className="px-3 py-3 text-gray-500 font-mono text-xs">{p.referenceNumber ?? '—'}</td>
                        <td className="px-3 py-3 text-gray-500">{p.recordedBy?.name ?? '—'}</td>
                        <td className="px-5 py-3 text-right font-semibold text-green-600">{fmt(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-100 bg-gray-50/60">
                    <tr>
                      <td colSpan={4} className="px-5 py-2.5 text-right text-sm font-medium text-gray-700">Total Paid</td>
                      <td className="px-5 py-2.5 text-right font-bold text-green-600">{fmt(paidSoFar)}</td>
                    </tr>
                    {balance > 0 && (
                      <tr>
                        <td colSpan={4} className="px-5 py-2 text-right text-sm font-medium text-gray-700">Balance Due</td>
                        <td className="px-5 py-2 text-right font-bold text-orange-500">{fmt(balance)}</td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </>
            ) : (
              <div className="px-5 py-8 text-center">
                <CreditCard className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No payments recorded</p>
                {canRecord && (
                  <button onClick={() => setShowPaymentModal(true)} className="mt-3 text-sm font-medium text-blue-600 hover:underline">
                    Record first payment →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Attachments ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900">Attachments</h2>
              {attachments.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center">
                  {attachments.length}
                </span>
              )}
            </div>
            <div className="p-5 space-y-3">
              {attachments.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                  <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
                    <AttachmentIcon mime={a.mimeType} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.originalName}</p>
                    <p className="text-xs text-gray-400">
                      {fmtSize(a.size)}{a.uploadedBy ? ` · ${a.uploadedBy.name}` : ''} · {format(new Date(a.createdAt), 'dd MMM yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a href={a.url} target="_blank" rel="noopener noreferrer"
                      className="w-7 h-7 rounded-lg hover:bg-blue-50 flex items-center justify-center text-gray-400 hover:text-blue-600 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button type="button" onClick={() => deleteAttachment.mutate(a.id)} disabled={deleteAttachment.isPending}
                      className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <FileUpload onUpload={handleUpload} isUploading={uploading} label="Attach a document, PO, or supporting file" />
            </div>
          </div>
        </div>

        {/* ════════════════════ RIGHT SIDEBAR ════════════════════ */}
        <div className="space-y-4 sticky top-6">

          {/* ── Financial summary card ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Payment Summary</h3>

            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>{fmt(paidSoFar)} paid</span>
                <span>{paidPct}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${paidPct === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${paidPct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>of {fmt(invoice.total)}</span>
                {balance > 0 && <span className="text-orange-500 font-medium">{fmt(balance)} due</span>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-0.5">Collected</p>
                <p className="font-bold text-green-600 text-sm">{fmt(paidSoFar)}</p>
              </div>
              <div className={`rounded-xl p-3 ${balance > 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
                <p className="text-xs text-gray-500 mb-0.5">Balance</p>
                <p className={`font-bold text-sm ${balance > 0 ? 'text-orange-500' : 'text-green-600'}`}>{fmt(balance)}</p>
              </div>
            </div>
          </div>

          {/* ── Actions card ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Actions</h3>
            <div className="space-y-2">

              {/* Primary CTA — context-sensitive */}
              {canSubmitApproval && (
                <button onClick={() => submitForApproval.mutate()} disabled={submitForApproval.isPending}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                  <ShieldCheck className="w-4 h-4" />
                  {submitForApproval.isPending ? 'Submitting…' : 'Submit for Approval'}
                </button>
              )}
              {canSend && (
                <button onClick={() => transition('SENT')}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors">
                  <Send className="w-4 h-4" /> Send Invoice
                </button>
              )}
              {canRecord && (
                <button onClick={() => setShowPaymentModal(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
                  <CreditCard className="w-4 h-4" /> Record Payment
                </button>
              )}

              {/* Admin approval actions */}
              {canApproveReject && (
                <div className="flex gap-2">
                  <button onClick={() => approveInvoice.mutate()} disabled={approveInvoice.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                    <ShieldCheck className="w-4 h-4" />
                    {approveInvoice.isPending ? '…' : 'Approve'}
                  </button>
                  <button onClick={() => setShowRejectModal(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors">
                    <ShieldX className="w-4 h-4" /> Reject
                  </button>
                </div>
              )}

              {/* Payment link */}
              {canPaymentLink && (
                <button onClick={generatePaymentLink} disabled={generatingLink || !!invoice.razorpayLinkUrl}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-indigo-200 hover:bg-indigo-50 text-indigo-700 text-sm font-medium transition-colors disabled:opacity-50">
                  <Link2 className="w-4 h-4" />
                  {generatingLink ? 'Generating…' : invoice.razorpayLinkUrl ? 'Link Generated' : 'Generate Payment Link'}
                </button>
              )}

              {canMarkPaid && (
                <button onClick={() => transition('PAID')}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-green-200 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-medium transition-colors">
                  <CheckCircle className="w-4 h-4" /> Mark as Paid
                </button>
              )}
              {canRemind && (
                <button onClick={sendReminder} disabled={sendingReminder}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors disabled:opacity-50">
                  {sendingReminder ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                  {sendingReminder ? 'Sending…' : 'Send Reminder'}
                </button>
              )}
              <button onClick={downloadPdf} disabled={downloadingPdf}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors disabled:opacity-50">
                {downloadingPdf ? <LoadingSpinner size="sm" /> : <Download className="w-4 h-4" />}
                {downloadingPdf ? 'Generating PDF…' : 'Download PDF'}
              </button>

              {(canCreditNote || canCancel) && (
                <div className="border-t border-gray-100 pt-2 mt-1 space-y-2">
                  {canCreditNote && (
                    <button onClick={() => setShowCreditNoteModal(true)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-orange-200 hover:bg-orange-50 text-orange-600 text-sm font-medium transition-colors">
                      <ReceiptText className="w-4 h-4" /> Raise Credit Note
                    </button>
                  )}
                  {canCancel && (
                    <button onClick={() => transition('CANCELLED')}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 text-sm font-medium transition-colors">
                      <XCircle className="w-4 h-4" /> Cancel Invoice
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Payment link card ── */}
          {invoice.razorpayLinkUrl && (
            <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Link2 className="w-4 h-4 text-indigo-500" />
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Link</h3>
                <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
                  invoice.razorpayLinkStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {invoice.razorpayLinkStatus === 'paid' ? 'Paid' : 'Active'}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-indigo-50 rounded-xl px-3 py-2.5">
                <a href={invoice.razorpayLinkUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-1 text-xs text-indigo-700 font-mono truncate hover:underline">
                  {invoice.razorpayLinkUrl}
                </a>
                <button onClick={() => copyLink(invoice.razorpayLinkUrl!)}
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-indigo-100 text-indigo-500 transition-colors">
                  {linkCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}

          {/* ── Activity timeline ── */}
          {(invoice.events?.length > 0 || reminderLogs.length > 0) && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Activity</h3>
              <div className="space-y-0">
                {invoice.events?.map((event: { id: string; eventType: string; actor?: { name: string }; createdAt: string }, idx: number) => (
                  <div key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {idx < (invoice.events?.length - 1) && (
                      <div className="absolute left-[7px] top-4 bottom-0 w-px bg-gray-100" />
                    )}
                    <div className={`w-3.5 h-3.5 rounded-full shrink-0 mt-0.5 border-2 border-white ring-1 ${statusColors.dot} ring-gray-200`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 leading-tight">
                        {EVENT_LABELS[event.eventType] ?? event.eventType.replace(/_/g, ' ').toLowerCase()}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {event.actor?.name && <span>{event.actor.name} · </span>}
                        {format(new Date(event.createdAt), 'dd MMM, HH:mm')}
                      </p>
                    </div>
                  </div>
                ))}
                {reminderLogs.map(r => (
                  <div key={r.id} className="relative flex gap-3 pb-4 last:pb-0">
                    <div className={`w-3.5 h-3.5 rounded-full shrink-0 mt-0.5 border-2 border-white ring-1 ${r.status === 'SENT' ? 'bg-blue-400' : 'bg-red-400'} ring-gray-200`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 leading-tight capitalize">
                        Reminder: {r.reminderType.replace(/_/g, ' ').toLowerCase()}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {r.emailTo} · {format(new Date(r.sentAt), 'dd MMM, HH:mm')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showPaymentModal && (
        <RecordPaymentModal
          invoiceTotal={invoice.total}
          paidSoFar={paidSoFar}
          isSubmitting={recordPayment.isPending}
          onClose={() => setShowPaymentModal(false)}
          onConfirm={async (data) => { await recordPayment.mutateAsync(data); }}
        />
      )}
      {showCreditNoteModal && (
        <RaiseCreditNoteModal
          invoiceTotal={invoice.total}
          invoiceNumber={invoice.invoiceNumber}
          isSubmitting={raiseCreditNote.isPending}
          onClose={() => setShowCreditNoteModal(false)}
          onConfirm={async (data) => { await raiseCreditNote.mutateAsync(data); }}
        />
      )}
      {showRejectModal && (
        <RejectModal
          invoiceNumber={invoice.invoiceNumber}
          isSubmitting={rejectInvoice.isPending}
          onClose={() => setShowRejectModal(false)}
          onConfirm={async (reason) => { await rejectInvoice.mutateAsync(reason); }}
        />
      )}
    </div>
  );
};
