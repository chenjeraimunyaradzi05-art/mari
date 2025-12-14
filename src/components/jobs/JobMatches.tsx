'use client';

import useSWR from 'swr';
import { useState } from 'react';

interface JobMatch {
  id: string;
  title: string;
  company: {
    name: string;
    logo?: string | null;
  };
  location: string;
  salaryRange?: string | null;
  type: string;
  matchScore: number;
  matchReasons: string[];
  postedDate: string;
}

interface JobMatchesProps {
  userId: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function JobMatches({ userId }: JobMatchesProps) {
  const { data, error, isLoading } = useSWR<{ data: JobMatch[] }>(
    `/api/matching?userId=${userId}`,
    fetcher
  );

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Finding your best matches...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">Failed to load matches.</div>;
  }

  const matches = data?.data || [];

  if (matches.length === 0) {
    return (
      <div className="p-8 text-center bg-gray-50 rounded-lg border border-dashed">
        <h3 className="text-lg font-medium text-gray-900">No matches found yet</h3>
        <p className="text-gray-500 mt-1">Try updating your profile with more interests.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Top Job Matches</h2>
        <span className="text-sm text-gray-500">{matches.length} jobs found for you</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {matches.map((job) => (
          <div key={job.id} className="bg-white border rounded-xl shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-lg text-gray-900 line-clamp-1">{job.title}</h3>
                <p className="text-gray-600 text-sm">{job.company.name}</p>
              </div>
              <div className="flex flex-col items-end">
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  job.matchScore > 0.8 ? 'bg-green-100 text-green-700' :
                  job.matchScore > 0.5 ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {Math.round(job.matchScore * 100)}% Match
                </span>
              </div>
            </div>

            <div className="space-y-2 mb-4 grow">
              <div className="flex items-center text-sm text-gray-500">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {job.location}
              </div>
              {job.salaryRange && (
                <div className="flex items-center text-sm text-gray-500">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {job.salaryRange}
                </div>
              )}
            </div>

            {job.matchReasons.length > 0 && (
              <div className="mb-4 p-3 bg-indigo-50 rounded-lg">
                <p className="text-xs font-semibold text-indigo-800 mb-1">Why this matches:</p>
                <ul className="list-disc list-inside text-xs text-indigo-700">
                  {job.matchReasons.slice(0, 2).map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            <button className="w-full py-2 px-4 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors mt-auto">
              View Details
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
