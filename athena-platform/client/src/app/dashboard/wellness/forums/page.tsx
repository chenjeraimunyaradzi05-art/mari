'use client';

/**
 * The forums: one for each of the things women carry alone. Anonymous if
 * she wants, moderated always, the crisis lines on every page.
 */

import Link from 'next/link';
import { MessageCircleHeart } from 'lucide-react';
import { wellnessApi, type CrisisLine } from '@/lib/wellness-api';
import { CrisisStrip, ErrorBox, Loading, PageTitle, WellnessNav, useLoad } from '@/components/wellness/WellnessUi';
import { formatRelativeTime } from '@/lib/utils';

type Data = { forums: Array<{ id: string; slug: string; name: string; topic: string; description: string; guidelines: string; postCount: number; lastActivityAt: string | null }>; crisisLines: CrisisLine[] };

export default function ForumsPage() {
  const data = useLoad<Data>(() => wellnessApi.forums());
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageTitle icon={MessageCircleHeart} kicker="Wellness" title="Forums" blurb="Say the thing. Anonymously if you want. Moderators are here, the lines are always on the page, and nobody diagnoses anybody." />
      <WellnessNav current="/dashboard/wellness/forums" />
      <CrisisStrip lines={data.data?.crisisLines} />
      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      <ul className="grid gap-4 sm:grid-cols-2">
        {(data.data?.forums ?? []).map((f) => (
          <li key={f.id}>
            <Link href={`/dashboard/wellness/forums/${f.slug}`} className="tile-soft flex h-full flex-col p-4">
              <h2 className="font-semibold text-slate-900 dark:text-white">{f.name}</h2>
              <p className="mt-1 flex-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{f.description}</p>
              <p className="mt-3 text-xs text-slate-500">{f.postCount} post{f.postCount === 1 ? '' : 's'}{f.lastActivityAt ? ` · last ${formatRelativeTime(f.lastActivityAt)}` : ' · be the first'}</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">Posts here are between members. Moderators can fold, pin or remove a post and are marked when they reply. Use a content warning for anything that describes self-harm, abuse, loss or medical detail; readers can keep those folded.</p>
    </div>
  );
}
