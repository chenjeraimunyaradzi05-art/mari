import React from 'react';
import AppLayout from '../components/layouts/AppLayout';

export default function MemberDashboard() {
  return (
    <AppLayout title="Member Dashboard">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded p-4 shadow">Panel 1</div>
        <div className="bg-white rounded p-4 shadow">Panel 2</div>
        <div className="bg-white rounded p-4 shadow">Panel 3</div>
      </div>
    </AppLayout>
  );
}
