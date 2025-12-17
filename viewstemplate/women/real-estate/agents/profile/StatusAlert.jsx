import React from 'react';

export default function StatusAlert({ status }) {
  if (!status) return null;
  return (
    <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-800 shadow-sm shadow-emerald-100">
      <span className="font-semibold">✓ Success!</span> {status}
    </div>
  );
}
