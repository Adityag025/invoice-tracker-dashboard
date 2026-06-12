import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, AlertTriangle } from 'lucide-react';

const schema = z.object({ reason: z.string().min(3, 'Please provide a reason') });
type FormData = z.infer<typeof schema>;

interface Props {
  invoiceNumber: string;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
  isSubmitting: boolean;
}

export const RejectModal = ({ invoiceNumber, onConfirm, onClose, isSubmitting }: Props) => {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-gray-900">Reject Invoice</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit(d => onConfirm(d.reason))} className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-500">
            Rejecting <span className="font-mono font-semibold text-gray-900">{invoiceNumber}</span> will return it to Draft status. The creator will be notified.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for rejection *</label>
            <textarea
              {...register('reason')}
              rows={3}
              className="input resize-none"
              placeholder="e.g. Wrong tax rate on item 2, missing PO number…"
            />
            {errors.reason && <p className="text-red-500 text-xs mt-1">{errors.reason.message}</p>}
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
              {isSubmitting ? 'Rejecting…' : 'Reject Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
