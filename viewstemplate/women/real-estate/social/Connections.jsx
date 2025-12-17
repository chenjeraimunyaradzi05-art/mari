import React from 'react';
import AppLayout from '../../components/layouts/AppLayout';

export default function Connections(){
  const connections = [{id:1,name:'Alice'},{id:2,name:'Bob'}];
  return (
    <AppLayout title="Connections">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {connections.map(c => <div key={c.id} className="bg-white rounded p-4 shadow">{c.name}</div>)}
      </div>
    </AppLayout>
  );
}
