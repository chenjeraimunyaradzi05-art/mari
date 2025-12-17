import React from 'react';

export default function MediaColumn({ items = [] }) {
  return (
    <div className="grid gap-4">
      {items.map((it, idx) => (
        <div key={idx} className="bg-white rounded-lg p-3 shadow">
          <h3 className="font-semibold">{it.title}</h3>
          <p className="text-sm text-gray-600">{it.summary}</p>
        </div>
      ))}
    </div>
  );
}
