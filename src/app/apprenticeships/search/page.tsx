'use client';

import React, { useState } from 'react';
import { Search, MapPin, Filter, Briefcase, DollarSign, Clock, Building2, Star, Heart } from 'lucide-react';

// Mock Data
const JOBS = [
  {
    id: 1,
    title: 'Electrical Apprentice - 1st Year',
    company: 'BrightSpark Electrical',
    location: 'Melbourne, VIC',
    salary: '$45,000 - $55,000',
    type: 'Full-time',
    posted: '2 days ago',
    tags: ['Women-Led Team', 'Mentorship'],
    logo: 'bg-amber-100 text-amber-600',
    verified: true
  },
  {
    id: 2,
    title: 'Plumbing Apprentice',
    company: 'Flow Masters',
    location: 'Sydney, NSW',
    salary: '$50,000 - $60,000',
    type: 'Full-time',
    posted: '5 hours ago',
    tags: ['Tool Allowance', 'Flexible Hours'],
    logo: 'bg-blue-100 text-blue-600',
    verified: true
  },
  {
    id: 3,
    title: 'Civil Construction Trainee',
    company: 'BuildRight Group',
    location: 'Brisbane, QLD',
    salary: '$55,000 - $65,000',
    type: 'Traineeship',
    posted: '1 week ago',
    tags: ['Large Projects', 'Travel Required'],
    logo: 'bg-slate-100 text-slate-600',
    verified: false
  },
  {
    id: 4,
    title: 'Automotive Mechanic Apprentice',
    company: 'AutoFix Her',
    location: 'Perth, WA',
    salary: '$42,000 - $52,000',
    type: 'Full-time',
    posted: '3 days ago',
    tags: ['Female Owned', 'Training Provided'],
    logo: 'bg-rose-100 text-rose-600',
    verified: true
  },
  {
    id: 5,
    title: 'Carpentry Apprentice',
    company: 'WoodWorks Co.',
    location: 'Adelaide, SA',
    salary: '$48,000 - $58,000',
    type: 'Full-time',
    posted: '1 day ago',
    tags: ['Residential', 'Small Team'],
    logo: 'bg-emerald-100 text-emerald-600',
    verified: true
  }
];

