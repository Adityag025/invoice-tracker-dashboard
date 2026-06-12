import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { Invoice } from '../types';

interface InvoiceFilters {
  clientId?: string;
  projectId?: string;
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: string;
}

export const useInvoices = (filters: InvoiceFilters = {}) =>
  useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => api.get('/invoices', { params: filters }).then(r => r.data),
  });

export const useInvoice = (id: string) =>
  useQuery({
    queryKey: ['invoices', id],
    queryFn: () => api.get(`/invoices/${id}`).then(r => r.data),
    enabled: !!id,
  });

export const useCreateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Invoice>) => api.post('/invoices', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
};

export const useUpdateInvoiceStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/invoices/${id}/status`, { status }).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoices', id] });
    },
  });
};
