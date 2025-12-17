import React from 'react';
import MasterLayout from './MasterLayout';

export default function AppLayout({ children, title }) {
  return (
    <MasterLayout>
      <div className="prose max-w-none">
        {title && <h1 className="text-3xl font-bold text-emerald-700 mb-4">{title}</h1>}
        {children}
      </div>
    </MasterLayout>
  );
}
