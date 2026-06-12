import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Download, Send, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useInvoice, useUpdateInvoiceStatus } from '../../hooks/useInvoices';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageLoader } from '../../components/ui/LoadingSpinner';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export const InvoiceDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: invoice, isLoading } = useInvoice(id!);
  const updateStatus = useUpdateInvoiceStatus();

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
          {['SENT', 'VIEWED', 'PART_PAID'].includes(invoice.status) && (
            <button className="btn-primary" onClick={() => transition('PAID')}>
              <CheckCircle className="w-4 h-4" /> Mark Paid
            </button>
          )}
          {!['PAID', 'CANCELLED'].includes(invoice.status) && (
            <button className="btn-secondary text-red-600 border-red-200 hover:bg-red-50" onClick={() => transition('CANCELLED')}>
              <XCircle className="w-4 h-4" /> Cancel
            </button>
          )}
          <button className="btn-secondary">
            <Download className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
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
    </div>
  );
};
