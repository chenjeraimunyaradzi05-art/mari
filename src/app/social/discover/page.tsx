'use client';

import React, { useState, useEffect } from 'react';
import { Search, ArrowLeft, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface SearchResult {
  id: string;
  firstName: string;
  lastName: string;
  profileImage?: string;
  _count: {
    posts: number;
  };
}

export default function DiscoverPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length >= 2) {
        setSearching(true);
        try {
          const res = await fetch(`/api/social/search?q=${encodeURIComponent(query)}`);
          if (res.ok) {
            const data = await res.json();
            setResults(data);
          }
        } catch (error) {
          console.error('Search failed', error);
        } finally {
          setSearching(false);
        }
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white z-10 border-b border-slate-100 p-4">
        <div className="flex items-center gap-3">
          <Link href="/social/feed" className="p-2 -ml-2 hover:bg-slate-50 rounded-full">
            <ArrowLeft className="w-6 h-6 text-slate-900" />
          </Link>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people..."
              className="w-full pl-10 pr-4 py-2 bg-slate-100 rounded-xl focus:ring-2 focus:ring-rose-500/20 outline-none text-sm"
              autoFocus
            />
          </div>
        </div>
      </div>

      <div className="p-4">
        {query.length > 0 ? (
          <div className="space-y-4">
            {searching ? (
              <div className="text-center text-slate-500 py-8">Searching...</div>
            ) : results.length === 0 ? (
              <div className="text-center text-slate-500 py-8">No users found.</div>
            ) : (
              results.map((user) => (
                <Link key={user.id} href={`/social/profile/${user.id}`} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl transition-colors">
                  <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center">
                    {user.profileImage ? (
                      <img src={user.profileImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{user.firstName} {user.lastName}</div>
                    <div className="text-xs text-slate-500">{user._count.posts} posts</div>
                  </div>
                </Link>
              ))
            )}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="font-bold text-slate-900">Find Friends</h3>
            <p className="text-slate-500 text-sm mt-1">Search for people you know to see their posts.</p>
          </div>
        )}
      </div>
    </div>
  );
}
