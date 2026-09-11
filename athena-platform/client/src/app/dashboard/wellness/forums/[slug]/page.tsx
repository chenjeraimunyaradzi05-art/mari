'use client';

/**
 * One forum: its guidelines, the posts, and the composer. A post can be
 * anonymous and can carry a content warning; a post that sounds like
 * crisis puts the lines in front of its author the moment it is up.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Heart, MessageCircleHeart, Pin, Plus } from 'lucide-react';
import { wellnessApi, wellnessError, type Author, type CrisisLine } from '@/lib/wellness-api';
import { Chip, CrisisStrip, Empty, ErrorBox, Loading, PageTitle, WarningFold, WellnessNav, useLoad } from '@/components/wellness/WellnessUi';
import { Check, Field, Panel, SelectInput, inputClass } from '@/components/strategy/StrategyUi';
import { formatRelativeTime } from '@/lib/utils';

type Post = { id: string; title: string; body: string; contentWarning: string | null; isHidden: boolean; isPinned: boolean; isLocked: boolean; replyCount: number; supportCount: number; lastReplyAt: string | null; createdAt: string; author: Author; supportedByMe: boolean };
type Data = { forum: { slug: string; name: string; description: string; guidelines: string }; posts: Post[]; page: number; total: number; isModerator: boolean; crisisLines: CrisisLine[] };
type Reference = { contentWarnings: string[] };

export default function ForumPage() {
  const params = useParams<{ slug: string }>();
  const [page, setPage] = useState(1);
  const data = useLoad<Data>(() => wellnessApi.forum(params.slug, page), [params.slug, page]);
  const ref = useLoad<Reference>(() => wellnessApi.reference());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', isAnonymous: false, contentWarning: '' });
  const [busy, setBusy] = useState(false);
  const [crisis, setCrisis] = useState<{ message: string; lines: CrisisLine[] } | null>(null);

  const post = async () => {
    setBusy(true);
    try {
      const res = await wellnessApi.createPost(params.slug, { title: form.title.trim(), body: form.body.trim(), isAnonymous: form.isAnonymous, contentWarning: form.contentWarning || null });
      if (res.data?.data?.crisis?.flagged) setCrisis(res.data.data.crisis);
      toast.success('Posted');
      setForm({ title: '', body: '', isAnonymous: false, contentWarning: '' }); setOpen(false); data.reload();
    } catch (err) { toast.error(wellnessError(err, 'That could not be posted.')); } finally { setBusy(false); }
  };
  const support = async (p: Post) => { try { await wellnessApi.support(p.id); data.reload(); } catch (err) { toast.error(wellnessError(err, 'That did not go through.')); } };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <PageTitle icon={MessageCircleHeart} kicker="Forum" title={data.data?.forum.name ?? '…'} blurb={data.data?.forum.description ?? ''} action={<button type="button" onClick={() => setOpen((v) => !v)} className="btn-primary inline-flex items-center gap-2 text-sm"><Plus className="h-4 w-4" /> Say something</button>} />
      <WellnessNav current="/dashboard/wellness/forums" />
      <CrisisStrip lines={data.data?.crisisLines} compact />
      {crisis && <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-900/20"><p className="text-sm font-semibold text-rose-800 dark:text-rose-200">{crisis.message}</p><div className="mt-3"><CrisisStrip lines={crisis.lines} /></div><button type="button" onClick={() => setCrisis(null)} className="mt-2 text-xs text-slate-500 underline">Close</button></div>}
      {data.data && <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"><span className="font-semibold">House rules.</span> {data.data.forum.guidelines}</p>}

      {open && (
        <Panel title="A new post" intro="Write it the way you would say it to a friend who gets it.">
          <div className="space-y-3">
            <Field label="Title"><input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} maxLength={140} className={inputClass} placeholder="What is going on" /></Field>
            <Field label="The rest"><textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} maxLength={5000} rows={6} className={inputClass} placeholder="At least a couple of sentences." /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Content warning" hint="Readers can keep warned posts folded."><SelectInput value={form.contentWarning} onChange={(v) => setForm((f) => ({ ...f, contentWarning: v }))} options={[{ value: '', label: 'None needed' }, ...(ref.data?.contentWarnings ?? []).map((w) => ({ value: w, label: w }))]} /></Field>
              <div className="flex items-end pb-2"><Check checked={form.isAnonymous} onChange={(v) => setForm((f) => ({ ...f, isAnonymous: v }))} label="Post anonymously" hint="Shown as “A member”. Moderators cannot see who either, unless there is a safety concern." /></div>
            </div>
            <div className="flex gap-2"><button type="button" onClick={post} disabled={busy || form.title.trim().length < 5 || form.body.trim().length < 20} className="btn-primary text-sm disabled:opacity-50">Post</button><button type="button" onClick={() => setOpen(false)} className="btn-ghost text-sm">Cancel</button></div>
          </div>
        </Panel>
      )}

      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      {data.data && data.data.posts.length === 0 && <Empty title="Quiet in here" body="Be the first. Someone else is carrying the same thing and looking for exactly this thread." action={<button type="button" onClick={() => setOpen(true)} className="btn-primary text-sm">Say something</button>} />}
      <ul className="space-y-3">
        {(data.data?.posts ?? []).map((p) => (
          <li key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700 dark:text-slate-300">{p.author.name}</span>{p.author.isModerator && <Chip tone="sky">Moderator</Chip>}<span>{formatRelativeTime(p.createdAt)}</span>{p.isPinned && <Chip tone="amber"><Pin className="mr-1 inline h-3 w-3" />Pinned</Chip>}{p.isLocked && <Chip>Closed</Chip>}{p.isHidden && <Chip tone="rose">Hidden</Chip>}
            </div>
            <Link href={`/dashboard/wellness/forums/${params.slug}/${p.id}`} className="mt-1 block text-lg font-semibold text-slate-900 hover:text-rose-600 dark:text-white">{p.title}</Link>
            <div className="mt-1"><WarningFold warning={p.contentWarning}><p className="text-sm leading-6 text-slate-700 dark:text-slate-300">{p.body}</p></WarningFold></div>
            <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
              <button type="button" onClick={() => support(p)} className={`inline-flex items-center gap-1 ${p.supportedByMe ? 'text-rose-600' : 'hover:text-rose-600'}`}><Heart className={`h-4 w-4 ${p.supportedByMe ? 'fill-current' : ''}`} /> {p.supportCount} with you</button>
              <Link href={`/dashboard/wellness/forums/${params.slug}/${p.id}`}>{p.replyCount} repl{p.replyCount === 1 ? 'y' : 'ies'}</Link>
            </div>
          </li>
        ))}
      </ul>
      {data.data && data.data.total > 20 && <div className="flex justify-between text-sm"><button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-ghost disabled:opacity-40">Newer</button><button type="button" disabled={page * 20 >= data.data.total} onClick={() => setPage((p) => p + 1)} className="btn-ghost disabled:opacity-40">Older</button></div>}
    </div>
  );
}
