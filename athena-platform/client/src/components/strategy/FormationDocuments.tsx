'use client';

/**
 * The documents a registration needs, generated from what has been
 * entered and kept on it: a partnership agreement draft, director
 * consents and the first resolution for a company, the solicitor's
 * instructions for a trust, and the checklists everyone gets. Each one
 * downloads as Markdown to take to an adviser.
 */

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, FileText, Loader2, Sparkles } from 'lucide-react';
import { strategyApi, apiMessage } from '@/lib/strategy-api';
import { downloadText } from '@/lib/download';
import { formatDate } from '@/lib/utils';

type DocMeta = { key: string; title: string; purpose: string };
type Docs = { generatedAt: string | null; items: DocMeta[]; available: DocMeta[] };

export function FormationDocuments({ registrationId, businessName }: { registrationId: string; businessName?: string | null }) {
  const [docs, setDocs] = useState<Docs | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await strategyApi.formation.documents(registrationId);
      setDocs(res.data?.data ?? null);
    } catch {
      setDocs(null);
    }
  }, [registrationId]);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setBusy(true);
    try {
      await strategyApi.formation.generateDocuments(registrationId);
      await load();
      toast.success('Documents drawn up from the registration');
    } catch (err) {
      toast.error(apiMessage(err, 'The documents could not be generated.'));
    } finally {
      setBusy(false);
    }
  };

  const download = async (key: string, title: string) => {
    setDownloading(key);
    try {
      const res = await strategyApi.formation.document(registrationId, key);
      downloadText(`${(businessName || 'business').replace(/[^\w-]+/g, '-').toLowerCase()}-${key}.md`, String(res.data ?? ''), 'text/markdown;charset=utf-8');
    } catch (err) {
      toast.error(apiMessage(err, `${title} could not be downloaded.`));
    } finally {
      setDownloading(null);
    }
  };

  if (!docs) return null;
  const items = docs.items.length ? docs.items : docs.available;
  const generated = docs.items.length > 0;

  return (
    <div className="border rounded-lg p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Documents</h2>
          <p className="text-sm text-muted-foreground">
            {generated ? `Drawn up ${docs.generatedAt ? formatDate(docs.generatedAt) : ''} from the details above. Generate again after you change anything.` : 'Drawn up from the details above, with square brackets where something is still to be decided.'}
          </p>
        </div>
        <button type="button" onClick={generate} disabled={busy} className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {generated ? 'Generate again' : 'Generate documents'}
        </button>
      </div>
      <ul className="grid gap-2 md:grid-cols-2">
        {items.map((d) => (
          <li key={d.key} className="flex items-start gap-3 rounded-md border p-3">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{d.title}</p>
              <p className="text-xs text-muted-foreground">{d.purpose}</p>
            </div>
            <button type="button" onClick={() => download(d.key, d.title)} disabled={downloading === d.key} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline" aria-label={`Download ${d.title}`}>
              {downloading === d.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Download
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">These are starting points for an accountant or a lawyer, not a substitute for one. A trust deed in particular has to be drawn and executed properly; the sheet here is the brief for it.</p>
    </div>
  );
}
