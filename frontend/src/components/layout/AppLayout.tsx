import { useState, useRef, useEffect } from 'react';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { Bell, Menu, X, AlertCircle, Clock, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '../../stores/authStore';
import api from '../../lib/api';

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['notifications', 'counts'],
    queryFn: () => api.get('/notifications/counts').then(r => r.data) as Promise<{ overdueCount: number; pendingApprovalCount: number }>,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const total = (data?.overdueCount ?? 0) + (data?.pendingApprovalCount ?? 0);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors"
      >
        <Bell className="w-5 h-5" />
        {total > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-error text-on-error text-[10px] font-bold rounded-full flex items-center justify-center">
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-72 bg-white rounded-xl shadow-card-md border border-outline-variant overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-outline-variant">
            <p className="font-semibold text-sm text-on-surface">Notifications</p>
          </div>
          {total === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-outline">All clear</div>
          ) : (
            <div className="divide-y divide-outline-variant/40">
              {(data?.overdueCount ?? 0) > 0 && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 bg-error-container rounded-lg flex items-center justify-center shrink-0">
                    <AlertCircle className="w-4 h-4 text-error" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-on-surface">{data?.overdueCount} Overdue Invoice{data?.overdueCount !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-outline">Require immediate attention</p>
                  </div>
                </div>
              )}
              {(data?.pendingApprovalCount ?? 0) > 0 && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-on-surface">{data?.pendingApprovalCount} Pending Approval</p>
                    <p className="text-xs text-outline">Awaiting your review</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const AppLayout = () => {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const [searchQ, setSearchQ] = useState('');

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — always visible on md+, drawer on mobile */}
      <div className={`fixed left-0 top-0 h-full z-30 transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <main className="flex-1 md:ml-[260px] overflow-y-auto flex flex-col min-h-screen">
        {/* Top header */}
        <header className="sticky top-0 z-10 bg-white border-b border-outline-variant h-14 flex items-center gap-3 px-4 md:px-6 shrink-0">
          <button
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors shrink-0"
            onClick={() => setSidebarOpen(o => !o)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Desktop search bar */}
          <div className="hidden md:flex flex-1 max-w-sm">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
              <input
                className="w-full pl-9 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all"
                placeholder="Search invoices, clients…"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && searchQ.trim()) {
                    navigate(`/invoices?search=${encodeURIComponent(searchQ.trim())}`);
                    setSearchQ('');
                  }
                }}
              />
            </div>
          </div>

          <div className="ml-auto">
            <NotificationBell />
          </div>
        </header>

        <div className="p-4 md:p-6 max-w-7xl mx-auto w-full flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
