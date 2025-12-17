import React from 'react';
import AppLayout from '../../components/layouts/AppLayout';

export default function RentalShow({ rental }){
  rental = rental || { title: 'Cozy Apartment', price: 2200, location: 'Queens' };
  return (
    <AppLayout title={rental.title}>
      <div className="bg-white rounded p-4 shadow">
        <h2 className="text-xl font-bold">{rental.title}</h2>
        <p className="text-gray-600">{rental.location}</p>
        <p className="text-emerald-700 font-semibold">${rental.price}/mo</p>
      </div>
    </AppLayout>
  );
}
