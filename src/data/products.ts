import { Product } from '@/types';

const productNames = [
  'Enterprise ERP Suite', 'Cloud Hosting Plan', 'Cybersecurity Audit', 'Custom API Development', 'AI Analytics Platform',
  'Data Migration Service', 'HRMS Module', 'CRM Implementation', 'Mobile App Development', 'E-commerce Setup',
  'Blockchain Consulting', 'DevOps Automation', 'Managed IT Support', 'Digital Marketing Retainer', 'SEO Optimization',
  'Supply Chain Software', 'Inventory Management', 'Payroll System', 'Helpdesk Solution', 'Payment Gateway Integration',
  'SaaS Subscription (Pro)', 'SaaS Subscription (Enterprise)', 'Data Warehouse Setup', 'BI Dashboard Creation', 'Cloud Backup Service',
  'Network Setup & config', 'Penetration Testing', 'Database Optimization', 'IoT Integration', 'Smart Contract Dev'
];

const prices = [1500000, 45000, 350000, 800000, 2500000, 500000, 600000, 900000, 1200000, 700000, 
                1500000, 800000, 100000, 50000, 30000, 1800000, 400000, 300000, 200000, 150000, 
                80000, 200000, 3000000, 500000, 40000, 120000, 250000, 180000, 2200000, 950000];

export const products: Product[] = productNames.map((name, i) => ({
  id: `p${i + 1}`,
  name,
  description: `Comprehensive ${name.toLowerCase()} tailored for Indian enterprises.`,
  category: i % 3 === 0 ? 'Software' : i % 3 === 1 ? 'Service' : 'Consulting',
  price: prices[i],
  currency: 'INR',
  hsnCode: `9983${10 + i}`,
  gstRate: 18,
  skuCode: `SKU-2024-${String(i + 1).padStart(3, '0')}`,
  stock: i % 3 === 1 ? null : 10 + i, // Services don't have stock
  isActive: true,
  images: [],
  specifications: [
    { label: 'License Type', value: i % 2 === 0 ? 'Annual' : 'Perpetual' },
    { label: 'Support Included', value: '24x7 Email & Call' }
  ],
  createdAt: new Date(Date.now() - i * 86400000 * 2).toISOString(),
  updatedAt: new Date().toISOString()
}));
