import React from 'react';

export default function HighlightIcon({ icon = '★', label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-emerald-600">{icon}</span>
      <span className="text-sm text-gray-700">{label}</span>
    </div>
  );
}
