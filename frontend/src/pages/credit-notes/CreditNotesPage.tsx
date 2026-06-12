import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { FileX } from 'lucide-react';
import api from '../../lib/api';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { StatusBadge } from '../../components/ui/StatusBadge';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

interface CreditNote {
  id: string;
  cnNumber: string;
  type: string;
  reason: string;
  amount: number;
  status: string;
  createdAt: string;
  originalInvoice: { invoiceNumber: string; clientId: string };
  issuedBy: { name: string };
}

export const CreditNotesPage = () => {
  const { data: creditNotes = [], isLoading } = useQuery<CreditNote[]>({
    queryKey: ['credit-notes'],
    queryFn: () => api.get('/credit-notes').then(r => r.data),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Credit Notes</h1>
        <p className="text-gray-500 text-sm mt-0.5">{creditNotes.length} total credit notes</p>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? <PageLoader /> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">CN Number</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Against Invoice</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Reason</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Issued By</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {creditNotes.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-gray-400">
                    <FileX className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p>No credit notes yet</p>
                    <p className="text-xs mt-1">Raise a credit note from an invoice's detail page</p>
                  </td>
                </tr>
              )}
              {creditNotes.map(cn => (
                <tr key={cn.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-red-600">{cn.cnNumber}</td>
                  <td className="px-4 py-3 font-mono text-blue-600">{cn.originalInvoice?.invoiceNumber}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${cn.type === 'FULL' ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'}`}>
                      {cn.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{cn.reason}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(cn.amount)}</td>
                  <td className="px-4 py-3"><StatusBadge status={cn.status} /></td>
                  <td className="px-4 py-3 text-gray-500">{cn.issuedBy?.name}</td>
                  <td className="px-4 py-3 text-gray-500">{format(new Date(cn.createdAt), 'dd MMM yyyy')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
