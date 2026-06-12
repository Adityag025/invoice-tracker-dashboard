import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { Client } from '../types';

export const useClients = (search?: string, page = 1) =>
  useQuery({
    queryKey: ['clients', { search, page }],
    queryFn: () => api.get('/clients', { params: { search, page } }).then(r => r.data),
  });

export const useClient = (id: string) =>
  useQuery({
    queryKey: ['clients', id],
    queryFn: () => api.get(`/clients/${id}`).then(r => r.data),
    enabled: !!id,
  });

export const useCreateClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Client>) => api.post('/clients', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
};

export const useUpdateClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Client> & { id: string }) =>
      api.put(`/clients/${id}`, data).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['clients', id] });
    },
  });
};
