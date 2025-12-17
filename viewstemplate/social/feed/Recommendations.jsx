import React from 'react';

export default function Recommendations() {
  const recs = ['Follow Alice', 'Check this event'];
  return (
    <div className="space-y-2">
      {recs.map((r, i) => <div key={i} className="bg-white rounded p-3 shadow">{r}</div>)}
    </div>
  );
}
