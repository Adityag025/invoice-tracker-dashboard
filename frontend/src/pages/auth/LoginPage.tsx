import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Receipt, Eye, EyeOff } from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { ROLE_LABEL, ROLE_COLOR } from '../../lib/roles';
import type { UserRole } from '../../types';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Min 6 characters'),
});
type FormData = z.infer<typeof schema>;

const DEMO_ACCOUNTS: { role: UserRole; email: string }[] = [
  { role: 'CEO',              email: 'ceo@agency.com' },
  { role: 'ACCOUNT_DIRECTOR', email: 'director@agency.com' },
  { role: 'POD_HEAD',         email: 'podhead@agency.com' },
  { role: 'ACCOUNT_MANAGER',  email: 'manager@agency.com' },
  { role: 'SUB_MANAGER',      email: 'submanager@agency.com' },
];

export const LoginPage = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);
  const [showPw, setShowPw] = useState(false);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await api.post('/auth/login', data);
      setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
      navigate('/dashboard');
    } catch {
      toast.error('Invalid email or password');
    }
  };

  return (
    <div className="min-h-screen flex bg-surface">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[420px] flex-col bg-primary text-white p-10 justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-9 h-9 bg-secondary rounded-xl flex items-center justify-center">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg">FinancePortal</span>
          </div>
          <h2 className="text-3xl font-bold leading-snug mb-4">
            Agency billing,<br />under control.
          </h2>
          <p className="text-[#a8c8e8] text-sm leading-relaxed">
            Raise invoices, track collections, manage approvals and pull GST reports — all in one place.
          </p>
        </div>

        {/* Demo credentials */}
        <div>
          <p className="text-xs font-semibold text-[#7cbaff]/60 uppercase tracking-widest mb-3">Demo accounts · password: Agency@123</p>
          <div className="space-y-2">
            {DEMO_ACCOUNTS.map(acc => (
              <button key={acc.role}
                onClick={() => { setValue('email', acc.email); setValue('password', 'Agency@123'); }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-primary-container hover:bg-[#2a4a6f] transition-colors text-left group">
                <div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLOR[acc.role]}`}>
                    {ROLE_LABEL[acc.role]}
                  </span>
                  <p className="text-xs text-[#a8c8e8] mt-1 font-mono">{acc.email}</p>
                </div>
                <span className="text-xs text-[#7cbaff] group-hover:text-white transition-colors">Use →</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 justify-center mb-8 lg:hidden">
            <div className="w-9 h-9 bg-secondary rounded-xl flex items-center justify-center">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-on-surface">FinancePortal</span>
          </div>

          <div className="mb-8">
            <h1 className="text-[28px] font-semibold text-on-surface">Sign in</h1>
            <p className="text-outline text-sm mt-1">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input {...register('email')} type="email" className="input" placeholder="you@agency.com" autoComplete="email" />
              {errors.email && <p className="text-error text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input {...register('password')} type={showPw ? 'text' : 'password'}
                  className="input pr-10" placeholder="••••••••" autoComplete="current-password" />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-error text-xs mt-1">{errors.password.message}</p>}
            </div>
            <button type="submit" className="btn-primary w-full justify-center py-2.5 mt-2" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Mobile demo hint */}
          <p className="text-xs text-center text-outline mt-6 lg:hidden">
            Demo password: <span className="font-mono font-semibold">Agency@123</span>
          </p>
        </div>
      </div>
    </div>
  );
};
