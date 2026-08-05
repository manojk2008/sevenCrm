import { User, UserRole } from '@/types';

export const users: User[] = [
  {
    id: 'u1',
    name: 'Rajesh Kumar',
    email: 'rajesh.kumar@sevencrm.in',
    phone: '+919876543210',
    avatar: 'RK',
    role: 'SUPER_ADMIN' as UserRole,
    status: 'active',
    department: 'Management',
    lastActive: new Date().toISOString(),
    createdAt: '2023-01-10T09:00:00Z'
  },
  {
    id: 'u2',
    name: 'Priya Sharma',
    email: 'priya.sharma@sevencrm.in',
    phone: '+919876543211',
    avatar: 'PS',
    role: 'ADMIN' as UserRole,
    status: 'active',
    department: 'Operations',
    lastActive: new Date().toISOString(),
    createdAt: '2023-01-15T09:30:00Z'
  },
  {
    id: 'u3',
    name: 'Amit Patel',
    email: 'amit.patel@sevencrm.in',
    phone: '+919876543212',
    avatar: 'AP',
    role: 'SALES_MANAGER' as UserRole,
    status: 'active',
    department: 'Sales',
    lastActive: new Date().toISOString(),
    createdAt: '2023-02-01T10:00:00Z'
  },
  {
    id: 'u4',
    name: 'Sneha Reddy',
    email: 'sneha.reddy@sevencrm.in',
    phone: '+919876543213',
    avatar: 'SR',
    role: 'SALES_MANAGER' as UserRole,
    status: 'active',
    department: 'Sales',
    lastActive: new Date().toISOString(),
    createdAt: '2023-02-15T11:00:00Z'
  },
  {
    id: 'u5',
    name: 'Vikram Singh',
    email: 'vikram.singh@sevencrm.in',
    phone: '+919876543214',
    avatar: 'VS',
    role: 'SALES_EXECUTIVE' as UserRole,
    status: 'active',
    department: 'Sales',
    lastActive: new Date().toISOString(),
    createdAt: '2023-03-01T09:00:00Z'
  },
  {
    id: 'u6',
    name: 'Neha Gupta',
    email: 'neha.gupta@sevencrm.in',
    phone: '+919876543215',
    avatar: 'NG',
    role: 'SALES_EXECUTIVE' as UserRole,
    status: 'active',
    department: 'Sales',
    lastActive: new Date().toISOString(),
    createdAt: '2023-03-10T10:30:00Z'
  },
  {
    id: 'u7',
    name: 'Arjun Menon',
    email: 'arjun.menon@sevencrm.in',
    phone: '+919876543216',
    avatar: 'AM',
    role: 'SALES_EXECUTIVE' as UserRole,
    status: 'active',
    department: 'Sales',
    lastActive: new Date().toISOString(),
    createdAt: '2023-04-05T09:45:00Z'
  },
  {
    id: 'u8',
    name: 'Kavitha Nair',
    email: 'kavitha.nair@sevencrm.in',
    phone: '+919876543217',
    avatar: 'KN',
    role: 'SALES_EXECUTIVE' as UserRole,
    status: 'active',
    department: 'Sales',
    lastActive: new Date().toISOString(),
    createdAt: '2023-05-12T11:15:00Z'
  }
];
