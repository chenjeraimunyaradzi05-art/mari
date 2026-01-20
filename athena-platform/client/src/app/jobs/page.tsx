'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, MapPin, Filter } from 'lucide-react';
import { jobApi } from '@/lib/api';
import { Job } from '@/lib/types';
import JobCard from '@/components/jobs/JobCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner as LoadingSpinner } from '@/components/ui/loading';

export default function JobsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  
  // Filter States
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [location, setLocation] = useState(searchParams.get('loc') || '');
  const [type, setType] = useState(searchParams.get('type') || '');
  const [isRemote, setIsRemote] = useState(searchParams.get('remote') === 'true');

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const response = await jobApi.search({
        page,
        limit: 10,
        search,
        city: location, // Naive location search
        type: type || undefined,
        remote: isRemote || undefined,
      });
      
      setJobs(response.data.data);
      setTotal(response.data.pagination.total);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchParams]); // Refetch when URL params change or page changes

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchJobs();
    
    // Update URL
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (location) params.set('loc', location);
    if (type) params.set('type', type);
    if (isRemote) params.set('remote', 'true');
    router.push(`/jobs?${params.toString()}`);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Filters - Hidden on mobile for MVP simplicity, or stacked */}
        <aside className="w-full md:w-64 flex-shrink-0 space-y-6">
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filters
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Job Type</label>
                <select 
                  className="w-full p-2 border rounded-md text-sm"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="">All Types</option>
                  <option value="FULL_TIME">Full Time</option>
                  <option value="PART_TIME">Part Time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERNSHIP">Internship</option>
                  <option value="freelance">Freelance</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="remote" 
                  checked={isRemote}
                  onChange={(e) => setIsRemote(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300" 
                />
                <label htmlFor="remote" className="text-sm">Remote Only</label>
              </div>
              
              <Button onClick={() => { setPage(1); fetchJobs(); }} className="w-full mt-2">
                Apply Filters
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1">
          {/* Search Header */}
          <div className="bg-white p-4 rounded-lg border shadow-sm mb-6">
            <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search job titles or keywords..." 
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="w-full md:w-48 relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Location" 
                  className="pl-9"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <Button type="submit">Search</Button>
            </form>
          </div>

          {/* Job List */}
          {loading ? (
             <div className="flex justify-center py-12">
               <LoadingSpinner />
             </div>
          ) : (
            <div className="space-y-4">
              <div className="mb-2 text-sm text-muted-foreground">
                Found {total} jobs
              </div>
              
              {jobs.length > 0 ? (
                jobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))
              ) : (
                <div className="text-center py-12 bg-white rounded-lg border border-dashed">
                  <h3 className="text-lg font-medium text-gray-900">No jobs found</h3>
                  <p className="text-muted-foreground mt-1">Try adjusting your filters or search terms.</p>
                  <Button 
                    variant="link" 
                    onClick={() => { setSearch(''); setLocation(''); setType(''); setIsRemote(false); setPage(1); setTimeout(fetchJobs, 100); }}
                  >
                    Clear all filters
                  </Button>
                </div>
              )}

              {/* Pagination */}
              {total > 10 && (
                <div className="flex justify-center gap-2 mt-8">
                  <Button 
                    variant="outline" 
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button 
                    variant="outline" 
                    disabled={page * 10 >= total}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
