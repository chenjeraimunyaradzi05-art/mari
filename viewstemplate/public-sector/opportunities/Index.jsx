import React from 'react';
import AppLayout from '../../components/layouts/AppLayout';

export default function OpportunitiesIndex(){
  const items = [{id:1, title:'Opportunity One'}, {id:2, title:'Opportunity Two'}];
  return (
    <AppLayout title="Opportunities">
      <div className="space-y-4">
        {items.map(i => <div key={i.id} className="bg-white rounded p-4 shadow">{i.title}</div>)}
      </div>
    </AppLayout>
  );
}
