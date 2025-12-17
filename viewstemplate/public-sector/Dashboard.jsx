import React from 'react';
import AppLayout from '../components/layouts/AppLayout';

export default function PublicSectorDashboard() {
  return (
    <AppLayout title="Public Sector Dashboard">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded p-4 shadow">Opportunities</div>
        <div className="bg-white rounded p-4 shadow">Agencies</div>
      </div>
    </AppLayout>
  );
}
