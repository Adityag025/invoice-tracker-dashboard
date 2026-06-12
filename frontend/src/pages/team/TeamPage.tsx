import { useState } from 'react';
import { format } from 'date-fns';
import { UserPlus, Pencil, Trash2, X, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../../stores/authStore';
import { ROLE_LABEL, ROLE_COLOR, ROLE_LEVEL, manageableRoles } from '../../lib/roles';
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

export const TeamPage = () => {
  const qc = useQueryClient();
  const { user: me } = useAuthStore();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TeamMember | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState<TeamMember | null>(null);

  const myRole = me?.role ?? '';
  const myLevel = ROLE_LEVEL[myRole as UserRole] ?? 0;
  const allowed = manageableRoles(myRole);
  const canAddAny = allowed.length > 0;

  const { data: members = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
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
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-sm text-gray-500 mt-0.5">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        {canAddAny && (
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <UserPlus className="w-4 h-4" /> Add Member
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
