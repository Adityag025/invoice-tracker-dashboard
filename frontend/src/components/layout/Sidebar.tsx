import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, FileCheck, Users, BarChart3, LogOut, Receipt, FileX, UsersRound, Briefcase, ClipboardCheck, Settings2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { hasMinRole, ROLE_LABEL } from '../../lib/roles';
import type { UserRole } from '../../types';
import { clsx } from 'clsx';

const NAV = [
  { to: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard,  minRole: undefined },
  { to: '/invoices',     label: 'Invoices',     icon: FileText,         minRole: undefined },
  { to: '/estimates',    label: 'Estimates',    icon: FileCheck,        minRole: undefined },
  { to: '/credit-notes', label: 'Credit Notes', icon: FileX,            minRole: undefined },
  { to: '/clients',      label: 'Clients',      icon: Users,            minRole: undefined },
  { to: '/reports',      label: 'Reports',      icon: BarChart3,        minRole: undefined },
  { to: '/approvals',    label: 'Approvals',    icon: ClipboardCheck,   minRole: 'ACCOUNT_MANAGER' as UserRole },
  { to: '/projects',     label: 'Projects',     icon: Briefcase,        minRole: 'ACCOUNT_MANAGER' as UserRole },
  { to: '/team',         label: 'Team',         icon: UsersRound,       minRole: 'ACCOUNT_MANAGER' as UserRole },
];

export const Sidebar = ({ onClose }: { onClose?: () => void }) => {
  const { user, logout } = useAuthStore();

  const visibleNav = NAV.filter(item =>
    !item.minRole || hasMinRole(user?.role, item.minRole)
  );

  return (
    <aside className="fixed left-0 top-0 h-full w-[260px] bg-primary flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-primary-container">
        <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center shrink-0">
          <Receipt className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-tight">FinancePortal</p>
          <p className="text-[#7cbaff]/70 text-xs">Marketing Agency</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
        {visibleNav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 pl-3 pr-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'border-l-4 border-secondary-container bg-primary-container text-secondary-container pl-2'
                  : 'text-[#a8c8e8] hover:bg-primary-container hover:text-white'
              )
            }
            onClick={onClose}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Settings link — pinned above footer */}
      <div className="px-3 pt-2 pb-1 border-t border-primary-container/50">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 pl-3 pr-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'border-l-4 border-secondary-container bg-primary-container text-secondary-container pl-2'
                : 'text-[#a8c8e8] hover:bg-primary-container hover:text-white'
            )
          }
        >
          <Settings2 className="w-4 h-4 shrink-0" />
          Settings
        </NavLink>
      </div>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-primary-container">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container text-xs font-bold shrink-0">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-[#a8c8e8] text-xs truncate">
              {ROLE_LABEL[user?.role as UserRole] ?? user?.role}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[#a8c8e8] hover:bg-primary-container hover:text-white text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
};
