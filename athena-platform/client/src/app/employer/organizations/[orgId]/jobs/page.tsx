'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Plus,
  Search,
  Eye,
  Edit2,
  Trash2,
  Users,
  Calendar,
  MapPin,
  ArrowLeft,
  MoreVertical,
  Globe,
  Pause,
  Play,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

interface Job {
  id: string;
  title: string;
  type: string;
  city: string;
  state: string;
  isRemote: boolean;
  status: string;
  viewCount: number;
  applicationCount: number;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  PAUSED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  CLOSED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  FILLED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

export default function EmployerJobsPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const orgId = params.orgId as string;

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const { data: jobsData, isLoading } = useQuery({
    queryKey: ['employer-jobs', orgId],
    queryFn: async () => {
      const response = await api.get(`/employer/organizations/${orgId}/jobs`);
      return response.data;
    },
  });

  const updateJobMutation = useMutation({
    mutationFn: async ({ jobId, status }: { jobId: string; status: string }) => {
      const response = await api.patch(`/employer/jobs/${jobId}`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employer-jobs', orgId] });
      toast.success('Job updated successfully');
      setMenuOpen(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update job');
    },
  });

  const jobs: Job[] = jobsData?.data?.jobs || [];

  const filteredJobs = jobs.filter((job) => {
    const matchesFilter = filter === 'all' || job.status === filter;
    const matchesSearch = job.title.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const statusCounts = jobs.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Back Button */}
      <Link
        href={`/employer/organizations/${orgId}`}
        className="inline-flex items-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Briefcase className="h-7 w-7 text-blue-600" />
            Job Listings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your job postings and track applications
          </p>
        </div>
        <Link href={`/employer/organizations/${orgId}/jobs/new`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Post New Job
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-full pl-10"
            placeholder="Search jobs..."
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === 'all'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200'
            }`}
          >
            All ({jobs.length})
          </button>
          {['ACTIVE', 'DRAFT', 'PAUSED', 'CLOSED'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === status
                  ? statusColors[status]
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200'
              }`}
            >
              {status.charAt(0) + status.slice(1).toLowerCase()} ({statusCounts[status] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Jobs List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-500 mt-2">Loading jobs...</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {jobs.length === 0 ? 'No jobs posted yet' : 'No jobs match your search'}
          </h3>
          <p className="text-gray-500 mb-6">
            {jobs.length === 0
              ? 'Create your first job posting to start attracting candidates'
              : 'Try adjusting your filters or search terms'}
          </p>
          {jobs.length === 0 && (
            <Link href={`/employer/organizations/${orgId}/jobs/new`}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Post Your First Job
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Link
                      href={`/jobs/${job.id}`}
                      className="text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {job.title}
                    </Link>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusColors[job.status]}`}>
                      {job.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {job.isRemote ? 'Remote' : [job.city, job.state].filter(Boolean).join(', ') || 'No location'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Posted {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                    </span>
                  </div>

                  <div className="flex gap-6">
                    <div className="flex items-center gap-2 text-sm">
                      <Eye className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-white">{job.viewCount}</span>
                      <span className="text-gray-500">views</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-white">{job.applicationCount}</span>
                      <span className="text-gray-500">applications</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(menuOpen === job.id ? null : job.id)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    <MoreVertical className="h-5 w-5 text-gray-500" />
                  </button>

                  {menuOpen === job.id && (
                    <div className="absolute right-0 top-10 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Globe className="h-4 w-4" />
                        View Public Listing
                      </Link>
                      <Link
                        href={`/employer/organizations/${orgId}/jobs/${job.id}/edit`}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Edit2 className="h-4 w-4" />
                        Edit Job
                      </Link>
                      {job.status === 'ACTIVE' && (
                        <button
                          onClick={() => updateJobMutation.mutate({ jobId: job.id, status: 'PAUSED' })}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-yellow-600 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
                        >
                          <Pause className="h-4 w-4" />
                          Pause Listing
                        </button>
                      )}
                      {(job.status === 'DRAFT' || job.status === 'PAUSED') && (
                        <button
                          onClick={() => updateJobMutation.mutate({ jobId: job.id, status: 'ACTIVE' })}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-green-600 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
                        >
                          <Play className="h-4 w-4" />
                          Activate
                        </button>
                      )}
                      <button
                        onClick={() => updateJobMutation.mutate({ jobId: job.id, status: 'CLOSED' })}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
                      >
                        <Trash2 className="h-4 w-4" />
                        Close Job
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
