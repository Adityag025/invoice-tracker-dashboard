import { useState, useEffect } from 'react';
import { Building2, FileText, Bell, Shield, AlertTriangle, Save, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { hasMinRole } from '../../lib/roles';

const ROLE_TABLE = [
  { role: 'SUB_MANAGER',       label: 'Sub Manager',       access: 'View & create own invoices' },
  { role: 'ACCOUNT_MANAGER',   label: 'Account Manager',   access: 'Create, edit & submit for approval' },
  { role: 'POD_HEAD',          label: 'POD Head',          access: 'View all in POD, manage team' },
  { role: 'ACCOUNT_DIRECTOR',  label: 'Account Director',  access: 'Approve invoices, view all' },
  { role: 'CEO',               label: 'CEO',               access: 'Full access — all operations' },
];

interface AgencySettings {
  name: string;
  gstin: string;
  address: string;
  city: string;
  email: string;
  phone: string;
}

interface InvoiceDefaults {
  paymentTerms: string;
  gstType: string;
  notes: string;
}

interface NotificationSettings {
  autoReminders: boolean;
  emailOnSend: boolean;
  firstReminderDays: number;
  followUpDays: number;
}

const DEFAULT_AGENCY: AgencySettings = { name: 'FinancePortal India Pvt Ltd', gstin: '', address: '', city: '', email: '', phone: '' };
const DEFAULT_DEFAULTS: InvoiceDefaults = { paymentTerms: '30', gstType: 'IGST', notes: 'Payment due within {terms} days. Please include the invoice number in your bank transfer reference.' };
const DEFAULT_NOTIFS: NotificationSettings = { autoReminders: true, emailOnSend: true, firstReminderDays: 3, followUpDays: 7 };

export const SettingsPage = () => {
  const { user } = useAuthStore();
  const isAdmin = hasMinRole(user?.role, 'ACCOUNT_DIRECTOR');
  const queryClient = useQueryClient();

  const { data: remote, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
    staleTime: 60_000,
  });

  const [agency, setAgency] = useState<AgencySettings>(DEFAULT_AGENCY);
  const [defaults, setDefaults] = useState<InvoiceDefaults>(DEFAULT_DEFAULTS);
  const [notifs, setNotifs] = useState<NotificationSettings>(DEFAULT_NOTIFS);

  useEffect(() => {
    if (!remote) return;
    if (remote.agency) setAgency({ ...DEFAULT_AGENCY, ...remote.agency });
    if (remote.defaults) setDefaults({ ...DEFAULT_DEFAULTS, ...remote.defaults });
    if (remote.notifs) setNotifs({ ...DEFAULT_NOTIFS, ...remote.notifs });
  }, [remote]);

  const saveMutation = useMutation({
    mutationFn: (data: object) => api.put('/settings', data).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  const saveAgency = () => {
    saveMutation.mutate({ ...remote, agency }, {
      onSuccess: () => toast.success('Agency profile saved'),
      onError: () => toast.error('Failed to save'),
    });
  };

  const saveDefaults = () => {
    saveMutation.mutate({ ...remote, defaults }, {
      onSuccess: () => toast.success('Invoice defaults saved'),
      onError: () => toast.error('Failed to save'),
    });
  };

  const saveNotifs = () => {
    saveMutation.mutate({ ...remote, notifs }, {
      onSuccess: () => toast.success('Notification settings saved'),
      onError: () => toast.error('Failed to save'),
    });
  };

  if (isLoading) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold text-on-surface tracking-tight">Settings</h1>
        <p className="text-outline text-sm mt-0.5">Manage agency profile, invoice defaults, and notification preferences</p>
      </div>

      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">Some settings can only be changed by Account Directors and above.</p>
        </div>
      )}

      {/* Agency Profile */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-outline-variant">
          <div className="w-9 h-9 bg-surface-container-low rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <h2 className="text-[18px] font-semibold text-on-surface">Agency Profile</h2>
            <p className="text-xs text-outline">Your agency details appear on all invoices and estimates</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Agency Name *</label>
              <input
                className="input"
                value={agency.name}
                onChange={e => setAgency(p => ({ ...p, name: e.target.value }))}
                disabled={!isAdmin}
                placeholder="e.g. Acme Marketing Pvt Ltd"
              />
            </div>
            <div>
              <label className="label">GSTIN</label>
              <input
                className="input font-mono"
                value={agency.gstin}
                onChange={e => setAgency(p => ({ ...p, gstin: e.target.value.toUpperCase() }))}
                disabled={!isAdmin}
                placeholder="27AABCA1234A1Z5"
                maxLength={15}
              />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <input
              className="input"
              value={agency.address}
              onChange={e => setAgency(p => ({ ...p, address: e.target.value }))}
              disabled={!isAdmin}
              placeholder="Street, Building, Area"
            />
          </div>
          <div>
            <label className="label">City / State / PIN</label>
            <input
              className="input"
              value={agency.city}
              onChange={e => setAgency(p => ({ ...p, city: e.target.value }))}
              disabled={!isAdmin}
              placeholder="Mumbai, Maharashtra - 400051"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Billing Email</label>
              <input
                type="email"
                className="input"
                value={agency.email}
                onChange={e => setAgency(p => ({ ...p, email: e.target.value }))}
                disabled={!isAdmin}
                placeholder="billing@agency.com"
              />
            </div>
            <div>
              <label className="label">Contact Phone</label>
              <input
                className="input"
                value={agency.phone}
                onChange={e => setAgency(p => ({ ...p, phone: e.target.value }))}
                disabled={!isAdmin}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="mt-5 flex justify-end">
            <button onClick={saveAgency} className="btn-primary">
              <Save className="w-4 h-4" /> Save Agency Profile
            </button>
          </div>
        )}
      </div>

      {/* Invoice Defaults */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-outline-variant">
          <div className="w-9 h-9 bg-surface-container-low rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <h2 className="text-[18px] font-semibold text-on-surface">Invoice Defaults</h2>
            <p className="text-xs text-outline">Applied automatically when creating new invoices</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Default Payment Terms</label>
              <select
                className="input"
                value={defaults.paymentTerms}
                onChange={e => setDefaults(p => ({ ...p, paymentTerms: e.target.value }))}
              >
                <option value="15">Net 15 days</option>
                <option value="30">Net 30 days</option>
                <option value="45">Net 45 days</option>
                <option value="60">Net 60 days</option>
              </select>
            </div>
            <div>
              <label className="label">Default GST Type</label>
              <select
                className="input"
                value={defaults.gstType}
                onChange={e => setDefaults(p => ({ ...p, gstType: e.target.value }))}
              >
                <option value="IGST">IGST (Inter-state)</option>
                <option value="CGST_SGST">CGST + SGST (Intra-state)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Default Invoice Notes</label>
            <textarea
              className="input resize-none"
              rows={3}
              value={defaults.notes}
              onChange={e => setDefaults(p => ({ ...p, notes: e.target.value }))}
              placeholder="Notes printed on every invoice"
            />
            <p className="text-xs text-outline mt-1">Use {'{terms}'} as a placeholder for payment terms days</p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button onClick={saveDefaults} className="btn-primary">
            <Save className="w-4 h-4" /> Save Defaults
          </button>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-outline-variant">
          <div className="w-9 h-9 bg-surface-container-low rounded-lg flex items-center justify-center">
            <Bell className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <h2 className="text-[18px] font-semibold text-on-surface">Reminder Notifications</h2>
            <p className="text-xs text-outline">Configure automatic email reminders to clients</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Toggle: auto reminders */}
          <div className="flex items-center justify-between py-3 border-b border-outline-variant/40">
            <div>
              <p className="text-sm font-medium text-on-surface">Send automatic payment reminders</p>
              <p className="text-xs text-outline mt-0.5">Emails sent automatically to clients with overdue invoices</p>
            </div>
            <button
              onClick={() => setNotifs(p => ({ ...p, autoReminders: !p.autoReminders }))}
              className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${notifs.autoReminders ? 'bg-secondary' : 'bg-outline-variant'}`}
            >
              <span className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${notifs.autoReminders ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Toggle: email on send */}
          <div className="flex items-center justify-between py-3 border-b border-outline-variant/40">
            <div>
              <p className="text-sm font-medium text-on-surface">Send invoice email when marked as Sent</p>
              <p className="text-xs text-outline mt-0.5">Client receives a copy of the invoice by email automatically</p>
            </div>
            <button
              onClick={() => setNotifs(p => ({ ...p, emailOnSend: !p.emailOnSend }))}
              className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${notifs.emailOnSend ? 'bg-secondary' : 'bg-outline-variant'}`}
            >
              <span className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${notifs.emailOnSend ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Interval fields */}
          {notifs.autoReminders && (
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <label className="label">First reminder after (days)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  className="input"
                  value={notifs.firstReminderDays}
                  onChange={e => setNotifs(p => ({ ...p, firstReminderDays: Number(e.target.value) }))}
                />
                <p className="text-xs text-outline mt-0.5">After invoice due date</p>
              </div>
              <div>
                <label className="label">Follow-up every (days)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  className="input"
                  value={notifs.followUpDays}
                  onChange={e => setNotifs(p => ({ ...p, followUpDays: Number(e.target.value) }))}
                />
                <p className="text-xs text-outline mt-0.5">Subsequent reminders</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <button onClick={saveNotifs} className="btn-primary">
            <Save className="w-4 h-4" /> Save Notification Settings
          </button>
        </div>
      </div>

      {/* Role & Access */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-outline-variant">
          <div className="w-9 h-9 bg-surface-container-low rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <h2 className="text-[18px] font-semibold text-on-surface">Role & Access</h2>
            <p className="text-xs text-outline">Role permissions are managed by the system administrator</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-outline-variant">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Permissions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {ROLE_TABLE.map(r => (
                <tr key={r.role} className={r.role === user?.role ? 'bg-secondary/5' : ''}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {r.role === user?.role && <Check className="w-3.5 h-3.5 text-secondary shrink-0" />}
                      <span className={`text-sm font-medium ${r.role === user?.role ? 'text-secondary' : 'text-on-surface'}`}>
                        {r.label}
                      </span>
                      {r.role === user?.role && (
                        <span className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-medium">You</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-outline">{r.access}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card p-6 border-error/20">
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-error/20">
          <div className="w-9 h-9 bg-error-container rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-error" />
          </div>
          <div>
            <h2 className="text-[18px] font-semibold text-error">Danger Zone</h2>
            <p className="text-xs text-outline">Irreversible actions — proceed with caution</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => toast.success('Data export started — you will receive an email shortly')}
            className="btn-secondary"
          >
            Export All Data (.xlsx)
          </button>
          <button
            disabled
            title="Contact your system administrator"
            className="btn-danger opacity-40 cursor-not-allowed"
          >
            Clear Test Data
          </button>
        </div>
        <p className="text-xs text-outline mt-3">Contact your system administrator for destructive operations.</p>
      </div>
    </div>
  );
};
