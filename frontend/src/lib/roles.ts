import type { UserRole } from '../types';

export const ROLE_LEVEL: Record<UserRole, number> = {
  SUB_MANAGER:       1,
  ACCOUNT_MANAGER:   2,
  POD_HEAD:          3,
  ACCOUNT_DIRECTOR:  4,
  CEO:               5,
};

export const ROLE_LABEL: Record<UserRole, string> = {
  CEO:               'CEO',
  ACCOUNT_DIRECTOR:  'Account Director',
  POD_HEAD:          'Pod Head',
  ACCOUNT_MANAGER:   'Account Manager',
  SUB_MANAGER:       'Sub Manager',
};

export const ROLE_COLOR: Record<UserRole, string> = {
  CEO:               'bg-purple-100 text-purple-700',
  ACCOUNT_DIRECTOR:  'bg-blue-100 text-blue-700',
  POD_HEAD:          'bg-indigo-100 text-indigo-700',
  ACCOUNT_MANAGER:   'bg-green-100 text-green-700',
  SUB_MANAGER:       'bg-gray-100 text-gray-600',
};

export const ALL_ROLES = Object.keys(ROLE_LEVEL) as UserRole[];

export function hasMinRole(userRole: string | undefined, minRole: UserRole): boolean {
  return (ROLE_LEVEL[userRole as UserRole] ?? 0) >= ROLE_LEVEL[minRole];
}

export function manageableRoles(actorRole: string): UserRole[] {
  const actorLevel = ROLE_LEVEL[actorRole as UserRole] ?? 0;
  return ALL_ROLES.filter(r => ROLE_LEVEL[r] < actorLevel);
}
