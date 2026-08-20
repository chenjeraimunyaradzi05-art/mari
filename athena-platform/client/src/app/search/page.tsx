'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search as SearchIcon, Briefcase, BookOpen, Users, Building2 } from 'lucide-react';

const SEARCH_CATEGORIES = [
  { label: 'Jobs', icon: Briefcase, href: '/jobs', color: 'text-blue-500' },
  { label: 'Courses', icon: BookOpen, href: '/courses', color: 'text-emerald-500' },
  { label: 'Mentors', icon: Users, href: '/mentors', color: 'text-purple-500' },
  { label: 'Companies', icon: Building2, href: '/explore', color: 'text-amber-500' },
];

export default function SearchPage() {
  const [query, setQuery] = useState('');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
            Search ATHENA
          </h1>
          <p className="text-slate-600 dark:text-slate-300">
            Find jobs, courses, mentors, and more across the platform.
          </p>
        </div>

        <div className="relative mb-12">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for jobs, courses, mentors..."
            className="w-full pl-12 pr-4 py-4 text-lg border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-sm"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {SEARCH_CATEGORIES.map((cat) => (
            <Link
              key={cat.label}
              href={query ? `${cat.href}?q=${encodeURIComponent(query)}` : cat.href}
              className="flex flex-col items-center p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-md transition"
            >
              <cat.icon className={`w-8 h-8 ${cat.color} mb-3`} />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{cat.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
