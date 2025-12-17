import React from 'react';

export default function CriticalSignalStrip({ message, severity = 'info' }) {
  if (!message) return null;
  return (
    <div className={`w-full p-3 rounded ${severity === 'info' ? 'bg-blue-50 text-blue-800' : 'bg-red-50 text-red-800'}`}>
      {message}
    </div>
  );
}
