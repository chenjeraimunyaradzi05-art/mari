import React from 'react';

export default function AuraHeaderInline({ title, subtitle }) {
  return (
    <div className="bg-emerald-50 rounded p-4 mb-4">
      <h2 className="text-xl font-semibold text-emerald-700">{title}</h2>
      {subtitle && <p className="text-gray-600">{subtitle}</p>}
    </div>
  );
}
