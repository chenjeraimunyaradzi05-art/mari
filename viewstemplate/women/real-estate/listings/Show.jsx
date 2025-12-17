import React from 'react';
import AppLayout from '../../../components/layouts/AppLayout';

export default function ListingShow({ listing }){
  listing = listing || { title: 'Stylish Loft', price: 750000, location: 'Brooklyn' };
  return (
    <AppLayout title={listing.title}>
      <div className="bg-white rounded p-4 shadow">
        <h2 className="text-xl font-bold">{listing.title}</h2>
        <p className="text-gray-600">{listing.location}</p>
        <p className="text-emerald-700 font-semibold">${listing.price.toLocaleString()}</p>
      </div>
    </AppLayout>
  );
}
