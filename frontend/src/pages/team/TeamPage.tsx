import { useState } from 'react';
import { format } from 'date-fns';
import { UserPlus, Pencil, Trash2, X, ShieldCheck, Layers, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../../stores/authStore';
import { ROLE_LABEL, ROLE_COLOR, ROLE_LEVEL, manageableRoles, hasMinRole } from '../../lib/roles';
import type { UserRole } from '../../types';
import api from '../../lib/api';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

const userSchema = z.object({
  name:     z.string().min(1, 'Name required'),
  email:    z.string().email('Valid email required'),
  password: z.string().min(8, 'Min 8 characters').optional().or(z.literal('')),
  role:     z.string().min(1, 'Role required'),
});
type UserFormData = z.infer<typeof userSchema>;

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_COLOR[role] ?? 'bg-gray-100 text-gray-600'}`}>
      {ROLE_LABEL[role] ?? role}
    </span>
  );
}

function UserModal({
  member,
  allowedRoles,
  onClose,
  onSave,
  isSaving,
}: {
  member?: TeamMember;
  allowedRoles: UserRole[];
  onClose: () => void;
  onSave: (data: UserFormData) => Promise<void>;
  isSaving: boolean;
}) {
  const schema = member
    ? userSchema.omit({ password: true }).extend({ password: z.string().min(8).optional().or(z.literal('')) })
    : userSchema.extend({ password: z.string().min(8, 'Password required for new users') });

  const { register, handleSubmit, formState: { errors } } = useForm<UserFormData>({
    resolver: zodResolver(schema),
    defaultValues: member
      ? { name: member.name, email: member.email, role: member.role, password: '' }
      : { name: '', email: '', role: '', password: '' },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900">{member ? 'Edit Member' : 'Add Team Member'}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit(onSave)} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input {...register('name')} className="input" placeholder="Arjun Mehta" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input {...register('email')} className="input" placeholder="arjun@agency.com" type="email" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password {member ? '(leave blank to keep current)' : '*'}
            </label>
            <input {...register('password')} className="input" placeholder="••••••••" type="password" />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
            <select {...register('role')} className="input">
              <option value="">Select role…</option>
              {allowedRoles.map(r => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
            {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role.message}</p>}
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isSaving} className="btn-primary flex-1">
              {isSaving ? 'Saving…' : member ? 'Save Changes' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface Pod {
  id: string;
  name: string;
  podHeadId?: string | null;
  accountDirectorId?: string | null;
  podHead?: { id: string; name: string } | null;
  accountDirector?: { id: string; name: string } | null;
  _count?: { clients: number };
  active: boolean;
  createdAt: string;
}

interface TeamMemberLight {
  id: string;
  name: string;
  role: UserRole;
}

const podSchema = z.object({
  name: z.string().min(1, 'Name required'),
  podHeadId: z.string().optional().nullable(),
  accountDirectorId: z.string().optional().nullable(),
});
type PodFormData = z.infer<typeof podSchema>;

function PodModal({ pod, podHeads, directors, onClose, onSave, isSaving }: {
  pod?: Pod;
  podHeads: TeamMemberLight[];
  directors: TeamMemberLight[];
  onClose: () => void;
  onSave: (data: PodFormData) => void;
  isSaving: boolean;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<PodFormData>({
    resolver: zodResolver(podSchema),
    defaultValues: {
      name: pod?.name ?? '',
      podHeadId: pod?.podHeadId ?? '',
      accountDirectorId: pod?.accountDirectorId ?? '',
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-gray-900">{pod ? 'Edit POD' : 'New POD'}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit(onSave)} className="px-6 py-5 space-y-4">
          <div>
            <label className="label">POD Name *</label>
            <input {...register('name')} className="input" placeholder="Growth POD" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Account Director</label>
            <select {...register('accountDirectorId')} className="input">
              <option value="">None</option>
              {directors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Pod Head</label>
            <select {...register('podHeadId')} className="input">
              <option value="">None</option>
              {podHeads.map(ph => <option key={ph.id} value={ph.id}>{ph.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isSaving} className="btn-primary flex-1">{isSaving ? 'Saving…' : pod ? 'Save Changes' : 'Create POD'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export const TeamPage = () => {
  const qc = useQueryClient();
  const { user: me } = useAuthStore();
  const [tab, setTab] = useState<'members' | 'pods'>('members');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TeamMember | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState<TeamMember | null>(null);
  const [showPodModal, setShowPodModal] = useState(false);
  const [editingPod, setEditingPod] = useState<Pod | undefined>(undefined);

  const myRole = me?.role ?? '';
  const myLevel = ROLE_LEVEL[myRole as UserRole] ?? 0;
  const allowed = manageableRoles(myRole);
  const canAddAny = allowed.length > 0;
  const canManagePods = hasMinRole(myRole, 'ACCOUNT_DIRECTOR');

  const { data: members = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });

  const { data: pods = [], isLoading: podsLoading } = useQuery<Pod[]>({
    queryKey: ['pods'],
    queryFn: () => api.get('/pods').then(r => r.data),
  });

  const podHeads = (members as TeamMemberLight[]).filter(m => m.role === 'POD_HEAD');
  const directors = (members as TeamMemberLight[]).filter(m => m.role === 'ACCOUNT_DIRECTOR' || m.role === 'CEO');

  const createPod = useMutation({
    mutationFn: (data: PodFormData) => api.post('/pods', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pods'] }); toast.success('POD created'); setShowPodModal(false); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed'),
  });

  const updatePod = useMutation({
    mutationFn: ({ id, ...data }: PodFormData & { id: string }) => api.patch(`/pods/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pods'] }); toast.success('POD updated'); setEditingPod(undefined); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed'),
  });

  const deletePod = useMutation({
    mutationFn: (id: string) => api.delete(`/pods/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pods'] }); toast.success('POD deactivated'); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed'),
  });

  const createMember = useMutation({
    mutationFn: (data: UserFormData) => api.post('/users', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Member added'); setShowModal(false); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed'),
  });

  const updateMember = useMutation({
    mutationFn: (data: UserFormData & { id: string }) => {
      const { id, ...rest } = data;
      const payload: Partial<UserFormData> = { ...rest };
      if (!payload.password) delete payload.password;
      return api.patch(`/users/${id}`, payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Member updated'); setEditing(undefined); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed'),
  });

  const deleteMember = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Member removed'); setConfirmDelete(null); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed'),
  });

  const canEdit = (m: TeamMember) =>
    m.id === me?.id || (ROLE_LEVEL[m.role] ?? 0) < myLevel;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold text-on-surface">Team</h1>
          <p className="text-sm text-gray-500 mt-0.5">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          {tab === 'members' && canAddAny && (
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <UserPlus className="w-4 h-4" /> Add Member
            </button>
          )}
          {tab === 'pods' && canManagePods && (
            <button onClick={() => setShowPodModal(true)} className="btn-primary">
              <Layers className="w-4 h-4" /> New POD
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab('members')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'members' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Users className="w-4 h-4" /> Members
        </button>
        <button
          onClick={() => setTab('pods')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'pods' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Layers className="w-4 h-4" /> PODs
        </button>
      </div>

      {tab === 'pods' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {podsLoading ? (
            <div className="py-12 text-center text-gray-400">Loading…</div>
          ) : pods.length === 0 ? (
            <div className="py-12 text-center text-gray-400">No PODs created yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">POD Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Account Director</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pod Head</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Clients</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pods.map(pod => (
                  <tr key={pod.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                          <Layers className="w-4 h-4 text-indigo-500" />
                        </div>
                        <span className="font-medium text-gray-900">{pod.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600">{pod.accountDirector?.name ?? '—'}</td>
                    <td className="px-4 py-3.5 text-gray-600">{pod.podHead?.name ?? '—'}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{pod._count?.clients ?? 0}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      {canManagePods && (
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setEditingPod(pod)} className="w-7 h-7 rounded-lg hover:bg-blue-50 flex items-center justify-center text-gray-400 hover:text-blue-600 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deletePod.mutate(pod.id)} className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
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
      )}

      {tab === 'members' && <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-gray-400">Loading…</div>
        ) : members.length === 0 ? (
          <div className="py-12 text-center text-gray-400">No team members yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.map(m => (
                <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {m.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{m.name}</p>
                        {m.id === me?.id && <p className="text-xs text-blue-500">You</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-gray-500">{m.email}</td>
                  <td className="px-4 py-3.5"><RoleBadge role={m.role} /></td>
                  <td className="px-4 py-3.5 text-gray-400">{format(new Date(m.createdAt), 'dd MMM yyyy')}</td>
                  <td className="px-4 py-3.5">
                    {canEdit(m) && (
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setEditing(m)}
                          className="w-7 h-7 rounded-lg hover:bg-blue-50 flex items-center justify-center text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {m.id !== me?.id && (
                          <button
                            onClick={() => setConfirmDelete(m)}
                            className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      }

      {/* Role legend */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Role Permissions</h3>
        <div className="space-y-2">
          {([['CEO', 'Full access. Manages Account Directors and below. Only role that can create Account Directors.'],
             ['ACCOUNT_DIRECTOR', 'Full visibility. Manages Pod Heads and below. Cannot touch CEO accounts.'],
             ['POD_HEAD', 'Adds clients. Manages Account Managers and Sub Managers within their pod.'],
             ['ACCOUNT_MANAGER', 'Creates and updates invoices. Manages Sub Managers.'],
             ['SUB_MANAGER', 'View access. Limited invoice updates. Cannot manage other users.'],
          ] as [UserRole, string][]).map(([role, desc]) => (
            <div key={role} className="flex items-start gap-3">
              <RoleBadge role={role} />
              <p className="text-xs text-gray-500 pt-1">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {(showPodModal || editingPod) && (
        <PodModal
          pod={editingPod}
          podHeads={podHeads}
          directors={directors}
          onClose={() => { setShowPodModal(false); setEditingPod(undefined); }}
          isSaving={createPod.isPending || updatePod.isPending}
          onSave={(data) => {
            const clean = { ...data, podHeadId: data.podHeadId || null, accountDirectorId: data.accountDirectorId || null };
            if (editingPod) updatePod.mutate({ ...clean, id: editingPod.id });
            else createPod.mutate(clean);
          }}
        />
      )}

      {(showModal || editing) && (
        <UserModal
          member={editing}
          allowedRoles={allowed}
          onClose={() => { setShowModal(false); setEditing(undefined); }}
          isSaving={createMember.isPending || updateMember.isPending}
          onSave={async (data) => {
            if (editing) {
              await updateMember.mutateAsync({ ...data, id: editing.id });
            } else {
              await createMember.mutateAsync(data);
            }
          }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Remove {confirmDelete.name}?</h2>
            <p className="text-sm text-gray-500">This cannot be undone. The user will lose all access immediately.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => deleteMember.mutate(confirmDelete.id)}
                disabled={deleteMember.isPending}
                className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {deleteMember.isPending ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
