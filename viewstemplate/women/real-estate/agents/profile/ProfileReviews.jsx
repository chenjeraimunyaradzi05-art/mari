import React from 'react';

export default function ProfileReviews({ reviews }) {
  if (!reviews || reviews.length === 0) return null;
  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-2 text-emerald-700">Client Reviews</h2>
      <div className="space-y-4">
        {reviews.map((review, idx) => (
          <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center mb-2">
              <span className="font-bold text-gray-800 mr-2">{review.client}</span>
              <span className="text-yellow-500">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
            </div>
            <p className="text-gray-700">{review.comment}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
