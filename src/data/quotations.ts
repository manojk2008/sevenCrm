import { Quotation, QuotationStatus } from '@/types';
import { clients } from './clients';
import { products } from './products';
import { users } from './users';

const statuses: QuotationStatus[] = [
  ...Array(3).fill('draft'),
  ...Array(5).fill('pending'),
  ...Array(4).fill('accepted'),
  ...Array(2).fill('rejected'),
  ...Array(1).fill('expired'),
];

export const quotations: Quotation[] = statuses.map((status, i) => {
  const client = clients[i % clients.length];
  const assignedUser = users[4 + (i % 4)];
  const clientContactName = client.contacts[0]?.name ?? 'Unknown Contact';

  const numItems = 2 + (i % 4);
  const lineItems = Array.from({ length: numItems }).map((_, j) => {
    const prod = products[(i + j) % products.length];
    const quantity = 1 + (j % 3);
    const amount = prod.price * quantity;

    return {
      productId: prod.id,
      productName: prod.name,
      quantity,
      unitPrice: prod.price,
      discountPercentage: 0,
      taxRate: prod.gstRate,
      amount,
    };
  });

  const subtotal = lineItems.reduce((acc, item) => acc + item.amount, 0);
  const discountAmount = i % 3 === 0 ? subtotal * 0.1 : 0;
  const taxableAmount = subtotal - discountAmount;
  const cgst = taxableAmount * 0.09;
  const sgst = taxableAmount * 0.09;
  const igst = 0;
  const grandTotal = taxableAmount + cgst + sgst + igst;

  return {
    id: `q${i + 1}`,
    quotationNumber: `QT-2024-${String(i + 1).padStart(4, '0')}`,
    clientId: client.id,
    clientName: clientContactName,
    lineItems,
    subtotal,
    discountAmount,
    taxAmount: { cgst, sgst, igst, total: cgst + sgst + igst },
    grandTotal,
    validUntil: new Date(Date.now() + 15 * 86400000).toISOString(),
    terms: '1. Payment 50% advance, 50% on completion. 2. Subject to Mumbai jurisdiction.',
    notes: 'Thank you for your business.',
    status,
    createdBy: assignedUser.id,
    sentAt: status !== 'draft' ? new Date(Date.now() - i * 86400000).toISOString() : undefined,
    acceptedAt: status === 'accepted' ? new Date(Date.now() - (i - 1) * 86400000).toISOString() : undefined,
  };
});