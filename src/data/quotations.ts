import { Quotation } from '@/types';
import { clients } from './clients';
import { products } from './products';
import { enquiries } from './enquiries';

const statuses = [
  ...Array(3).fill('Draft'),
  ...Array(5).fill('Pending'),
  ...Array(4).fill('Accepted'),
  ...Array(2).fill('Rejected'),
  ...Array(1).fill('Expired')
];

export const quotations: Quotation[] = statuses.map((status, i) => {
  const client = clients[i % clients.length];
  const enquiry = enquiries[i % enquiries.length];
  
  const numItems = 2 + (i % 4);
  const lineItems = Array.from({ length: numItems }).map((_, j) => {
    const prod = products[(i + j) % products.length];
    const quantity = 1 + (j % 3);
    const amount = prod.price * quantity;
    const cgst = amount * 0.09;
    const sgst = amount * 0.09;
    
    return {
      id: `ql${i}_${j}`,
      productId: prod.id,
      productName: prod.name,
      quantity,
      unitPrice: prod.price,
      amount,
      taxAmount: cgst + sgst,
      cgst,
      sgst,
      igst: 0,
      total: amount + cgst + sgst
    };
  });

  const subTotal = lineItems.reduce((acc, item) => acc + item.amount, 0);
  const totalTax = lineItems.reduce((acc, item) => acc + item.taxAmount, 0);
  const discount = (i % 3 === 0) ? subTotal * 0.1 : 0;
  const grandTotal = subTotal + totalTax - discount;

  return {
    id: `q${i + 1}`,
    quotationNumber: `QT-2024-${String(i + 1).padStart(4, '0')}`,
    clientId: client.id,
    enquiryId: enquiry.id,
    status: status as any,
    date: new Date(Date.now() - i * 86400000).toISOString(),
    validUntil: new Date(Date.now() + 15 * 86400000).toISOString(),
    subTotal,
    discount,
    totalTax,
    grandTotal,
    lineItems,
    terms: '1. Payment 50% advance, 50% on completion. 2. Subject to Mumbai jurisdiction.',
    notes: 'Thank you for your business.',
    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  };
});
