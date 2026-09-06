'use client';

/**
 * Writing the blog: every article in one list, an editor beside it. Markdown
 * in, with a preview that renders exactly what readers get. Publish stamps
 * the time; a future time schedules; archive keeps it off the site without
 * losing it.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Eye, FileText, Loader2, Newspaper, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import Markdown from '@/components/blog/Markdown';

type Status = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
type Article = { id: string; slug: string; title: string; excerpt: string | null; body: string; coverImage: string | null; tags: string[]; status: Status; publishedAt: string | null; viewCount: number; updatedAt: string };

const TONE: Record<Status, string> = { DRAFT: 'bg-amber-100 text-amber-800', PUBLISHED: 'bg-emerald-100 text-emerald-800', ARCHIVED: 'bg-slate-200 text-slate-700' };
const errorMessage = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;

type Draft = { title: string; slug: string; excerpt: string; body: string; coverImage: string; tags: string };
const empty: Draft = { title: '', slug: '', excerpt: '', body: '', coverImage: '', tags: '' };
const toDraft = (a: Article): Draft => ({ title: a.title, slug: a.slug, excerpt: a.excerpt ?? '', body: a.body, coverImage: a.coverImage ?? '', tags: a.tags.join(', ') });
const toPayload = (d: Draft) => ({
  title: d.title.trim(),
  slug: d.slug.trim() || undefined,
  excerpt: d.excerpt.trim() || null,
  body: d.body,
  coverImage: d.coverImage.trim() || null,
  tags: d.tags.split(',').map((t) => t.trim()).filter(Boolean),
});

export default function AdminBlogPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [preview, setPreview] = useState(false);

  const articles = useQuery({
    queryKey: ['admin-blog'],
    queryFn: () => api.get('/admin/blog'),
    select: (r) => (Array.isArray(r.data?.data) ? (r.data.data as Article[]) : []),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-blog'] });
  const onError = (e: unknown) => toast.error(errorMessage(e) || 'That did not save');
  const current = selectedId && selectedId !== 'new' ? articles.data?.find((a) => a.id === selectedId) ?? null : null;

  const open = (a: Article) => {
    setSelectedId(a.id);
    setDraft(toDraft(a));
    setPreview(false);
  };
  const startNew = () => {
    setSelectedId('new');
    setDraft(empty);
    setPreview(false);
  };

  const create = useMutation({
    mutationFn: (status: Status) => api.post('/admin/blog', { ...toPayload(draft), status }),
    onSuccess: (res) => {
      refresh();
      const a = res.data?.data as Article | undefined;
      if (a) open(a);
      toast.success('Saved');
    },
    onError,
  });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.patch(`/admin/blog/${id}`, data),
    onSuccess: (res) => {
      refresh();
      const a = res.data?.data as Article | undefined;
      if (a) setDraft(toDraft(a));
      toast.success('Saved');
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/blog/${id}`),
    onSuccess: () => {
      refresh();
      setSelectedId(null);
      toast.success('Deleted');
    },
    onError,
  });

  const busy = create.isPending || update.isPending;
  const canSave = draft.title.trim().length >= 3 && draft.body.trim().length > 0;
  const save = (status?: Status) => {
    if (selectedId === 'new') create.mutate(status ?? 'DRAFT');
    else if (current) update.mutate({ id: current.id, data: { ...toPayload(draft), ...(status ? { status } : {}) } });
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Link href="/admin" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Admin
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <Newspaper className="h-7 w-7 text-primary-600" /> Blog
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Published articles appear on{' '}
            <Link href="/blog" className="text-primary-600 hover:underline">
              /blog
            </Link>
            . Markdown in; the preview shows what readers see.
          </p>
        </div>
        <button type="button" onClick={startNew} className="btn-primary inline-flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" /> New article
        </button>
      </div>

      <div className={cn('grid gap-6', selectedId ? 'lg:grid-cols-[320px_minmax(0,1fr)]' : 'grid-cols-1')}>
        <div>
          {articles.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (articles.data?.length ?? 0) === 0 ? (
            <div className="card p-10 text-center text-slate-500">Nothing written yet.</div>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
              {articles.data!.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => open(a)} className={cn('flex w-full items-start gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800', selectedId === a.id && 'bg-primary-50 dark:bg-primary-900/20')}>
                    <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900 dark:text-white">{a.title}</span>
                      <span className="block text-xs text-slate-500">
                        edited {formatDistanceToNow(new Date(a.updatedAt), { addSuffix: true })}
                        {a.status === 'PUBLISHED' ? ` · ${a.viewCount} ${a.viewCount === 1 ? 'read' : 'reads'}` : ''}
                      </span>
                    </span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', TONE[a.status])}>{a.status.toLowerCase()}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selectedId && (
          <div className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{selectedId === 'new' ? 'New article' : current?.title}</h2>
              <div className="flex items-center gap-2 text-sm">
                {current?.status === 'PUBLISHED' && (
                  <Link href={`/blog/${current.slug}`} target="_blank" className="inline-flex items-center gap-1 text-primary-600 hover:underline">
                    <Eye className="h-4 w-4" /> View on site
                  </Link>
                )}
                <button type="button" onClick={() => setPreview((p) => !p)} className="btn-outline text-sm">
                  {preview ? 'Edit' : 'Preview'}
                </button>
              </div>
            </div>

            {preview ? (
              <div className="rounded-xl border border-slate-200 p-6 dark:border-slate-700">
                <h1 className="mb-4 text-3xl font-semibold text-slate-900 dark:text-white">{draft.title || 'Untitled'}</h1>
                <Markdown source={draft.body} />
              </div>
            ) : (
              <>
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title" aria-label="Title" className="input w-full text-lg font-semibold" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} placeholder="Slug (made from the title if blank)" aria-label="Slug" className="input w-full font-mono text-sm" />
                  <input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} placeholder="Tags, comma separated" aria-label="Tags" className="input w-full text-sm" />
                </div>
                <input value={draft.coverImage} onChange={(e) => setDraft({ ...draft, coverImage: e.target.value })} placeholder="Cover image URL (optional)" aria-label="Cover image" className="input w-full text-sm" />
                <textarea value={draft.excerpt} onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })} rows={2} placeholder="Excerpt: one or two sentences shown on the list" aria-label="Excerpt" className="input w-full text-sm" />
                <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={22} placeholder={'Write in Markdown.\n\n## A heading\n\nA paragraph with **bold**, a [link](https://example.com), and an image:\n\n![alt text](https://example.com/picture.jpg)'} aria-label="Body" className="input w-full font-mono text-sm leading-relaxed" />
              </>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <button type="button" onClick={() => save()} disabled={busy || !canSave} className="btn-outline text-sm">
                {selectedId === 'new' ? 'Save draft' : 'Save'}
              </button>
              {(selectedId === 'new' || current?.status !== 'PUBLISHED') && (
                <button type="button" onClick={() => save('PUBLISHED')} disabled={busy || !canSave} className="btn-primary text-sm">
                  Publish
                </button>
              )}
              {current?.status === 'PUBLISHED' && (
                <button type="button" onClick={() => save('DRAFT')} disabled={busy} className="btn-outline text-sm">
                  Unpublish
                </button>
              )}
              {current && current.status !== 'ARCHIVED' && (
                <button type="button" onClick={() => save('ARCHIVED')} disabled={busy} className="text-sm text-slate-500 hover:underline">
                  Archive
                </button>
              )}
              {current?.publishedAt && <span className="text-xs text-slate-500">published {formatDistanceToNow(new Date(current.publishedAt), { addSuffix: true })}</span>}
              {current && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete "${current.title}" for good? Archiving keeps it.`)) remove.mutate(current.id);
                  }}
                  className="ml-auto inline-flex items-center gap-1 text-sm text-red-600 hover:underline"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
