'use client';

/**
 * The registers, checked before the paperwork goes in.
 *
 * An ABN and an ACN both carry a checksum, so a mistyped one can be caught
 * here without asking anybody. When the server has an ABR credential the
 * number is also looked up on the Australian Business Register and the
 * entity behind it comes back; without one, the checksum result comes back
 * with a link to search by hand. A business name is searched the same way.
 *
 * This is the "AI reviews for errors" step of the Formation Studio, done as
 * an arithmetic check against the real register rather than a guess.
 */

import { useState } from 'react';
import { AlertTriangle, Check, ExternalLink, Loader2, Search, X } from 'lucide-react';
import { formationApi } from '@/lib/api';
import { apiMessage } from '@/lib/strategy-api';
import { cn } from '@/lib/utils';

type Kind = 'abn' | 'acn' | 'name';

type Entity = { name?: string | null; status?: string | null; type?: string | null; state?: string | null; postcode?: string | null; gstFrom?: string | null } | null;
type Result = {
  abn?: string; acn?: string; formatted?: string | null; valid?: boolean; configured?: boolean;
  entity?: Entity; lookupUrl?: string; registerUrl?: string;
  matches?: Array<{ name: string; abn?: string | null; status?: string | null; state?: string | null }>;
};

const KINDS: Array<{ id: Kind; label: string; placeholder: string; hint: string }> = [
  { id: 'abn', label: 'ABN', placeholder: '51 824 753 556', hint: 'Eleven digits. The checksum is verified here.' },
  { id: 'acn', label: 'ACN', placeholder: '004 085 616', hint: 'Nine digits, for a company.' },
  { id: 'name', label: 'Business name', placeholder: 'Bright Path', hint: 'Searches the register for names already in use.' },
];

export function RegisterCheck({ defaultKind = 'name', defaultValue = '' }: { defaultKind?: Kind; defaultValue?: string }) {
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [value, setValue] = useState(defaultValue);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = KINDS.find((k) => k.id === kind)!;

  const check = async () => {
    const q = value.trim();
    if (!q) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = kind === 'abn' ? await formationApi.lookupAbn(q) : kind === 'acn' ? await formationApi.lookupAcn(q) : await formationApi.lookupName(q);
      setResult(res.data?.data ?? null);
    } catch (err) {
      setError(apiMessage(err, 'The register could not be reached just now.'));
    } finally {
      setBusy(false);
    }
  };

  const valid = result?.valid;
  const entity = result?.entity;

  return (
    <div className="border rounded-lg p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Check the register</h2>
        <p className="text-sm text-muted-foreground">
          A number with a bad checksum is a typo, and a name already registered will be refused. Both are cheaper to find here than at lodgement.
        </p>
      </div>

      <div className="flex flex-wrap gap-1" role="tablist" aria-label="What to check">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            role="tab"
            aria-selected={kind === k.id}
            onClick={() => { setKind(k.id); setResult(null); setError(null); }}
            className={cn('rounded-md px-3 py-1.5 text-sm font-medium', kind === k.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); check(); } }}
          placeholder={active.placeholder}
          aria-label={active.label}
          className="min-w-[14rem] flex-1 rounded-md border p-2 text-sm"
        />
        <button type="button" onClick={check} disabled={busy || !value.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Check
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{active.hint}</p>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      {result && kind !== 'name' && (
        <div className={cn('rounded-md border p-4 text-sm', valid ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/10' : 'border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/10')}>
          <p className="flex items-center gap-2 font-medium">
            {valid ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-amber-600" />}
            {valid ? `${result.formatted} passes its checksum` : `That ${active.label} does not pass its checksum`}
          </p>
          {valid && entity && (
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {entity.name && (<><dt className="text-muted-foreground">Registered to</dt><dd>{entity.name}</dd></>)}
              {entity.status && (<><dt className="text-muted-foreground">Status</dt><dd>{entity.status}</dd></>)}
              {entity.type && (<><dt className="text-muted-foreground">Type</dt><dd>{entity.type}</dd></>)}
              {(entity.state || entity.postcode) && (<><dt className="text-muted-foreground">Located</dt><dd>{[entity.state, entity.postcode].filter(Boolean).join(' ')}</dd></>)}
              {entity.gstFrom && (<><dt className="text-muted-foreground">GST from</dt><dd>{String(entity.gstFrom).slice(0, 10)}</dd></>)}
            </dl>
          )}
          {valid && !entity && result.configured === false && (
            <p className="mt-2 text-xs text-muted-foreground">The checksum is right. This site has no register credential, so who it belongs to has to be checked by hand.</p>
          )}
          {valid && !entity && result.configured && (
            <p className="mt-2 text-xs text-muted-foreground">The checksum is right, but the register returned nothing for it. It may be cancelled.</p>
          )}
          {!valid && <p className="mt-1 text-xs text-muted-foreground">Check the digits. An ABN is eleven, an ACN is nine.</p>}
          {(result.lookupUrl || result.registerUrl) && (
            <a href={result.registerUrl ?? result.lookupUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Open the register <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      {result && kind === 'name' && (
        <div className="rounded-md border p-4 text-sm">
          {result.configured === false ? (
            <p className="flex items-start gap-2 text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              This site has no register credential, so names cannot be searched from here. Search the Australian Business Register directly, then come back.
            </p>
          ) : (result.matches ?? []).length === 0 ? (
            <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300"><Check className="h-4 w-4" /> Nothing on the register matches that name. It may still be taken as a trade mark; search IP Australia before you print anything.</p>
          ) : (
            <>
              <p className="font-medium">{result.matches!.length} name{result.matches!.length === 1 ? '' : 's'} already on the register</p>
              <ul className="mt-2 space-y-1 text-xs">
                {result.matches!.slice(0, 10).map((m, i) => (
                  <li key={`${m.abn ?? m.name}-${i}`} className="flex flex-wrap justify-between gap-2">
                    <span>{m.name}</span>
                    <span className="text-muted-foreground">{[m.status, m.state, m.abn].filter(Boolean).join(' · ')}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">A close match is not always a blocker, but a name that is identical will be refused.</p>
            </>
          )}
          {result.lookupUrl && (
            <a href={result.lookupUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Search the register <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
