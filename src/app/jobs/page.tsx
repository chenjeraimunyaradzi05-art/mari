import Link from 'next/link';

export default function JobsPage() {
  return (
    <div className="aura-container py-8">
      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Sidebar / Filters */}
        <aside className="w-full md:w-1/4 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Find Jobs</h1>
            <p className="text-slate-600 text-sm">
              Discover opportunities across our network of inclusive employers.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4">Filters</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Keywords</label>
                <input type="text" placeholder="Role, skill, company..." className="w-full rounded-xl border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                <input type="text" placeholder="City or Remote" className="w-full rounded-xl border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Job Type</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    Full-time
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    Part-time
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    Contract
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    Freelance
                  </label>
                </div>
              </div>

              <button className="w-full aura-btn aura-btn-primary mt-2">
                Update Results
              </button>
            </div>
          </div>

          <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
            <h4 className="font-semibold text-indigo-900 mb-2">Job Alerts</h4>
            <p className="text-sm text-indigo-700 mb-4">Get notified when new jobs match your profile.</p>
            <button className="w-full aura-btn aura-btn-outline bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50">
              Create Alert
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <span className="text-slate-500 text-sm">Showing <strong>124</strong> jobs</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Sort by:</span>
              <select className="text-sm border-none bg-transparent font-semibold text-slate-900 focus:ring-0 cursor-pointer">
                <option>Relevance</option>
                <option>Newest</option>
                <option>Salary (High-Low)</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {/* Job Card 1 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-pink-100 flex items-center justify-center text-2xl">
                    🎨
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">Senior Product Designer</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                      <span className="font-medium text-slate-900">Creative Studio</span>
                      <span>•</span>
                      <span>Remote</span>
                      <span>•</span>
                      <span>$120k - $150k</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">Figma</span>
                      <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">UI/UX</span>
                      <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">Design Systems</span>
                    </div>
                  </div>
                </div>
                <button className="text-slate-400 hover:text-pink-500 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                </button>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                <span className="text-xs text-slate-400">Posted 2 days ago</span>
                <Link href="/jobs/1" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                  View Details &rarr;
                </Link>
              </div>
            </div>

            {/* Job Card 2 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl">
                    💻
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">Frontend Developer</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                      <span className="font-medium text-slate-900">TechFlow</span>
                      <span>•</span>
                      <span>New York, NY</span>
                      <span>•</span>
                      <span>$100k - $130k</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">React</span>
                      <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">TypeScript</span>
                      <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">Next.js</span>
                    </div>
                  </div>
                </div>
                <button className="text-slate-400 hover:text-pink-500 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                </button>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                <span className="text-xs text-slate-400">Posted 5 hours ago</span>
                <Link href="/jobs/2" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                  View Details &rarr;
                </Link>
              </div>
            </div>

             {/* Job Card 3 */}
             <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl">
                    📈
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">Marketing Manager</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                      <span className="font-medium text-slate-900">GrowthCo</span>
                      <span>•</span>
                      <span>London, UK</span>
                      <span>•</span>
                      <span>£50k - £70k</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">SEO</span>
                      <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">Content</span>
                      <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">Analytics</span>
                    </div>
                  </div>
                </div>
                <button className="text-slate-400 hover:text-pink-500 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                </button>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                <span className="text-xs text-slate-400">Posted 1 day ago</span>
                <Link href="/jobs/3" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                  View Details &rarr;
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <button className="aura-btn aura-btn-outline">Load More Jobs</button>
          </div>
        </main>
      </div>
    </div>
  );
}
