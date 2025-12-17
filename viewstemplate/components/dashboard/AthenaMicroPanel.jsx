import React from 'react';

export default function AthenaMicroPanel({ title, value }) {
  return (
    <div className="bg-white rounded-lg p-3 shadow text-center">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-xl font-bold text-emerald-700">{value}</div>
    </div>
  );
}
