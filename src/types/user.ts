export type UserRole = 'super-admin' | 'admin' | 'sales-manager' | 'sales-executive';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
  status: 'active' | 'inactive';
  department?: string;
  lastActive?: string | Date;
  createdAt: string | Date;
}

export interface Permission {
  module: string;
  actions: ('view' | 'create' | 'edit' | 'delete')[];
}

export const ROLE_LABELS: Record<UserRole, string> = {
  'super-admin': 'Super Admin',
  'admin': 'Admin',
  'sales-manager': 'Sales Manager',
  'sales-executive': 'Sales Executive',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  'super-admin': 'bg-purple-100 text-purple-800',
  'admin': 'bg-blue-100 text-blue-800',
  'sales-manager': 'bg-indigo-100 text-indigo-800',
  'sales-executive': 'bg-emerald-100 text-emerald-800',
};
