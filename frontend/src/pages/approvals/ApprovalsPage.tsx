import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { RejectModal } from '../../components/ui/RejectModal';
import { useAuthStore } from '../../stores/authStore';
import { hasMinRole } from '../../lib/roles';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

interface Invoice {
  id: string;
  invoiceNumber: string;
  client?: { name: string };
  issueDate: string;
  dueDate: string;
  total: number;
  status: string;
  updatedAt: string;
  createdBy?: { name: string };
}

export const ApprovalsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [rejectInvoice, setRejectInvoice] = useState<Invoice | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);

  const canApprove = hasMinRole(user?.role, 'ACCOUNT_DIRECTOR');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', { status: 'PENDING_APPROVAL', limit: 100 }],
    queryFn: () => api.get('/invoices', { params: { status: 'PENDING_APPROVAL', limit: 100 } }).then(r => r.data),
    staleTime: 30_000,
  });

  const invoices: Invoice[] = data?.invoices ?? [];
  const totalValue = invoices.reduce((s, inv) => s + inv.total, 0);

  const approve = async (inv: Invoice) => {
    setApprovingId(inv.id);
    try {
      await api.patch(`/invoices/${inv.id}/status`, { status: 'READY_TO_SEND' });
      toast.success(`${inv.invoiceNumber} approved and ready to send`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'summary'] });
    } catch {
      toast.error('Failed to approve invoice');
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-semibold text-on-surface tracking-tight">Approvals</h1>
          <p className="text-outline text-sm mt-0.5">
            {invoices.length} invoice{invoices.length !== 1 ? 's' : ''} pending sign-off
          </p>
        </div>
        {invoices.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-outline uppercase tracking-wider">Total Value</p>
              <p className="font-bold text-on-surface tabular-nums">{fmt(totalValue)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Permission callout */}
      {!canApprove && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            Only <span className="font-semibold">Account Directors</span> and above can approve invoices. You can view pending invoices below.
          </p>
        </div>
      )}

      {canApprove && invoices.length > 0 && (
        <div className="bg-surface-container-high border border-secondary-container/30 rounded-xl px-4 py-3 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-secondary-container/20 flex items-center justify-center text-secondary shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Action Required</p>
            <p className="text-sm text-on-surface-variant">
              {invoices.length} invoice{invoices.length !== 1 ? 's' : ''} await your sign-off before they can be sent to clients.
            </p>
          </div>
        </div>
      )}

      {/* Approval table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <PageLoader />
        ) : invoices.length === 0 ? (
          <div className="text-center py-20">
            <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-semibold text-on-surface">All clear!</p>
            <p className="text-outline text-sm mt-1">No invoices are pending approval right now.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="text-left px-5 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                  Client
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden md:table-cell">
                  Submitted
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                  Amount
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden lg:table-cell">
                  Due Date
                </th>
                <th className="px-5 py-3 w-48"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="px-5 py-4">
                    <button
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                      className="font-mono font-semibold text-secondary text-xs hover:underline"
                    >
                      {inv.invoiceNumber}
                    </button>
                  </td>
                  <td className="px-4 py-4 font-medium text-on-surface">
                    {inv.client?.name ?? '—'}
                  </td>
                  <td className="px-4 py-4 text-outline hidden md:table-cell">
                    {format(new Date(inv.updatedAt), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-on-surface tabular-nums">
                    {fmt(inv.total)}
                  </td>
                  <td className="px-4 py-4 text-outline hidden lg:table-cell">
                    {format(new Date(inv.dueDate), 'dd MMM yyyy')}
                  </td>
                  <td className="px-5 py-4">
                    {canApprove ? (
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => approve(inv)}
                          disabled={approvingId === inv.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-700 text-xs font-semibold hover:bg-green-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          {approvingId === inv.id ? 'Approving…' : 'Approve'}
                        </button>
                        <button
                          onClick={() => setRejectInvoice(inv)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error/10 text-error text-xs font-semibold hover:bg-error/20 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <button
                          onClick={() => navigate(`/invoices/${inv.id}`)}
                          className="text-xs text-secondary hover:underline"
                        >
                          View →
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Reject Modal */}
      {rejectInvoice && (
        <RejectModal
          invoiceNumber={rejectInvoice.invoiceNumber}
          isSubmitting={rejecting}
          onConfirm={async (reason) => {
            setRejecting(true);
            try {
              await api.patch(`/invoices/${rejectInvoice.id}/status`, { status: 'DRAFT', reason });
              toast.success(`${rejectInvoice.invoiceNumber} rejected and returned to draft`);
              queryClient.invalidateQueries({ queryKey: ['invoices'] });
              queryClient.invalidateQueries({ queryKey: ['reports', 'summary'] });
              setRejectInvoice(null);
            } finally {
              setRejecting(false);
            }
          }}
          onClose={() => setRejectInvoice(null)}
        />
      )}
    </div>
  );
};
