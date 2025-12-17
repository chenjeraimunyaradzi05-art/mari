import React from 'react';

export default function PillarHero({ title, subtitle, ctaText, ctaHref }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h1 className="text-2xl font-bold text-emerald-700">{title}</h1>
      {subtitle && <p className="text-gray-600 mt-2">{subtitle}</p>}
      {ctaText && (
        <a href={ctaHref || '#'} className="inline-block mt-4 px-4 py-2 bg-emerald-600 text-white rounded">{ctaText}</a>
      )}
    </div>
  );
}
