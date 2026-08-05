import { UserRole } from '@/types';

export type ModuleAction = 'view' | 'create' | 'edit' | 'delete';

export type ModulePermissions = Record<ModuleAction, boolean>;

export type RolePermissions = {
  [module: string]: ModulePermissions;
};

const ALL_PERMISSIONS: ModulePermissions = {
  view: true,
  create: true,
  edit: true,
  delete: true,
};

const VIEW_ONLY: ModulePermissions = {
  view: true,
  create: false,
  edit: false,
  delete: false,
};

const VIEW_CREATE_EDIT: ModulePermissions = {
  view: true,
  create: true,
  edit: true,
  delete: false,
};

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  'super-admin': {
    dashboard: ALL_PERMISSIONS,
    clients: ALL_PERMISSIONS,
    products: ALL_PERMISSIONS,
    enquiries: ALL_PERMISSIONS,
    'follow-ups': ALL_PERMISSIONS,
    quotations: ALL_PERMISSIONS,
    sales: ALL_PERMISSIONS,
    reports: ALL_PERMISSIONS,
    analytics: ALL_PERMISSIONS,
    users: ALL_PERMISSIONS,
    settings: ALL_PERMISSIONS,
  },
  'admin': {
    dashboard: ALL_PERMISSIONS,
    clients: ALL_PERMISSIONS,
    products: ALL_PERMISSIONS,
    enquiries: ALL_PERMISSIONS,
    'follow-ups': ALL_PERMISSIONS,
    quotations: ALL_PERMISSIONS,
    sales: ALL_PERMISSIONS,
    reports: ALL_PERMISSIONS,
    analytics: ALL_PERMISSIONS,
    users: VIEW_ONLY,
    settings: VIEW_ONLY,
  },
  'sales-manager': {
    dashboard: ALL_PERMISSIONS,
    clients: VIEW_CREATE_EDIT,
    products: VIEW_ONLY,
    enquiries: VIEW_CREATE_EDIT,
    'follow-ups': VIEW_CREATE_EDIT,
    quotations: VIEW_CREATE_EDIT,
    sales: VIEW_CREATE_EDIT,
    reports: VIEW_ONLY,
    analytics: VIEW_ONLY,
    users: { view: false, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false },
  },
  'sales-executive': {
    dashboard: VIEW_ONLY,
    clients: VIEW_CREATE_EDIT,
    products: VIEW_ONLY,
    enquiries: VIEW_CREATE_EDIT,
    'follow-ups': VIEW_CREATE_EDIT,
    quotations: VIEW_CREATE_EDIT,
    sales: VIEW_ONLY,
    reports: { view: false, create: false, edit: false, delete: false },
    analytics: { view: false, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false },
  },
};
