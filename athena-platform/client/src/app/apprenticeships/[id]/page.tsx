'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Bookmark,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  GraduationCap,
  Loader2,
  MapPin,
  Share2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ApplicationModal, ApplicationData } from '@/components/apprenticeships';
import {
  Apprenticeship,
  daysUntil,
  durationLabel,
  levelLabel,
  locationLabel,
  positionsLeft,
  primaryOrg,
  wageLabel,
} from '@/components/apprenticeships/types';
import { apprenticeshipApi } from '@/lib/api-extensions';
import { BackToHome } from '@/components/layout/PageShell';
import { cn } from '@/lib/utils';

/**
 * The listing detail page.
 *
 * `/apprenticeships/[id]` was an empty directory, so every card click and every
 * shared link 404ed — the browse page has always pushed to this route and the
 * share handler has always copied it. `GET /api/apprenticeships/:id` was
 * already serving the row with its RTO and host employer.
 */

// The competencies column is free-form JSON. Accept the two shapes the API has
// produced — a list of strings, or a list of `{ code?, title }` — and ignore
// anything else rather than rendering "[object Object]".
function readCompetencies(value: unknown): { code?: string; title: string }[] {
  if (!Array.isArray(value)) return [];
  const out: { code?: string; title: string }[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item.trim()) {
      out.push({ title: item });
    } else if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      const title = typeof obj.title === 'string' ? obj.title : typeof obj.name === 'string' ? obj.name : null;
      if (title) out.push({ code: typeof obj.code === 'string' ? obj.code : undefined, title });
    }
  }
  return out;
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

