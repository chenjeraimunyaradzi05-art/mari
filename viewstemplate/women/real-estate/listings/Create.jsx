import React from 'react';
import AppLayout from '../../../components/layouts/AppLayout';
import ListingForm from './ListingForm';

export default function CreateListing(){
  return (
    <AppLayout title="Create Listing">
      <div className="bg-white rounded p-4 shadow">
        <ListingForm />
      </div>
    </AppLayout>
  );
}
