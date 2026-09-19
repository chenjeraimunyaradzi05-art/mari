'use client';

/**
 * A thread: the post, the replies, the reply box, and what a moderator can
 * do. Report goes to the same queue as every other report on the platform.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Flag, Heart, MessageCircleHeart, Trash2 } from 'lucide-react';
import { wellnessApi, wellnessError, type Author, type CrisisLine } from '@/lib/wellness-api';
import { AuthorChips, Chip, CrisisStrip, ErrorBox, Loading, WarningFold, WellnessNav, foldsFor, useLoad } from '@/components/wellness/WellnessUi';
import { Check, Field, SelectInput, inputClass } from '@/components/strategy/StrategyUi';
import { formatRelativeTime } from '@/lib/utils';

type Post = { id: string; title: string; body: string; contentWarning: string | null; isHidden: boolean; hiddenReason: string | null; isPinned: boolean; isLocked: boolean; supportCount: number; createdAt: string; author: Author; supportedByMe: boolean; canEdit: boolean; forum: { slug: string; name: string } };
type Reply = { id: string; body: string; isHidden: boolean; isFromModerator: boolean; createdAt: string; author: Author; canEdit: boolean };
type Data = { post: Post; replies: Reply[]; replyPage: number; replyLimit: number; replyTotal: number; isModerator: boolean; crisisLines: CrisisLine[]; viewer?: { hiddenWarnings: string[]; anonymousByDefault: boolean } };

const REPORT_REASONS = [{ value: 'INAPPROPRIATE', label: 'Not right for this forum' }, { value: 'HARASSMENT', label: 'Harassment' }, { value: 'HATE_SPEECH', label: 'Hate speech' }, { value: 'MISINFORMATION', label: 'Medical misinformation' }, { value: 'SPAM', label: 'Spam or selling' }, { value: 'OTHER', label: 'Something else' }];

export default function ThreadPage() {
  const params = useParams<{ slug: string; postId: string }>();
  const router = useRouter();
  const [replyPage, setReplyPage] = useState(1);
  const data = useLoad<Data>(() => wellnessApi.post(params.postId, replyPage), [params.postId, replyPage]);
  const [reply, setReply] = useState({ body: '', isAnonymous: false });
  const [busy, setBusy] = useState(false);
  const [crisis, setCrisis] = useState<CrisisLine[] | null>(null);
  const [reporting, setReporting] = useState<{ reason: string; description: string } | null>(null);
  const p = data.data?.post;
  const folded = foldsFor(data.data?.viewer?.hiddenWarnings);
  const anonymousByDefault = data.data?.viewer?.anonymousByDefault ?? false;
  useEffect(() => { setReply((r) => ({ ...r, isAnonymous: anonymousByDefault })); }, [anonymousByDefault]);

  // The replies come back oldest first, a page at a time, so replies.length is
  // only what is on screen. replyTotal is the whole conversation: the heading
  // and the pager come from it, because a thread that stops at reply fifty
  // with nothing said about it reads as though that is all there ever was.
  const replyLimit = data.data?.replyLimit ?? 50;
  const replyTotal = data.data?.replyTotal ?? 0;
  const replyPages = Math.max(1, Math.ceil(replyTotal / replyLimit));
  // Counted off the page the server answered with, not the page she has just
  // asked for, so the label matches the replies actually on screen.
  const answeredPage = data.data?.replyPage;
  const shownCount = data.data?.replies.length ?? 0;
  const shownFrom = shownCount ? ((answeredPage ?? 1) - 1) * replyLimit + 1 : 0;
  const shownTo = shownFrom + shownCount - 1;
  // The page she is on can disappear under her when a moderator takes replies
  // down, so snap back rather than leaving her on an empty page of a thread
  // that still has one.
  //
  // Only ever against the answer for the page she is on, though. useLoad keeps
  // the previous response on screen while it refetches, so between asking for a
  // new page and getting it, replyPages still describes the page she was
  // reading. Snapping back on that number undid the jump below: she posted the
  // reply that started a new last page, was moved to it, and the page count
  // left over from the response still in hand pulled her straight back to the
  // page her reply was not on. answeredPage is the page the server actually
  // answered with, so this waits until the two agree before deciding the page
  // is gone.
  useEffect(() => { if (answeredPage === replyPage && replyPage > replyPages) setReplyPage(replyPages); }, [answeredPage, replyPage, replyPages]);

  const send = async () => {
    if (!p) return;
    setBusy(true);
    try {
      const res = await wellnessApi.reply(p.id, { body: reply.body.trim(), isAnonymous: reply.isAnonymous });
      if (res.data?.data?.crisis?.flagged) setCrisis(res.data.data.crisis.lines);
      setReply({ body: '', isAnonymous: anonymousByDefault });
      // Her reply joins the end of the thread, which on a long one is a later
      // page than the one she is reading. Landing on that page is what keeps
      // the thread from looking as though it swallowed what she just wrote.
      const landsOn = Math.max(1, Math.ceil((replyTotal + 1) / replyLimit));
      if (landsOn === replyPage) data.reload(); else setReplyPage(landsOn);
    } catch (err) { toast.error(wellnessError(err, 'That could not be posted.')); } finally { setBusy(false); }
  };
  const support = async () => { if (!p) return; try { await wellnessApi.support(p.id); data.reload(); } catch (err) { toast.error(wellnessError(err, 'That did not go through.')); } };
  const report = async () => { if (!p || !reporting) return; try { await wellnessApi.reportPost(p.id, { reason: reporting.reason, description: reporting.description || undefined }); setReporting(null); toast.success('Reported. A moderator will look.'); } catch (err) { toast.error(wellnessError(err, 'That could not be reported.')); } };
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
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><AuthorChips author={p.author} /><span>{formatRelativeTime(p.createdAt)}</span>{p.isHidden && <Chip tone="rose">Hidden{p.hiddenReason ? `: ${p.hiddenReason}` : ''}</Chip>}{p.isLocked && <Chip>Closed to replies</Chip>}</div>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{p.title}</h1>
            <div className="mt-3"><WarningFold warning={p.contentWarning} folded={folded(p.contentWarning)}><p className="whitespace-pre-line text-sm leading-7 text-slate-800 dark:text-slate-200">{p.body}</p></WarningFold></div>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <button type="button" onClick={support} className={`inline-flex items-center gap-1 ${p.supportedByMe ? 'text-rose-600' : 'hover:text-rose-600'}`}><Heart className={`h-4 w-4 ${p.supportedByMe ? 'fill-current' : ''}`} /> {p.supportCount} with you</button>
              {!p.canEdit && <button type="button" onClick={() => setReporting((r) => (r ? null : { reason: 'INAPPROPRIATE', description: '' }))} aria-expanded={Boolean(reporting)} className="inline-flex items-center gap-1 hover:text-rose-600"><Flag className="h-3.5 w-3.5" /> Report</button>}
              {(p.canEdit || data.data?.isModerator) && <button type="button" onClick={removePost} className="inline-flex items-center gap-1 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /> Remove</button>}
              {data.data?.isModerator && <><button type="button" onClick={() => moderate({ isPinned: !p.isPinned })} className="hover:text-rose-600">{p.isPinned ? 'Unpin' : 'Pin'}</button><button type="button" onClick={() => moderate({ isLocked: !p.isLocked })} className="hover:text-rose-600">{p.isLocked ? 'Reopen' : 'Close'}</button><button type="button" onClick={() => moderate({ isHidden: !p.isHidden, hiddenReason: p.isHidden ? null : 'Removed by a moderator' })} className="hover:text-rose-600">{p.isHidden ? 'Unhide' : 'Hide'}</button></>}
            </div>
            {reporting && (
              <div className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                <Field label="What is wrong"><SelectInput value={reporting.reason} onChange={(v) => setReporting((r) => r && ({ ...r, reason: v }))} options={REPORT_REASONS} /></Field>
                <Field label="Anything a moderator should know" hint="Optional."><input value={reporting.description} onChange={(e) => setReporting((r) => r && ({ ...r, description: e.target.value }))} maxLength={1000} className={inputClass} /></Field>
                <div className="flex gap-2 pb-1"><button type="button" onClick={report} className="btn-primary text-xs">Send</button><button type="button" onClick={() => setReporting(null)} className="btn-ghost text-xs">Cancel</button></div>
              </div>
            )}
          </article>

          <section className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{replyTotal} repl{replyTotal === 1 ? 'y' : 'ies'}</h2>
              {/* Nothing to count off when the answered page came back empty,
                  which happens when replies are taken down while she is on a
                  later page: shownFrom is 0 and shownTo is one less than that,
                  so this line used to offer her a negative reply number until
                  the snap-back above moved her. Say nothing instead. */}
              {replyPages > 1 && shownCount > 0 && <p className="text-xs text-slate-500">Showing {shownFrom}–{shownTo}, oldest first</p>}
            </div>
            {data.data!.replies.map((r) => (
              <div key={r.id} className={`rounded-xl border p-4 ${r.isFromModerator ? 'border-sky-200 bg-sky-50/50 dark:border-sky-900/40 dark:bg-sky-900/10' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><AuthorChips author={{ ...r.author, isModerator: r.isFromModerator || r.author.isModerator }} /><span>{formatRelativeTime(r.createdAt)}</span>{r.isHidden && <Chip tone="rose">Hidden</Chip>}</div>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-800 dark:text-slate-200">{r.body}</p>
                <div className="mt-2 flex gap-3 text-xs text-slate-500">{(r.canEdit || data.data?.isModerator) && <button type="button" onClick={() => removeReply(r)} className="hover:text-rose-600">Remove</button>}{data.data?.isModerator && <button type="button" onClick={() => hideReply(r)} className="hover:text-rose-600">{r.isHidden ? 'Unhide' : 'Hide'}</button>}</div>
              </div>
            ))}
            {replyPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <button type="button" disabled={replyPage <= 1} onClick={() => setReplyPage((n) => Math.max(1, n - 1))} className="btn-ghost disabled:opacity-40">Earlier replies</button>
                <span className="text-xs text-slate-500">Page {replyPage} of {replyPages}</span>
                <button type="button" disabled={replyPage >= replyPages} onClick={() => setReplyPage((n) => Math.min(replyPages, n + 1))} className="btn-ghost disabled:opacity-40">Later replies</button>
              </div>
            )}
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
