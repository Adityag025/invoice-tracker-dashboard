import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';

const schema = z.object({
  type: z.enum(['FULL', 'PARTIAL']),
  reason: z.string().min(3, 'Reason is required'),
  amount: z.coerce.number().positive('Must be positive'),
});
type FormData = z.infer<typeof schema>;

interface Props {
  invoiceTotal: number;
  invoiceNumber: string;
  onConfirm: (data: FormData) => Promise<void>;
  onClose: () => void;
  isSubmitting: boolean;
}

export const RaiseCreditNoteModal = ({ invoiceTotal, invoiceNumber, onConfirm, onClose, isSubmitting }: Props) => {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'FULL', amount: invoiceTotal, reason: '' },
  });

  const type = watch('type');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Raise Credit Note</h2>
            <p className="text-sm text-gray-400">Against {invoiceNumber}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onConfirm)} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Credit Note Type *</label>
            <div className="grid grid-cols-2 gap-3">
              {(['FULL', 'PARTIAL'] as const).map(t => (
                <label key={t} className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${type === t ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" value={t} {...register('type')} className="hidden" />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${type === t ? 'border-blue-500' : 'border-gray-300'}`}>
                    {type === t && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{t}</p>
                    <p className="text-xs text-gray-400">{t === 'FULL' ? fmt(invoiceTotal) : 'Custom amount'}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              max={invoiceTotal}
              {...register('amount')}
              disabled={type === 'FULL'}
              className="input disabled:bg-gray-50 disabled:text-gray-500"
            />
            {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
            <textarea
              {...register('reason')}
              className="input resize-none"
              rows={3}
              placeholder="e.g. Service not delivered, Billing error, Client request…"
            />
            {errors.reason && <p className="text-red-500 text-xs mt-1">{errors.reason.message}</p>}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 bg-red-600 hover:bg-red-700 border-red-600">
              {isSubmitting ? 'Raising…' : 'Raise Credit Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
