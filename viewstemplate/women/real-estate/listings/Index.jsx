import React from 'react';
import AppLayout from '../../../components/layouts/AppLayout';

export default function ListingsIndex(){
  const listings = [{id:1,title:'Loft',price:650000},{id:2,title:'Townhouse',price:1200000}];
  return (
    <AppLayout title="Listings">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {listings.map(l => (
          <div key={l.id} className="bg-white rounded p-4 shadow">
            <h3 className="font-bold text-emerald-700">{l.title}</h3>
            <p className="text-gray-600">${l.price.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