export default function ApprenticeshipDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? '');

  const [apprenticeship, setApprenticeship] = useState<Apprenticeship | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [shareLabel, setShareLabel] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await apprenticeshipApi.getById(id);
      const data = response.data?.data;
      if (data) {
        setApprenticeship(data);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleBookmark = async () => {
    if (!apprenticeship) return;
    // Flipped first so the icon responds immediately, and put back if the
    // request fails rather than leaving the UI lying about saved state.
    const next = !apprenticeship.isBookmarked;
    setApprenticeship({ ...apprenticeship, isBookmarked: next });
    try {
      if (next) {
        await apprenticeshipApi.bookmark(apprenticeship.id);
      } else {
        await apprenticeshipApi.unbookmark(apprenticeship.id);
      }
    } catch {
      setApprenticeship((current) =>
        current ? { ...current, isBookmarked: !next } : current
      );
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: apprenticeship?.title ?? 'Apprenticeship', url });
        return;
      }
      throw new Error('no share');
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setShareLabel('Link copied');
        setTimeout(() => setShareLabel(null), 2000);
      } catch {
        setShareLabel('Could not copy');
        setTimeout(() => setShareLabel(null), 2000);
      }
    }
  };

  const handleApplicationSubmit = async (data: ApplicationData) => {
    if (!apprenticeship) return;
    await apprenticeshipApi.apply(apprenticeship.id, {
      coverLetter: data.coverLetter,
      resumeUrl: data.resumeUrl,
      portfolioUrl: data.portfolioUrl,
      availableStartDate: data.availableStartDate,
      answers: data.answers,
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
      </div>
    );
  }

  if (notFound || !apprenticeship) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <GraduationCap className="mx-auto mb-4 h-12 w-12 text-slate-300" />
        <h1 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">
          This apprenticeship is no longer listed
        </h1>
        <p className="mb-6 text-slate-500">
          It may have been filled or withdrawn since you saw the link.
        </p>
        <Button onClick={() => router.push('/apprenticeships')}>Browse apprenticeships</Button>
      </div>
    );
  }

  const org = primaryOrg(apprenticeship);
  const deadlineDays = daysUntil(apprenticeship.applicationDeadline);
  const closed = deadlineDays !== null && deadlineDays <= 0;
  const left = positionsLeft(apprenticeship);
  const wage = wageLabel(apprenticeship);
  const competencies = readCompetencies(apprenticeship.competencies);

  return (
    <div className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="container mx-auto max-w-5xl px-4 py-8">
        {/* Two ways out: back to the list you were browsing, and back to the
            front page — a shared link can land someone here with no history. */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <BackToHome />
          <Link
            href="/apprenticeships"
            className="focusable inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            All apprenticeships
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="surface p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                  {org?.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={org.logo}
                      alt={org.name}
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                  ) : (
                    <Building2 className="h-8 w-8 text-slate-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {apprenticeship.title}
                  </h1>
                  <p className="mt-1 text-slate-500">
                    {org?.name ?? 'Employer to be confirmed'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge>{levelLabel(String(apprenticeship.level))}</Badge>
                    {apprenticeship.framework && (
                      <Badge variant="outline">{apprenticeship.framework}</Badge>
                    )}
                    {apprenticeship.isRemote && (
                      <Badge variant="outline" className="border-green-500 text-green-600">
                        Remote
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <p className="mt-6 whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300">
                {apprenticeship.description}
              </p>
            </div>

            {competencies.length > 0 && (
              <div className="surface p-6">
                <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
                  What you will be signed off on
                </h2>
                <ul className="space-y-2">
                  {competencies.map((c, i) => (
                    <li key={`${c.code ?? ''}-${i}`} className="flex gap-3 text-sm">
                      {c.code && (
                        <span className="font-mono text-xs text-slate-400">{c.code}</span>
                      )}
                      <span className="text-slate-700 dark:text-slate-300">{c.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Only shown when the provider has actually recorded outcomes —
                an absent rate is left absent rather than shown as 0%. */}
            {(apprenticeship.completionRate != null ||
              apprenticeship.employmentRate != null ||
              apprenticeship.womenEnrolled != null) && (
              <div className="surface p-6">
                <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
                  How previous cohorts went
                </h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  {apprenticeship.completionRate != null && (
                    <Stat
                      icon={GraduationCap}
                      label="Completed"
                      value={`${apprenticeship.completionRate}%`}
                    />
                  )}
                  {apprenticeship.employmentRate != null && (
                    <Stat
                      icon={Users}
                      label="In work after"
                      value={`${apprenticeship.employmentRate}%`}
                    />
                  )}
                  {apprenticeship.womenEnrolled != null && apprenticeship.totalEnrolled ? (
                    <Stat
                      icon={Users}
                      label="Women enrolled"
                      value={`${apprenticeship.womenEnrolled} of ${apprenticeship.totalEnrolled}`}
                    />
                  ) : null}
                </div>
              </div>
            )}

            {apprenticeship.rto && apprenticeship.rto.id !== org?.id && (
              <div className="surface p-6">
                <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
                  Training provider
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {apprenticeship.rto.name} awards the qualification. The completion
                  record ATHENA issues is a record of this placement, not a nationally
                  recognised AQF qualification &mdash; only the RTO awards that.
                </p>
              </div>
            )}
          </div>

          {/* Apply panel */}
          <aside className="lg:sticky lg:top-6 lg:h-fit">
            <div className="surface p-6">
              <div className="space-y-4">
                <Stat icon={MapPin} label="Where" value={locationLabel(apprenticeship)} />
                {apprenticeship.durationMonths > 0 && (
                  <Stat
                    icon={Clock}
                    label="How long"
                    value={durationLabel(apprenticeship.durationMonths)}
                  />
                )}
                {wage && (
                  <>
                    <Stat icon={DollarSign} label="Wage" value={wage} />
                    {/* Apprentice pay is set by the relevant modern award and varies
                        with year, age and prior schooling, so the range must never
                        read as an offer. */}
                    <p className="-mt-2 pl-8 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      Indicative only &mdash; apprentice pay is set by the relevant award and
                      varies with your year, age and schooling. Ask the provider what rate
                      would apply to you.
                    </p>
                  </>
                )}
                {apprenticeship.startDate && (
                  <Stat
                    icon={Calendar}
                    label="Starts"
                    value={new Date(apprenticeship.startDate).toLocaleDateString('en-AU', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  />
                )}
                {apprenticeship.positions > 1 && (
                  <Stat
                    icon={GraduationCap}
                    label="Places"
                    value={`${left} of ${apprenticeship.positions} left`}
                  />
                )}
              </div>

              <div className="mt-6 space-y-2">
                <Button
                  className="w-full"
                  disabled={closed || left === 0}
                  onClick={() => setShowApply(true)}
                >
                  {closed ? 'Applications closed' : left === 0 ? 'All places filled' : 'Apply now'}
                </Button>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={handleBookmark}>
                    <Bookmark
                      className={cn(
                        'mr-2 h-4 w-4',
                        apprenticeship.isBookmarked && 'fill-current text-rose-500'
                      )}
                    />
                    {apprenticeship.isBookmarked ? 'Saved' : 'Save'}
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={handleShare}>
                    <Share2 className="mr-2 h-4 w-4" />
                    {shareLabel ?? 'Share'}
                  </Button>
                </div>
              </div>

              {deadlineDays !== null && (
                <p
                  className={cn(
                    'mt-4 text-center text-sm',
                    closed ? 'text-red-500' : deadlineDays <= 7 ? 'text-orange-600' : 'text-slate-500'
                  )}
                >
                  {closed
                    ? 'Applications have closed'
                    : `${deadlineDays} day${deadlineDays === 1 ? '' : 's'} left to apply`}
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>

      {showApply && (
        <ApplicationModal
          isOpen={showApply}
          onClose={() => setShowApply(false)}
          apprenticeship={apprenticeship}
          onSubmit={handleApplicationSubmit}
        />
      )}
    </div>
  );
}
