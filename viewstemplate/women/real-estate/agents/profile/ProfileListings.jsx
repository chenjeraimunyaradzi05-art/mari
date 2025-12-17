import React from 'react';

export default function ProfileListings({ listings }) {
  if (!listings || listings.length === 0) return null;
  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-2 text-emerald-700">Active Listings</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {listings.map((listing) => (
          <div key={listing.id} className="bg-white rounded-lg shadow p-4">
            <img src={listing.imageUrl} alt={listing.title} className="w-full h-40 object-cover rounded mb-2" />
            <h3 className="text-lg font-bold text-gray-900">{listing.title}</h3>
            <p className="text-gray-600">{listing.location}</p>
            <p className="text-emerald-700 font-semibold">${listing.price.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
