'use client';

/**
 * The Australian Business Register, from inside the formation studio.
 *
 * An ABN is checked against its checksum straight away; with the register
 * configured on the server it is looked up live and the entity shown. A
 * proposed business name is checked against names already on the register.
 * When the live lookup is off the page says so and links to the ABR, rather
 * than pretending.
 */

import { useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, Search, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface AbrEntity {
  abn: string;
  abnStatus: string;
  abnStatusFrom: string | null;
  acn: string | null;
  entityName: string;
  entityType: string;
  gstRegisteredFrom: string | null;
  businessNames: string[];
  state: string | null;
  postcode: string | null;
}

interface AbnResult {
  abn: string;
  formatted: string | null;
  valid: boolean;
  configured: boolean;
  entity: AbrEntity | null;
  lookupUrl: string;
}

interface NameMatch {
  abn: string;
  name: string;
  nameType: string;
  abnStatus: string;
  state: string | null;
  postcode: string | null;
  score: number;
}

interface NameResult {
  configured: boolean;
  matches: NameMatch[];
  lookupUrl: string;
}

const errorMessage = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;

/** A proposed name against the register: used beside the wizard's name field. */
export function AbnNameCheck({ name }: { name: string }) {
  const [result, setResult] = useState<NameResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const check = async () => {
    if (name.trim().length < 2) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await api.get('/formation/lookup/name', { params: { q: name.trim() } });
      setResult(res.data?.data ?? null);
    } catch (e) {
      setProblem(errorMessage(e) || 'The register could not be reached');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" onClick={check} disabled={busy || name.trim().length < 2}>
        {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-2 h-3.5 w-3.5" />}
        Check the register for this name
      </Button>
      {problem && <p className="text-xs text-red-600">{problem}</p>}
      {result && !result.configured && (
        <p className="text-xs text-muted-foreground">
          Live name search is not switched on here.{' '}
          <a href={result.lookupUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
            Search the ABR yourself <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      )}
      {result && result.configured && result.matches.length === 0 && (
        <p className="inline-flex items-center gap-1 text-xs text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> No registered name matches. ASIC still decides availability at registration.
        </p>
      )}
      {result && result.configured && result.matches.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="mb-1 font-medium">Names already on the register that look like this one:</p>
          <ul className="space-y-0.5">
            {result.matches.slice(0, 6).map((m) => (
              <li key={`${m.abn}-${m.name}`}>
                {m.name} <span className="opacity-70">({m.nameType.toLowerCase()}, {m.abnStatus.toLowerCase()}, ABN {m.abn}{m.state ? `, ${m.state}` : ''})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** The full card: look an ABN up, and check a name. */
export default function AbnLookup({ onUse }: { onUse?: (entity: AbrEntity) => void }) {
  const [abn, setAbn] = useState('');
  const [name, setName] = useState('');
  const [result, setResult] = useState<AbnResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const lookup = async () => {
    const digits = abn.replace(/\D/g, '');
    if (!digits) return;
    setBusy(true);
    setProblem(null);
    setResult(null);
    try {
      const res = await api.get(`/formation/lookup/abn/${digits}`);
      setResult(res.data?.data ?? null);
    } catch (e) {
      setProblem(errorMessage(e) || 'The register could not be reached');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Check an ABN or a business name</CardTitle>
        <CardDescription>The Australian Business Register, checked before a number goes on a registration.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              lookup();
            }}
            className="flex gap-2"
          >
            <Input value={abn} onChange={(e) => setAbn(e.target.value)} placeholder="ABN, e.g. 51 824 753 556" aria-label="ABN" inputMode="numeric" />
            <Button type="submit" disabled={busy || abn.replace(/\D/g, '').length < 11}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Look up'}
            </Button>
          </form>
          {problem && <p className="text-sm text-red-600">{problem}</p>}
          {result && !result.valid && (
            <p className="inline-flex items-center gap-1 text-sm text-red-600">
              <XCircle className="h-4 w-4" /> That number does not pass the ABN checksum.
            </p>
          )}
          {result && result.valid && (
            <div className="space-y-2 text-sm">
              <p className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> {result.formatted} is a well-formed ABN.
              </p>
              {!result.configured && (
                <p className="text-muted-foreground">
                  Live lookup is not switched on here.{' '}
                  <a href={result.lookupUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
                    Open it on the ABR <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              )}
              {result.configured && !result.entity && <p className="text-muted-foreground">The register has no record under that ABN.</p>}
              {result.entity && (
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="font-medium">{result.entity.entityName || 'Unnamed entity'}</p>
                  <p className="text-xs text-muted-foreground">
                    {result.entity.entityType}
                    {result.entity.acn ? ` · ACN ${result.entity.acn}` : ''}
                    {result.entity.state ? ` · ${result.entity.state} ${result.entity.postcode ?? ''}` : ''}
                  </p>
                  <p className="mt-1 text-xs">
                    ABN {result.entity.abnStatus.toLowerCase()}
                    {result.entity.abnStatusFrom ? ` from ${result.entity.abnStatusFrom}` : ''}
                    {result.entity.gstRegisteredFrom ? ` · registered for GST from ${result.entity.gstRegisteredFrom}` : ' · not registered for GST'}
                  </p>
                  {result.entity.businessNames.length > 0 && <p className="mt-1 text-xs">Trading as: {result.entity.businessNames.join(', ')}</p>}
                  {onUse && (
                    <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => onUse(result.entity!)}>
                      Use these details
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="A business name you are considering" aria-label="Business name" />
          <AbnNameCheck name={name} />
        </div>
      </CardContent>
    </Card>
  );
}
