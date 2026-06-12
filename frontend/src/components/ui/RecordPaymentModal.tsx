import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';

const schema = z.object({
  amount: z.coerce.number().positive('Amount must be positive'),
  tdsAmount: z.coerce.number().min(0).optional().default(0),
  tdsCertNumber: z.string().optional(),
  paymentDate: z.string().min(1, 'Date is required'),
  method: z.enum(['NEFT', 'RTGS', 'UPI', 'CHEQUE', 'CASH']),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  invoiceTotal: number;
  paidSoFar: number;
  onConfirm: (data: FormData) => Promise<void>;
  onClose: () => void;
  isSubmitting: boolean;
}

export const RecordPaymentModal = ({ invoiceTotal, paidSoFar, onConfirm, onClose, isSubmitting }: Props) => {
  const remaining = invoiceTotal - paidSoFar;
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: remaining,
      paymentDate: new Date().toISOString().split('T')[0],
      method: 'NEFT',
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Record Payment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex gap-6 text-sm">
          <div>
            <span className="text-gray-500">Invoice total</span>
            <p className="font-semibold text-gray-900">{fmt(invoiceTotal)}</p>
          </div>
          {paidSoFar > 0 && (
            <div>
              <span className="text-gray-500">Paid so far</span>
              <p className="font-semibold text-green-600">{fmt(paidSoFar)}</p>
            </div>
          )}
          <div>
            <span className="text-gray-500">Balance due</span>
            <p className="font-bold text-blue-600">{fmt(remaining)}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onConfirm)} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                {...register('amount')}
                className="input"
              />
              {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
              <input type="date" {...register('paymentDate')} className="input" />
              {errors.paymentDate && <p className="text-red-500 text-xs mt-1">{errors.paymentDate.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
            <select {...register('method')} className="input">
              {['NEFT', 'RTGS', 'UPI', 'CHEQUE', 'CASH'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reference / UTR Number</label>
            <input type="text" {...register('referenceNumber')} className="input" placeholder="Optional" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">TDS Deducted (₹)</label>
              <input type="number" step="0.01" {...register('tdsAmount')} className="input" placeholder="0" />
              <p className="text-xs text-gray-400 mt-0.5">If client deducted TDS</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">TDS Cert. No.</label>
              <input type="text" {...register('tdsCertNumber')} className="input" placeholder="Optional" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea {...register('notes')} className="input resize-none" rows={2} placeholder="Optional" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting ? 'Recording…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
