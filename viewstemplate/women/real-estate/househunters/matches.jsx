import React from 'react';

export default function Matches() {
  // TODO: Replace with real data or props
  const matches = [
    { id: 1, name: 'Dream Home', location: 'Brooklyn, NY', price: 950000 },
    { id: 2, name: 'Sunny Apartment', location: 'Queens, NY', price: 700000 },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4 text-emerald-700">Your Matches</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {matches.map((match) => (
          <div key={match.id} className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold text-gray-900">{match.name}</h2>
            <p className="text-gray-600">{match.location}</p>
            <p className="text-emerald-700 font-bold">${match.price.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
