import React from 'react';

export default function ProfileStats({ stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div className="bg-white rounded-lg shadow p-4 text-center">
        <div className="text-2xl font-bold text-emerald-600">{stats.listings}</div>
        <div className="text-gray-500 text-sm">Listings</div>
      </div>
      <div className="bg-white rounded-lg shadow p-4 text-center">
        <div className="text-2xl font-bold text-emerald-600">{stats.sold}</div>
        <div className="text-gray-500 text-sm">Sold</div>
      </div>
      <div className="bg-white rounded-lg shadow p-4 text-center">
        <div className="text-2xl font-bold text-emerald-600">{stats.yearsExperience}</div>
        <div className="text-gray-500 text-sm">Years Experience</div>
      </div>
      <div className="bg-white rounded-lg shadow p-4 text-center">
        <div className="text-2xl font-bold text-emerald-600">{stats.reviews}</div>
        <div className="text-gray-500 text-sm">Reviews</div>
      </div>
    </div>
  );
}
