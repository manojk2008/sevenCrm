import { Client } from '@/types';

const companyNames = [
  'Tata Consultancy Services', 'Infosys', 'Wipro', 'HCL Technologies', 'Tech Mahindra', 
  'Reliance Industries', 'Adani Group', 'Bajaj Auto', 'Mahindra & Mahindra', 'HDFC Bank', 
  'ICICI Bank', 'Axis Bank', 'SBI', 'Godrej Industries', 'Larsen & Toubro', 
  'Hindustan Unilever', 'Zomato', 'Swiggy', 'Flipkart', 'Ola', 
  "BYJU'S", 'PhonePe', 'Razorpay', 'Freshworks', 'Paytm'
];

const cities = ['Mumbai', 'Bangalore', 'Delhi', 'Chennai', 'Hyderabad', 'Pune'];
const industries = ['IT Services', 'Finance', 'Manufacturing', 'FMCG', 'E-commerce', 'EdTech', 'FinTech', 'Logistics'];

const contactFirstNames = ['Rahul', 'Priya', 'Amit', 'Neha', 'Vikram', 'Sneha', 'Arjun', 'Kavitha', 'Raj', 'Pooja'];
const contactLastNames = ['Sharma', 'Patel', 'Reddy', 'Singh', 'Gupta', 'Menon', 'Nair', 'Kumar', 'Jain', 'Shah'];

export const clients: Client[] = companyNames.map((name, i) => {
  const city = cities[i % cities.length];
  const industry = industries[i % industries.length];
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');

  const contacts = Array.from({ length: 2 + (i % 2) }).map((_, j) => ({
    id: `c${i + 1}_ct${j + 1}`,
    name: `${contactFirstNames[(i + j) % contactFirstNames.length]} ${contactLastNames[(i + j) % contactLastNames.length]}`,
    email: `contact${j + 1}@${slug}.in`,
    phone: `+9198${String(10000000 + i * 100 + j).substring(0, 8)}`,
    designation: j === 0 ? 'Director' : 'Manager',
    isPrimary: j === 0,
  }));

  return {
    id: `c${i + 1}`,
    companyName: name,
    industry,
    email: `info@${slug}.in`,
    phone: contacts[0].phone,
    gstNumber: `27AABCU9603R1Z${String.fromCharCode(65 + (i % 26))}`,
    status: i % 5 === 0 ? 'inactive' : 'active',
    tags: ['Enterprise', i % 2 === 0 ? 'High Priority' : 'Standard'],
    contacts,
    address: {
      line1: `${100 + i} Business Park, Phase ${(i % 3) + 1}`,
      city,
      state:
        city === 'Mumbai' || city === 'Pune'
          ? 'Maharashtra'
          : city === 'Bangalore'
          ? 'Karnataka'
          : city === 'Chennai'
          ? 'Tamil Nadu'
          : city === 'Hyderabad'
          ? 'Telangana'
          : 'Delhi',
      country: 'India',
      pincode: `4000${(10 + i).toString().slice(-2)}`,
    },
    totalDeals: (i % 5) + 1,
    totalRevenue: ((i % 10) + 1) * 1500000,
    createdAt: new Date(Date.now() - i * 86400000 * 5).toISOString(),
    updatedAt: new Date().toISOString(),
  };
});