import React from 'react';
import AppLayout from '../../../components/layouts/AppLayout';
import ListingForm from './ListingForm';

export default function EditListing(){
  const initial = { title: 'Sample Listing', price: 500000 };
  return (
    <AppLayout title="Edit Listing">
      <div className="bg-white rounded p-4 shadow">
        <ListingForm initial={initial} />
      </div>
    </AppLayout>
  );
}
