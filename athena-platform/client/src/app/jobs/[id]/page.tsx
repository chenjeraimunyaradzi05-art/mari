'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { 
  Building2,
  MapPin,
  Clock,
  DollarSign,
  Briefcase,
  Globe,
  CheckCircle,
} from 'lucide-react';
import { jobApi } from '@/lib/api';
import { Job } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Spinner as LoadingSpinner } from '@/components/ui/loading';
import { CrossModuleShareButton } from '@/components/share/cross-module-share';
import { arePublicFallbacksEnabled, getAppSiteUrl } from '@/lib/runtime-config';
import { findFallbackJob, isFallbackJobId } from '@/lib/public-fallbacks';

export default function JobDetailsPage() {
  const params = useParams();
  const router = useRouter();
  
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const response = await jobApi.getById(params.id as string);
        const nextJob = response.data.data;
        setJob(isFallbackJobId(nextJob?.id) && !arePublicFallbacksEnabled() ? null : nextJob);
      } catch (error) {
        console.error('Failed to fetch job:', error);
        setJob(arePublicFallbacksEnabled() ? findFallbackJob(params.id as string) : null);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchJob();
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 dark:bg-slate-950">
        <LoadingSpinner />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <h2 className="mb-2 text-2xl font-bold">Job not found</h2>
        <Button onClick={() => router.push('/jobs')}>Back to Jobs</Button>
      </div>
    );
  }

  const isFallbackJob = isFallbackJobId(job.id);
  const organizationHref = isFallbackJob
    ? '/jobs'
    : `/dashboard/organizations/${job.organization?.slug}`;

  return (
    <div className="min-h-screen bg-slate-50 pb-12 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Header / Banner Area */}
      <div className="sticky top-16 z-10 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/90">
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="flex gap-5">
              <Avatar
                src={job.organization?.logo || null}
                alt={job.organization?.name || 'Organization'}
                fallback={job.organization?.name?.substring(0, 2).toUpperCase() || 'ORG'}
                size="xl"
                className="rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900"
              />
              
              <div>
                <h1 className="mb-2 text-2xl font-bold text-slate-950 dark:text-white md:text-3xl">
                  {job.title}
                </h1>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <Link href={organizationHref} className="flex items-center gap-1.5 transition hover:text-primary hover:underline">
                    <Building2 className="h-4 w-4" />
                    {job.organization?.name}
                  </Link>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {job.isRemote ? 'Remote' : `${job.city}, ${job.state}`}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    Posted {job.publishedAt ? formatDistanceToNow(new Date(job.publishedAt), { addSuffix: true }) : 'Recently'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 w-full md:w-auto">
              <div className="flex-1 md:flex-none">
                <CrossModuleShareButton
                  title={job.title}
                  description={`${job.organization?.name || 'Employer'} • ${job.isRemote ? 'Remote' : `${job.city}, ${job.state}`}`}
                  url={`${getAppSiteUrl()}/jobs/${job.id}`}
                  entityType="job"
                  entityId={job.id}
                />
              </div>
              {isFallbackJob ? (
                <Button
                  size="lg"
                  className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700"
                  onClick={() => router.push('/register')}
                >
                  Join to express interest
                </Button>
              ) : (
                <Button size="lg" className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700">
                  Apply Now
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Job Description */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900 md:p-8">
              <h2 className="text-xl font-bold mb-6">About the job</h2>
              
              <div className="prose max-w-none whitespace-pre-line text-slate-700 dark:prose-invert dark:text-slate-200">
                {job.description}
              </div>

              {/* Skills Section */}
              {/* Note: Schema has skills relation but backend response might need verify */}
              {/* Assuming job.skills is populated if valid */}
            </div>
          </div>

          {/* Right Column: Sidebar Details */}
          <div className="space-y-6">
            {/* Job Details Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
              <h3 className="mb-4 text-lg font-semibold">Job Details</h3>
              
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600 h-fit">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Salary</p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {job.salaryMin ? `$${job.salaryMin.toLocaleString()}` : "Competitive"}
                      {job.salaryMax ? ` - $${job.salaryMax.toLocaleString()}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="p-2 bg-purple-50 rounded-lg text-purple-600 h-fit">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Job Type</p>
                    <p className="font-semibold capitalize text-slate-900 dark:text-slate-100">{job.type.replace('_', ' ').toLowerCase()}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 h-fit">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Experience</p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{job.experienceMin ? `${job.experienceMin}+ years` : "Entry Level"}</p>
                  </div>
                </div>
              </div>
              
              <Separator className="my-6" />
              
              <h3 className="mb-4 text-lg font-semibold">About the Company</h3>
              <div className="flex items-center gap-3 mb-4">
                <Avatar
                  src={job.organization?.logo || null}
                  alt={job.organization?.name || 'Organization'}
                  fallback={job.organization?.name?.substring(0, 1).toUpperCase() || 'O'}
                  size="md"
                />
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{job.organization?.name}</p>
                  <p className="text-xs text-muted-foreground dark:text-slate-400">{job.organization?.industry}</p>
                </div>
              </div>
              
              {job.organization?.website && (
                 <a 
                   href={job.organization.website} 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="flex items-center gap-1 text-sm text-primary transition hover:underline"
                 >
                   <Globe className="h-3 w-3" /> Visit Website
                 </a>
              )}
            </div>

            {/* Safety/Verified Card */}
            {isFallbackJob ? (
              <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-blue-800 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-100">
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Demo spotlight role</p>
                  <p className="text-xs mt-1 opacity-90">
                    This listing is shown only when public demo fallbacks are explicitly enabled.
                  </p>
                </div>
              </div>
            ) : job.organization?.isVerified && (
              <div className="flex gap-3 rounded-xl border border-green-100 bg-green-50 p-4 text-green-800 dark:border-green-400/20 dark:bg-green-400/10 dark:text-green-100">
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Verified Employer</p>
                  <p className="text-xs mt-1 opacity-90">This organization has been verified by Athena.</p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
