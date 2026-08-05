export interface NavigationItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}

export interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

export const NAVIGATION: NavigationSection[] = [
  {
    title: 'Main',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' }
    ]
  },
  {
    title: 'CRM',
    items: [
      { label: 'Clients', href: '/clients', icon: 'Users' },
      { label: 'Products', href: '/products', icon: 'Package' },
      { label: 'Enquiries', href: '/enquiries', icon: 'HelpCircle', badge: 5 },
      { label: 'Follow-ups', href: '/follow-ups', icon: 'PhoneCall', badge: 12 }
    ]
  },
  {
    title: 'Business',
    items: [
      { label: 'Quotations', href: '/quotations', icon: 'FileText' },
      { label: 'Sales', href: '/sales', icon: 'DollarSign' }
    ]
  },
  {
    title: 'Intelligence',
    items: [
      { label: 'Reports', href: '/reports', icon: 'BarChart' },
      { label: 'Analytics', href: '/analytics', icon: 'PieChart' }
    ]
  },
  {
    title: 'System',
    items: [
      { label: 'Users', href: '/users', icon: 'UserCog' },
      { label: 'Notifications', href: '/notifications', icon: 'Bell' },
      { label: 'Settings', href: '/settings', icon: 'Settings' }
    ]
  }
];
