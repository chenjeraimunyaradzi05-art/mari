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
import { useAuthStore } from '@/lib/hooks';
import { Job } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Spinner as LoadingSpinner } from '@/components/ui/loading';
import { Modal, ModalContent, ModalFooter } from '@/components/ui/modal';
import { CrossModuleShareButton } from '@/components/share/cross-module-share';

export default function JobDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthStore();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasApplied, setHasApplied] = useState(false);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const response = await jobApi.getById(params.id as string);
        setJob(response.data.data);
        setHasApplied(Boolean(response.data.data?.hasApplied));
      } catch (error) {
        console.error('Failed to fetch job:', error);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchJob();
    }
  }, [params.id]);

  // Applying needs a session, so an anonymous visitor signs in and lands back on
  // this job instead of losing their place in the listing.
  const handleApplyClick = () => {
    if (!job) return;

    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(`/jobs/${job.id}`)}`);
      return;
    }

    setApplyError(null);
    setIsApplyOpen(true);
  };

  const handleApplySubmit = async () => {
    if (!job) return;

    setIsApplying(true);
    setApplyError(null);
    try {
      await jobApi.apply(job.id, { coverLetter: coverLetter.trim() || undefined });
      setHasApplied(true);
      setIsApplyOpen(false);
      setCoverLetter('');
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setApplyError(message || 'Your application could not be submitted. Please try again.');
    } finally {
      setIsApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h2 className="text-2xl font-bold mb-2">Job not found</h2>
        <Button onClick={() => router.push('/jobs')}>Back to Jobs</Button>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen pb-12">
      {/* Header / Banner Area */}
      <div className="bg-white border-b sticky top-16 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="flex gap-5">
              <Avatar
                src={job.organization?.logo || null}
                alt={job.organization?.name || 'Organization'}
                fallback={job.organization?.name?.substring(0, 2).toUpperCase() || 'ORG'}
                size="xl"
                className="rounded-xl border bg-white"
              />
              
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
                  {job.title}
                </h1>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
                  <Link href={`/dashboard/organizations/${job.organization?.slug}`} className="flex items-center gap-1.5 hover:text-primary hover:underline">
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
                  url={`${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/jobs/${job.id}`}
                  entityType="job"
                  entityId={job.id}
                />
              </div>
              <Button
                size="lg"
                className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700"
                onClick={handleApplyClick}
                disabled={isAuthLoading || hasApplied || job.status !== 'ACTIVE'}
              >
                {hasApplied ? 'Applied' : job.status === 'ACTIVE' ? 'Apply Now' : 'Closed'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Job Description */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6 md:p-8">
              <h2 className="text-xl font-bold mb-6">About the job</h2>
              
              <div className="prose max-w-none text-slate-700 whitespace-pre-line">
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
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-semibold text-lg mb-4">Job Details</h3>
              
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600 h-fit">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Salary</p>
                    <p className="font-semibold">
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
                    <p className="text-sm font-medium text-slate-500">Job Type</p>
                    <p className="font-semibold capitalize">{job.type.replace('_', ' ').toLowerCase()}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 h-fit">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Experience</p>
                    <p className="font-semibold">{job.experienceMin ? `${job.experienceMin}+ years` : "Entry Level"}</p>
                  </div>
                </div>
              </div>
              
              <Separator className="my-6" />
              
              <h3 className="font-semibold text-lg mb-4">About the Company</h3>
              <div className="flex items-center gap-3 mb-4">
                <Avatar
                  src={job.organization?.logo || null}
                  alt={job.organization?.name || 'Organization'}
                  fallback={job.organization?.name?.substring(0, 1).toUpperCase() || 'O'}
                  size="md"
                />
                <div>
                  <p className="font-medium">{job.organization?.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{job.organization?.industry}</p>
                </div>
              </div>
              
              {job.organization?.website && (
                 <a 
                   href={job.organization.website} 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="text-primary hover:underline text-sm flex items-center gap-1"
                 >
                   <Globe className="h-3 w-3" /> Visit Website
                 </a>
              )}
            </div>

            {/* Safety/Verified Card */}
            {job.organization?.isVerified && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex gap-3 text-green-800">
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

      <Modal
        isOpen={isApplyOpen}
        onClose={() => setIsApplyOpen(false)}
        title={`Apply to ${job.title}`}
        description={job.organization?.name ? `at ${job.organization.name}` : undefined}
        size="lg"
      >
        <ModalContent className="space-y-4">
          <div className="grid gap-2">
            <label htmlFor="cover-letter" className="text-sm font-medium text-slate-700">
              Cover letter (optional)
            </label>
            <textarea
              id="cover-letter"
              value={coverLetter}
              onChange={(event) => setCoverLetter(event.target.value)}
              rows={6}
              placeholder="Introduce yourself and explain why you're a great fit for this role..."
              className="w-full rounded-lg border border-slate-200 p-3 text-sm resize-none"
            />
          </div>
          <p className="text-sm text-slate-600">
            Your ATHENA profile is shared with {job.organization?.name || 'the employer'} when you apply.
          </p>
          {applyError && (
            <p className="text-sm text-red-600" role="alert">
              {applyError}
            </p>
          )}
        </ModalContent>
        <ModalFooter>
          <Button variant="outline" onClick={() => setIsApplyOpen(false)} disabled={isApplying}>
            Cancel
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleApplySubmit}
            disabled={isApplying}
          >
            {isApplying ? 'Submitting...' : 'Submit application'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