export default function ApprenticeshipSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [location, setLocation] = useState('');
  const [selectedJob, setSelectedJob] = useState<number | null>(null);

  const filteredJobs = JOBS.filter(job => 
    job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.company.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header / Search Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-4">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            <div className="flex-1 w-full relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search by role, trade, or company..." 
                className="w-full pl-12 pr-4 py-3 bg-slate-100 border-transparent focus:bg-white border focus:border-emerald-500 rounded-xl transition-all outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full lg:w-72 relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Location (e.g. Melbourne)" 
                className="w-full pl-12 pr-4 py-3 bg-slate-100 border-transparent focus:bg-white border focus:border-emerald-500 rounded-xl transition-all outline-none"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <button className="w-full lg:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/10 flex items-center justify-center gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Job List */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-slate-700">{filteredJobs.length} Opportunities Found</h2>
              <span className="text-xs text-slate-500">Sorted by: Relevance</span>
            </div>

            {filteredJobs.map((job) => (
              <div 
                key={job.id}
                onClick={() => setSelectedJob(job.id)}
                className={`bg-white p-5 rounded-2xl border cursor-pointer transition-all hover:shadow-md ${selectedJob === job.id ? 'border-emerald-500 ring-1 ring-emerald-500 shadow-md' : 'border-slate-200 hover:border-emerald-300'}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ${job.logo}`}>
                    {job.company.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-slate-900 truncate pr-2">{job.title}</h3>
                      {job.verified && (
                        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                          <Star className="w-3 h-3 fill-emerald-700" /> Verified
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-sm mb-3">{job.company}</p>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                        <MapPin className="w-3 h-3" /> {job.location}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                        <DollarSign className="w-3 h-3" /> {job.salary}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      {job.tags.map((tag, i) => (
                        <span key={i} className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Job Detail View (Sticky) */}
          <div className="hidden lg:block lg:col-span-7">
            <div className="sticky top-28">
              {selectedJob ? (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden h-[calc(100vh-140px)] flex flex-col">
                  {/* Detail Header */}
                  <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-start justify-between mb-6">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-2xl ${JOBS.find(j => j.id === selectedJob)?.logo}`}>
                        {JOBS.find(j => j.id === selectedJob)?.company.charAt(0)}
                      </div>
                      <div className="flex gap-3">
                        <button className="p-3 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all">
                          <Heart className="w-5 h-5" />
                        </button>
                        <button className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/10 transition-all">
                          Apply Now
                        </button>
                      </div>
                    </div>
                    
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">{JOBS.find(j => j.id === selectedJob)?.title}</h1>
                    <div className="flex items-center gap-2 text-slate-600 font-medium mb-6">
                      <Building2 className="w-4 h-4" />
                      {JOBS.find(j => j.id === selectedJob)?.company}
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-500 text-sm font-normal">Posted {JOBS.find(j => j.id === selectedJob)?.posted}</span>
                    </div>

                    <div className="flex gap-4 border-t border-slate-200 pt-6">
                      <div className="flex-1">
                        <span className="text-xs text-slate-400 uppercase tracking-wider font-bold block mb-1">Salary</span>
                        <span className="font-bold text-slate-700">{JOBS.find(j => j.id === selectedJob)?.salary}</span>
                      </div>
                      <div className="flex-1">
                        <span className="text-xs text-slate-400 uppercase tracking-wider font-bold block mb-1">Type</span>
                        <span className="font-bold text-slate-700">{JOBS.find(j => j.id === selectedJob)?.type}</span>
                      </div>
                      <div className="flex-1">
                        <span className="text-xs text-slate-400 uppercase tracking-wider font-bold block mb-1">Location</span>
                        <span className="font-bold text-slate-700">{JOBS.find(j => j.id === selectedJob)?.location}</span>
                      </div>
                    </div>
                  </div>

                  {/* Detail Body (Scrollable) */}
                  <div className="p-8 overflow-y-auto flex-1 space-y-8">
                    <section>
                      <h3 className="font-bold text-slate-900 text-lg mb-4">About the Role</h3>
                      <p className="text-slate-600 leading-relaxed">
                        We are looking for a motivated and enthusiastic apprentice to join our growing team. 
                        This is a fantastic opportunity to learn from experienced mentors in a supportive environment 
                        that values diversity and inclusion. You will gain hands-on experience working on a variety 
                        of residential and commercial projects.
                      </p>
                    </section>

                    <section>
                      <h3 className="font-bold text-slate-900 text-lg mb-4">What You'll Learn</h3>
                      <ul className="space-y-3">
                        {[
                          'Reading and interpreting technical drawings',
                          'Installation and maintenance of systems',
                          'Safety protocols and site management',
                          'Client communication and teamwork'
                        ].map((item, i) => (
                          <li key={i} className="flex items-start gap-3 text-slate-600">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </section>

                    <section>
                      <h3 className="font-bold text-slate-900 text-lg mb-4">Requirements</h3>
                      <ul className="space-y-3">
                        {[
                          'Completed Year 10 or equivalent',
                          'Driver\'s license (preferred)',
                          'Genuine interest in the trade',
                          'Strong work ethic and reliability'
                        ].map((item, i) => (
                          <li key={i} className="flex items-start gap-3 text-slate-600">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </section>
                  </div>
                </div>
              ) : (
                <div className="h-[calc(100vh-140px)] flex items-center justify-center text-slate-400 bg-slate-50/50 rounded-3xl border border-slate-200 border-dashed">
                  <div className="text-center">
                    <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Select a job to view details</p>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
