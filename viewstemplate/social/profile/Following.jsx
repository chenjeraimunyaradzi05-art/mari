import React from 'react';

export default function Following() {
  const people = ['Alice', 'Bob'];
  return (
    <div className="space-y-2">
      {people.map((p, i) => <div key={i} className="bg-white rounded p-3 shadow">{p}</div>)}
    </div>
  );
}
