import React from 'react';

export default function InvoiceTemplate({ invoice }){
  invoice = invoice || { number: 'INV-001', amount: 1200 };
  return (
    <div style={{fontFamily:'Arial, sans-serif'}}>
      <h2>Invoice: {invoice.number}</h2>
      <div>Amount due: ${invoice.amount}</div>
    </div>
  );
}
