import React from 'react';
import AppLayout from '../../components/layouts/AppLayout';

export default function RentalsIndex(){
  const rentals = [{id:1,title:'1BR Apt',price:2000},{id:2,title:'Studio',price:1600}];
  return (
    <AppLayout title="Rentals">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rentals.map(r => (
          <div key={r.id} className="bg-white rounded p-4 shadow">
            <h3 className="font-bold text-emerald-700">{r.title}</h3>
            <p className="text-gray-600">${r.price}/mo</p>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
