import React from 'react';
import AppLayout from '../../components/layouts/AppLayout';

export default function Timeline(){
  const events = [{id:1, text:'Joined community'}, {id:2, text:'Posted listing'}];
  return (
    <AppLayout title="Timeline">
      <div className="space-y-4">
        {events.map(e => <div key={e.id} className="bg-white rounded p-4 shadow">{e.text}</div>)}
      </div>
    </AppLayout>
  );
}
