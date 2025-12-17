import React from 'react';
import AppLayout from '../../../components/layouts/AppLayout';

export default function VerificationRequired(){
  return (
    <AppLayout title="Verification Required">
      <div className="bg-white rounded p-4 shadow">You must complete verification to publish listings.</div>
    </AppLayout>
  );
}
