import React from 'react';
import AppLayout from '../../components/layouts/AppLayout';

export default function OpportunityShow({ opportunity }){
  opportunity = opportunity || { title: 'Sample Opportunity', summary: 'Details about the opportunity.' };
  return (
    <AppLayout title={opportunity.title}>
      <div className="bg-white rounded p-4 shadow">{opportunity.summary}</div>
    </AppLayout>
  );
}
