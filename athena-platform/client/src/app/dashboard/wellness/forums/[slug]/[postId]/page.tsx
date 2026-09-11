'use client';

/**
 * A thread: the post, the replies, the reply box, and what a moderator can
 * do. Report goes to the same queue as every other report on the platform.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Flag, Heart, MessageCircleHeart, Trash2 } from 'lucide-react';
import { wellnessApi, wellnessError, type Author, type CrisisLine } from '@/lib/wellness-api';
import { Chip, CrisisStrip, ErrorBox, Loading, WarningFold, WellnessNav, useLoad } from '@/components/wellness/WellnessUi';
import { Check, inputClass } from '@/components/strategy/StrategyUi';
import { formatRelativeTime } from '@/lib/utils';

type Post = { id: string; title: string; body: string; contentWarning: string | null; isHidden: boolean; hiddenReason: string | null; isPinned: boolean; isLocked: boolean; supportCount: number; createdAt: string; author: Author; supportedByMe: boolean; canEdit: boolean; forum: { slug: string; name: string } };
type Reply = { id: string; body: string; isHidden: boolean; isFromModerator: boolean; createdAt: string; author: Author; canEdit: boolean };
type Data = { post: Post; replies: Reply[]; isModerator: boolean; crisisLines: CrisisLine[] };

export default function ThreadPage() {
  const params = useParams<{ slug: string; postId: string }>();
  const router = useRouter();
  const data = useLoad<Data>(() => wellnessApi.post(params.postId), [params.postId]);
  const [reply, setReply] = useState({ body: '', isAnonymous: false });
  const [busy, setBusy] = useState(false);
  const [crisis, setCrisis] = useState<CrisisLine[] | null>(null);
  const p = data.data?.post;

  const send = async () => {
    if (!p) return;
    setBusy(true);
    try {
      const res = await wellnessApi.reply(p.id, { body: reply.body.trim(), isAnonymous: reply.isAnonymous });
      if (res.data?.data?.crisis?.flagged) setCrisis(res.data.data.crisis.lines);
      setReply({ body: '', isAnonymous: false }); data.reload();
    } catch (err) { toast.error(wellnessError(err, 'That could not be posted.')); } finally { setBusy(false); }
  };
  const support = async () => { if (!p) return; try { await wellnessApi.support(p.id); data.reload(); } catch (err) { toast.error(wellnessError(err, 'That did not go through.')); } };
  const report = async () => { if (!p) return; const reason = window.prompt('Why are you reporting this? HARASSMENT, HATE_SPEECH, SPAM, MISINFORMATION, INAPPROPRIATE or OTHER', 'INAPPROPRIATE'); if (!reason) return; try { await wellnessApi.reportPost(p.id, { reason: reason.toUpperCase().trim() }); toast.success('Reported. A moderator will look.'); } catch (err) { toast.error(wellnessError(err, 'That could not be reported.')); } };
  const moderate = async (patch: Record<string, unknown>) => { if (!p) return; try { await wellnessApi.updatePost(p.id, patch); data.reload(); } catch (err) { toast.error(wellnessError(err, 'That could not be changed.')); } };
  const removePost = async () => { if (!p || !window.confirm('Remove this post?')) return; try { await wellnessApi.deletePost(p.id); router.push(`/dashboard/wellness/forums/${params.slug}`); } catch (err) { toast.error(wellnessError(err, 'That could not be removed.')); } };
  const removeReply = async (r: Reply) => { try { await wellnessApi.deleteReply(r.id); data.reload(); } catch (err) { toast.error(wellnessError(err, 'That could not be removed.')); } };
  const hideReply = async (r: Reply) => { try { await wellnessApi.updateReply(r.id, { isHidden: !r.isHidden }); data.reload(); } catch (err) { toast.error(wellnessError(err, 'That could not be changed.')); } };

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <WellnessNav current="/dashboard/wellness/forums" />
      <CrisisStrip lines={data.data?.crisisLines} compact />
      {crisis && <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-900/20"><p className="text-sm font-semibold text-rose-800 dark:text-rose-200">It sounds like things are very hard right now. Your reply is up, and these lines are staffed this minute.</p><div className="mt-3"><CrisisStrip lines={crisis} /></div></div>}
      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      {p && (
        <>
          <Link href={`/dashboard/wellness/forums/${p.forum.slug}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-rose-600"><MessageCircleHeart className="h-4 w-4" /> {p.forum.name}</Link>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span className="font-medium text-slate-700 dark:text-slate-300">{p.author.name}</span>{p.author.isModerator && <Chip tone="sky">Moderator</Chip>}<span>{formatRelativeTime(p.createdAt)}</span>{p.isHidden && <Chip tone="rose">Hidden{p.hiddenReason ? `: ${p.hiddenReason}` : ''}</Chip>}{p.isLocked && <Chip>Closed to replies</Chip>}</div>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{p.title}</h1>
            <div className="mt-3"><WarningFold warning={p.contentWarning}><p className="whitespace-pre-line text-sm leading-7 text-slate-800 dark:text-slate-200">{p.body}</p></WarningFold></div>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <button type="button" onClick={support} className={`inline-flex items-center gap-1 ${p.supportedByMe ? 'text-rose-600' : 'hover:text-rose-600'}`}><Heart className={`h-4 w-4 ${p.supportedByMe ? 'fill-current' : ''}`} /> {p.supportCount} with you</button>
              {!p.canEdit && <button type="button" onClick={report} className="inline-flex items-center gap-1 hover:text-rose-600"><Flag className="h-3.5 w-3.5" /> Report</button>}
              {(p.canEdit || data.data?.isModerator) && <button type="button" onClick={removePost} className="inline-flex items-center gap-1 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /> Remove</button>}
              {data.data?.isModerator && <><button type="button" onClick={() => moderate({ isPinned: !p.isPinned })} className="hover:text-rose-600">{p.isPinned ? 'Unpin' : 'Pin'}</button><button type="button" onClick={() => moderate({ isLocked: !p.isLocked })} className="hover:text-rose-600">{p.isLocked ? 'Reopen' : 'Close'}</button><button type="button" onClick={() => moderate({ isHidden: !p.isHidden, hiddenReason: p.isHidden ? null : 'Removed by a moderator' })} className="hover:text-rose-600">{p.isHidden ? 'Unhide' : 'Hide'}</button></>}
            </div>
          </article>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{data.data!.replies.length} repl{data.data!.replies.length === 1 ? 'y' : 'ies'}</h2>
            {data.data!.replies.map((r) => (
              <div key={r.id} className={`rounded-xl border p-4 ${r.isFromModerator ? 'border-sky-200 bg-sky-50/50 dark:border-sky-900/40 dark:bg-sky-900/10' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span className="font-medium text-slate-700 dark:text-slate-300">{r.author.name}</span>{r.isFromModerator && <Chip tone="sky">Moderator</Chip>}<span>{formatRelativeTime(r.createdAt)}</span>{r.isHidden && <Chip tone="rose">Hidden</Chip>}</div>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-800 dark:text-slate-200">{r.body}</p>
                <div className="mt-2 flex gap-3 text-xs text-slate-500">{(r.canEdit || data.data?.isModerator) && <button type="button" onClick={() => removeReply(r)} className="hover:text-rose-600">Remove</button>}{data.data?.isModerator && <button type="button" onClick={() => hideReply(r)} className="hover:text-rose-600">{r.isHidden ? 'Unhide' : 'Hide'}</button>}</div>
              </div>
            ))}
          </section>

          {!p.isLocked && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <textarea value={reply.body} onChange={(e) => setReply((r) => ({ ...r, body: e.target.value }))} rows={4} maxLength={3000} className={inputClass} placeholder="What helped you, or just that you hear her." />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <Check checked={reply.isAnonymous} onChange={(v) => setReply((r) => ({ ...r, isAnonymous: v }))} label="Reply anonymously" />
                <button type="button" onClick={send} disabled={busy || reply.body.trim().length < 2} className="btn-primary text-sm disabled:opacity-50">Reply</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
