import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Building2, Mail, Phone } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useClients, useCreateClient } from '../../hooks/useClients';
import { PageLoader } from '../../components/ui/LoadingSpinner';

const INDIAN_STATES = [
  ['01', 'Jammu & Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'], ['04', 'Chandigarh'],
  ['05', 'Uttarakhand'], ['06', 'Haryana'], ['07', 'Delhi'], ['08', 'Rajasthan'],
  ['09', 'Uttar Pradesh'], ['10', 'Bihar'], ['11', 'Sikkim'], ['12', 'Arunachal Pradesh'],
  ['13', 'Nagaland'], ['14', 'Manipur'], ['15', 'Mizoram'], ['16', 'Tripura'],
  ['17', 'Meghalaya'], ['18', 'Assam'], ['19', 'West Bengal'], ['20', 'Jharkhand'],
  ['21', 'Odisha'], ['22', 'Chhattisgarh'], ['23', 'Madhya Pradesh'], ['24', 'Gujarat'],
  ['26', 'Dadra & Nagar Haveli and Daman & Diu'], ['27', 'Maharashtra'], ['28', 'Andhra Pradesh'],
  ['29', 'Karnataka'], ['30', 'Goa'], ['31', 'Lakshadweep'], ['32', 'Kerala'],
  ['33', 'Tamil Nadu'], ['34', 'Puducherry'], ['35', 'Andaman & Nicobar Islands'],
  ['36', 'Telangana'], ['37', 'Andhra Pradesh (New)'],
];

const schema = z.object({
  name: z.string().min(1, 'Required'),
  gstin: z.string().optional(),
  stateCode: z.string().min(1, 'Required'),
  billingTerms: z.string().default('NET_30'),
  contactName: z.string().min(1, 'Required'),
  contactEmail: z.string().email('Invalid email'),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export const ClientsPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const { data, isLoading } = useClients(search || undefined);
  const createClient = useCreateClient();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { billingTerms: 'NET_30', stateCode: '27' },
  });

  const onSubmit = async (data: FormData) => {
    try {
      await createClient.mutateAsync(data);
      toast.success('Client created');
      reset();
      setShowForm(false);
    } catch {
      toast.error('Failed to create client');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 text-sm mt-0.5">{data?.total ?? 0} clients</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> New Client
        </button>
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search clients by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {showForm && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">New Client</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Company Name *</label>
              <input {...register('name')} className="input" placeholder="Acme Corp" />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">GSTIN</label>
              <input {...register('gstin')} className="input font-mono" placeholder="27AABCU9603R1ZX" />
            </div>
            <div>
              <label className="label">State *</label>
              <select {...register('stateCode')} className="input">
                {INDIAN_STATES.map(([code, name]) => <option key={code} value={code}>{code} — {name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Billing Terms</label>
              <select {...register('billingTerms')} className="input">
                <option value="NET_15">Net 15</option>
                <option value="NET_30">Net 30</option>
                <option value="NET_45">Net 45</option>
                <option value="NET_60">Net 60</option>
              </select>
            </div>
            <div>
              <label className="label">Contact Name *</label>
              <input {...register('contactName')} className="input" />
              {errors.contactName && <p className="text-red-500 text-xs mt-1">{errors.contactName.message}</p>}
            </div>
            <div>
              <label className="label">Contact Email *</label>
              <input {...register('contactEmail')} type="email" className="input" />
              {errors.contactEmail && <p className="text-red-500 text-xs mt-1">{errors.contactEmail.message}</p>}
            </div>
            <div>
              <label className="label">Phone</label>
              <input {...register('contactPhone')} className="input" placeholder="+91 98765 43210" />
            </div>
            <div className="col-span-2">
              <label className="label">Address</label>
              <input {...register('address')} className="input" placeholder="Office address" />
            </div>
            <div className="col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Create Client'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? <PageLoader /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data?.clients?.length === 0 && (
            <p className="text-gray-400 text-sm col-span-3 py-8 text-center">No clients yet</p>
          )}
          {data?.clients?.map((client: { id: string; name: string; gstin?: string; contactName: string; contactEmail: string; contactPhone?: string; stateCode: string }) => (
            <div
              key={client.id}
              className="card p-5 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/clients/${client.id}`)}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{client.name}</p>
                  {client.gstin && <p className="text-xs text-gray-400 font-mono mt-0.5">{client.gstin}</p>}
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{client.contactEmail}</span>
                    </div>
                    {client.contactPhone && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Phone className="w-3 h-3" />
                        {client.contactPhone}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
