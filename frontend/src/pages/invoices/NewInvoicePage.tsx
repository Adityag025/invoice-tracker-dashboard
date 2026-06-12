import { useFieldArray, useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCreateInvoice } from '../../hooks/useInvoices';
import { useClients } from '../../hooks/useClients';

const lineItemSchema = z.object({
  description: z.string().min(1, 'Required'),
  hsnSac: z.string().optional(),
  quantity: z.coerce.number().positive('Must be > 0'),
  unitRate: z.coerce.number().positive('Must be > 0'),
  taxRate: z.coerce.number().min(0).max(100),
});

const schema = z.object({
  clientId: z.string().min(1, 'Select a client'),
  projectId: z.string().optional(),
  issueDate: z.string().min(1, 'Required'),
  dueDate: z.string().min(1, 'Required'),
  poNumber: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(lineItemSchema).min(1, 'At least one line item required'),
});
type FormData = z.infer<typeof schema>;

const GST_RATES = [0, 5, 12, 18, 28];

export const NewInvoicePage = () => {
  const navigate = useNavigate();
  const { data: clientsData } = useClients();
  const createInvoice = useCreateInvoice();

  const { register, control, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      items: [{ description: '', quantity: 1, unitRate: 0, taxRate: 18 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items');

  const subtotal = items.reduce((s, i) => s + (i.quantity || 0) * (i.unitRate || 0), 0);
  const taxTotal = items.reduce((s, i) => s + (i.quantity || 0) * (i.unitRate || 0) * (i.taxRate || 0) / 100, 0);

  const onSubmit = async (data: FormData) => {
    try {
      const invoice = await createInvoice.mutateAsync({
        ...data,
        issueDate: new Date(data.issueDate).toISOString(),
        dueDate: new Date(data.dueDate).toISOString(),
      } as Parameters<typeof createInvoice.mutateAsync>[0]);
      toast.success('Invoice created');
      navigate(`/invoices/${invoice.id}`);
    } catch {
      toast.error('Failed to create invoice');
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/invoices')} className="btn-secondary"><ArrowLeft className="w-4 h-4" /> Back</button>
        <h1 className="text-[28px] font-semibold text-on-surface">New Invoice</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Client *</label>
            <select {...register('clientId')} className="input">
              <option value="">Select client…</option>
              {clientsData?.clients?.map((c: { id: string; name: string }) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.clientId && <p className="text-red-500 text-xs mt-1">{errors.clientId.message}</p>}
          </div>
          <div>
            <label className="label">Issue Date *</label>
            <input {...register('issueDate')} type="date" className="input" />
            {errors.issueDate && <p className="text-red-500 text-xs mt-1">{errors.issueDate.message}</p>}
          </div>
          <div>
            <label className="label">Due Date *</label>
            <input {...register('dueDate')} type="date" className="input" />
            {errors.dueDate && <p className="text-red-500 text-xs mt-1">{errors.dueDate.message}</p>}
          </div>
          <div>
            <label className="label">PO Number</label>
            <input {...register('poNumber')} className="input" placeholder="Client PO reference" />
          </div>
          <div>
            <label className="label">Notes</label>
            <input {...register('notes')} className="input" placeholder="Optional notes for client" />
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="font-medium text-gray-700">Line Items</span>
            <button type="button" className="btn-secondary text-xs" onClick={() => append({ description: '', quantity: 1, unitRate: 0, taxRate: 18 })}>
              <Plus className="w-3 h-3" /> Add Line
            </button>
          </div>
          <div className="p-4 space-y-3">
            {fields.map((field, idx) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-4">
                  {idx === 0 && <label className="label">Description</label>}
                  <input {...register(`items.${idx}.description`)} className="input text-xs" placeholder="Service description" />
                  {errors.items?.[idx]?.description && <p className="text-red-500 text-xs mt-0.5">{errors.items[idx].description?.message}</p>}
                </div>
                <div className="col-span-2">
                  {idx === 0 && <label className="label">HSN/SAC</label>}
                  <input {...register(`items.${idx}.hsnSac`)} className="input text-xs font-mono" placeholder="998313" />
                </div>
                <div className="col-span-1">
                  {idx === 0 && <label className="label">Qty</label>}
                  <input {...register(`items.${idx}.quantity`)} type="number" step="0.01" className="input text-xs text-right" />
                </div>
                <div className="col-span-2">
                  {idx === 0 && <label className="label">Rate (₹)</label>}
                  <input {...register(`items.${idx}.unitRate`)} type="number" step="0.01" className="input text-xs text-right" />
                </div>
                <div className="col-span-2">
                  {idx === 0 && <label className="label">GST %</label>}
                  <Controller
                    control={control}
                    name={`items.${idx}.taxRate`}
                    render={({ field }) => (
                      <select {...field} className="input text-xs">
                        {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    )}
                  />
                </div>
                <div className="col-span-1 flex items-end justify-end pb-0.5">
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(idx)} className="p-2 text-gray-400 hover:text-red-500 transition-colors mt-5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 px-5 py-3 bg-gray-50 flex justify-end gap-8 text-sm">
            <span className="text-gray-500">Subtotal: <strong className="text-gray-900">{fmt(subtotal)}</strong></span>
            <span className="text-gray-500">Tax: <strong className="text-gray-900">{fmt(taxTotal)}</strong></span>
            <span className="font-bold text-gray-900">Total: {fmt(subtotal + taxTotal)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/invoices')} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create Invoice'}
          </button>
        </div>
      </form>
    </div>
  );
};
