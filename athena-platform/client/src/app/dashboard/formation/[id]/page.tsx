'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useFormation, useSubmitFormation, useUpdateFormation } from '@/lib/hooks';
import { formatRelativeTime } from '@/lib/utils';

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

export default function FormationDetailPage() {
  const params = useParams();
  const id = (params?.id as string) || '';

  const { data: formation, isLoading } = useFormation(id);
  const submitMutation = useSubmitFormation();
  const updateMutation = useUpdateFormation();

  const initialBusinessName = useMemo(() => {
    return formation?.businessName || formation?.data?.businessName || '';
  }, [formation]);

  const initialCompanyFields = useMemo(() => {
    const data = asRecord(formation?.data);

    const directorsRaw = data.directors;
    const directorsArray = Array.isArray(directorsRaw) ? directorsRaw : [];
    const directorsText = directorsArray
      .map((d) => {
        if (typeof d === 'string') return d;
        const asObj = asRecord(d);
        return typeof asObj.name === 'string' ? asObj.name : '';
      })
      .map((s) => s.trim())
      .filter(Boolean)
      .join('\n');

    const addressRaw =
      asRecord(data.registeredAddress).line1 ||
      asRecord(data.businessAddress).line1 ||
      asRecord(data.principalPlaceOfBusiness).line1 ||
      asRecord(data.address).line1
        ? (asRecord(data.registeredAddress) as Record<string, unknown>)
        : (asRecord(data.registeredAddress) as Record<string, unknown>);

    const addr = asRecord(addressRaw);

    return {
      directorsText,
      addressLine1: (typeof addr.line1 === 'string' ? addr.line1 : '') as string,
      addressCity: (typeof addr.city === 'string' ? addr.city : '') as string,
      addressState: (typeof addr.state === 'string' ? addr.state : '') as string,
      addressPostcode: (typeof addr.postcode === 'string' ? addr.postcode : '') as string,
      addressCountry: (typeof addr.country === 'string' ? addr.country : '') as string,
    };
  }, [formation]);

  const initialPartnershipFields = useMemo(() => {
    const data = asRecord(formation?.data);
    const partnersRaw = data.partners;
    const partnersArray = Array.isArray(partnersRaw) ? partnersRaw : [];
    const partnersText = partnersArray
      .map((p) => {
        if (typeof p === 'string') return p;
        const asObj = asRecord(p);
        return typeof asObj.name === 'string' ? asObj.name : '';
      })
      .map((s) => s.trim())
      .filter(Boolean)
      .join('\n');

    return { partnersText };
  }, [formation]);

  const initialTrustFields = useMemo(() => {
    const data = asRecord(formation?.data);
    const trusteesRaw = data.trustees;
    const trusteesArray = Array.isArray(trusteesRaw) ? trusteesRaw : [];
    const trusteesText = trusteesArray
      .map((t) => {
        if (typeof t === 'string') return t;
        const asObj = asRecord(t);
        return typeof asObj.name === 'string' ? asObj.name : '';
      })
      .map((s) => s.trim())
      .filter(Boolean)
      .join('\n');

    return { trusteesText };
  }, [formation]);

  const [businessName, setBusinessName] = useState('');
  const [directorsText, setDirectorsText] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [addressPostcode, setAddressPostcode] = useState('');
  const [addressCountry, setAddressCountry] = useState('');
  const [partnersText, setPartnersText] = useState('');
  const [trusteesText, setTrusteesText] = useState('');

  useEffect(() => {
    setBusinessName(initialBusinessName);
  }, [initialBusinessName]);

  useEffect(() => {
    setDirectorsText(initialCompanyFields.directorsText);
    setAddressLine1(initialCompanyFields.addressLine1);
    setAddressCity(initialCompanyFields.addressCity);
    setAddressState(initialCompanyFields.addressState);
    setAddressPostcode(initialCompanyFields.addressPostcode);
    setAddressCountry(initialCompanyFields.addressCountry);
  }, [initialCompanyFields]);

  useEffect(() => {
    setPartnersText(initialPartnershipFields.partnersText);
  }, [initialPartnershipFields]);

  useEffect(() => {
    setTrusteesText(initialTrustFields.trusteesText);
  }, [initialTrustFields]);

  const canEdit = formation?.status === 'DRAFT' || formation?.status === 'NEEDS_INFO';
  const canSubmit = canEdit;

  const observations = useMemo(() => {
    const isCompany = formation?.type === 'COMPANY';
    const isPartnership = formation?.type === 'PARTNERSHIP';
    const isTrust = formation?.type === 'TRUST';
    const isSoleTrader = formation?.type === 'SOLE_TRADER';

    const businessNameOk = businessName.trim().length > 0;

    const directorsCount = directorsText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean).length;

    const partnersCount = partnersText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean).length;

    const trusteesCount = trusteesText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean).length;

    const addressOk =
      addressLine1.trim().length > 0 ||
      addressCity.trim().length > 0 ||
      addressState.trim().length > 0 ||
      addressPostcode.trim().length > 0 ||
      addressCountry.trim().length > 0;

    const missing: string[] = [];
    if (!businessNameOk) missing.push('Business name');
    if (isCompany) {
      if (directorsCount === 0) missing.push('At least 1 director');
      if (!addressOk) missing.push('Registered address');
    }
    if (isPartnership) {
      if (partnersCount === 0) missing.push('At least 1 partner');
    }
    if (isTrust) {
      if (trusteesCount === 0) missing.push('At least 1 trustee');
    }

    const notes: string[] = [];
    if (isSoleTrader) {
      notes.push('Sole Trader: currently only business name is required for submission.');
    }
    if (!canEdit) {
      notes.push('This registration is not editable in its current status.');
    }

    const checks: { label: string; ok: boolean }[] = [{
      label: 'Business name',
      ok: businessNameOk,
    }];
    if (isCompany) {
      checks.push({ label: 'At least 1 director', ok: directorsCount > 0 });
      checks.push({ label: 'Registered address', ok: addressOk });
    }
    if (isPartnership) {
      checks.push({ label: 'At least 1 partner', ok: partnersCount > 0 });
    }
    if (isTrust) {
      checks.push({ label: 'At least 1 trustee', ok: trusteesCount > 0 });
    }

    return {
      checks,
      missing,
      notes,
      isCompany,
      isPartnership,
      isTrust,
      isSoleTrader,
    };
  }, [
    formation?.type,
    canEdit,
    businessName,
    directorsText,
    partnersText,
    trusteesText,
    addressLine1,
    addressCity,
    addressState,
    addressPostcode,
    addressCountry,
  ]);

  const handleSave = async () => {
    const existingData = asRecord(formation?.data);

    const isCompany = formation?.type === 'COMPANY';
    const isPartnership = formation?.type === 'PARTNERSHIP';
    const isTrust = formation?.type === 'TRUST';

    const directors = directorsText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    const partners = partnersText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    const trustees = trusteesText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    const registeredAddress: Record<string, string> = {
      line1: addressLine1.trim(),
      city: addressCity.trim(),
      state: addressState.trim(),
      postcode: addressPostcode.trim(),
      country: addressCountry.trim(),
    };

    await updateMutation.mutateAsync({
      id,
      data: {
        ...existingData,
        businessName,
        ...(isCompany
          ? {
              directors,
              registeredAddress,
            }
          : null),
        ...(isPartnership
          ? {
              partners,
            }
          : null),
        ...(isTrust
          ? {
              trustees,
            }
          : null),
      },
    });
  };

  const handleSubmit = async () => {
    if (canEdit) {
      await handleSave();
    }
    await submitMutation.mutateAsync(id);
  };

  if (isLoading) {
    return <div className="py-8 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!formation) {
    return (
      <div className="py-8 space-y-4">
        <p className="text-sm text-muted-foreground">Registration not found.</p>
        <Link href="/dashboard/formation" className="text-sm text-primary hover:underline">
          Back to Formation Studio
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link href="/dashboard/formation" className="text-sm text-primary hover:underline">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold">{formation.businessName || 'Untitled registration'}</h1>
          <p className="text-sm text-muted-foreground">
            {formation.type} • Status: {formation.status}
            {formation.updatedAt ? ` • Updated ${formatRelativeTime(formation.updatedAt)}` : ''}
          </p>
        </div>
        <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">{formation.status}</span>
      </div>

      <div className="border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">Business name</h2>
        <div className="space-y-2">
          <label className="text-sm font-medium">Name</label>
          <input
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            disabled={!canEdit || updateMutation.isPending}
            className="w-full p-2 border rounded-md disabled:opacity-50"
            placeholder="e.g. Athena Consulting"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canEdit || updateMutation.isPending}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Saving…' : 'Save'}
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitMutation.isPending || updateMutation.isPending}
            className="px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {submitMutation.isPending ? 'Submitting…' : 'Submit'}
          </button>
        </div>

        {!canSubmit && (
          <p className="text-xs text-muted-foreground">
            This registration can’t be submitted in its current status.
          </p>
        )}
      </div>

      <div className="border rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-semibold">Observations</h2>

        {observations.notes.length > 0 && (
          <div className="text-sm text-muted-foreground space-y-1">
            {observations.notes.map((n) => (
              <div key={n}>{n}</div>
            ))}
          </div>
        )}

        <div className="grid gap-2">
          {observations.checks.map((c) => (
            <div key={c.label} className="flex items-center justify-between gap-4">
              <span className="text-sm">{c.label}</span>
              <span className="text-sm">{c.ok ? '✓' : '—'}</span>
            </div>
          ))}
        </div>

        {observations.missing.length === 0 ? (
          <p className="text-sm text-muted-foreground">Looks ready to submit.</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Likely to fail submission until fixed: {observations.missing.join(', ')}.
          </p>
        )}
      </div>

      {formation.type === 'COMPANY' && (
        <div className="border rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">Company minimum fields</h2>
          <p className="text-sm text-muted-foreground">
            Directors and a registered address are required before submission.
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium">Directors (one per line)</label>
            <textarea
              value={directorsText}
              onChange={(e) => setDirectorsText(e.target.value)}
              disabled={!canEdit || updateMutation.isPending}
              className="w-full min-h-24 p-2 border rounded-md disabled:opacity-50"
              placeholder="Jane Doe\nAisha Khan"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Address line 1</label>
              <input
                type="text"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                disabled={!canEdit || updateMutation.isPending}
                className="w-full p-2 border rounded-md disabled:opacity-50"
                placeholder="123 Example St"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">City</label>
              <input
                type="text"
                value={addressCity}
                onChange={(e) => setAddressCity(e.target.value)}
                disabled={!canEdit || updateMutation.isPending}
                className="w-full p-2 border rounded-md disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">State</label>
              <input
                type="text"
                value={addressState}
                onChange={(e) => setAddressState(e.target.value)}
                disabled={!canEdit || updateMutation.isPending}
                className="w-full p-2 border rounded-md disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Postcode</label>
              <input
                type="text"
                value={addressPostcode}
                onChange={(e) => setAddressPostcode(e.target.value)}
                disabled={!canEdit || updateMutation.isPending}
                className="w-full p-2 border rounded-md disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Country</label>
              <input
                type="text"
                value={addressCountry}
                onChange={(e) => setAddressCountry(e.target.value)}
                disabled={!canEdit || updateMutation.isPending}
                className="w-full p-2 border rounded-md disabled:opacity-50"
                placeholder="Australia"
              />
            </div>
          </div>
        </div>
      )}

      {formation.type === 'PARTNERSHIP' && (
        <div className="border rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">Partnership minimum fields</h2>
          <p className="text-sm text-muted-foreground">
            Partner details are required before submission.
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium">Partners (one per line)</label>
            <textarea
              value={partnersText}
              onChange={(e) => setPartnersText(e.target.value)}
              disabled={!canEdit || updateMutation.isPending}
              className="w-full min-h-24 p-2 border rounded-md disabled:opacity-50"
              placeholder="Jane Doe\nAisha Khan"
            />
          </div>
        </div>
      )}

      {formation.type === 'TRUST' && (
        <div className="border rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">Trust minimum fields</h2>
          <p className="text-sm text-muted-foreground">
            Trustee details are required before submission.
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium">Trustees (one per line)</label>
            <textarea
              value={trusteesText}
              onChange={(e) => setTrusteesText(e.target.value)}
              disabled={!canEdit || updateMutation.isPending}
              className="w-full min-h-24 p-2 border rounded-md disabled:opacity-50"
              placeholder="Jane Doe\nAisha Khan"
            />
          </div>
        </div>
      )}

      <div className="border rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-semibold">Raw data</h2>
        <pre className="text-xs bg-slate-50 border rounded-md p-4 overflow-auto">
          {JSON.stringify(formation.data ?? {}, null, 2)}
        </pre>
      </div>
    </div>
  );
}
