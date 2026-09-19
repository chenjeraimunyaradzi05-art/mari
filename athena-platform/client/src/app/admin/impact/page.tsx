'use client';

/**
 * The impact catalogues, from the platform's side. The programs, bridging
 * courses, DV services, partners and First Nations pages that the impact
 * dashboards show are entered here by staff from the providers' own public
 * listings. Nothing is seeded: every list starts empty and only holds what
 * someone checked and typed in.
 */

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowUp, HeartHandshake, Loader2, Plus, Trash2, X } from 'lucide-react';
import { adminImpactApi } from '@/lib/impact-api';
import { cn } from '@/lib/utils';

// ------------------------------------------------------------------ types

type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'date' | 'lines' | 'multiselect' | 'url' | 'email' | 'tel';
type Option = { value: string; label: string };
type Field = {
  name: string;
  label: string;
  type: FieldType;
  options?: Option[];
  required?: boolean;
  /** An empty select clears the value (sent as null) instead of being left out. */
  clearable?: boolean;
  help?: string;
  placeholder?: string;
};
type Row = { id: string; [key: string]: unknown };
type Column = { label: string; render: (row: Row) => ReactNode };
type Values = Record<string, string | boolean | string[]>;
type ListResponse = { data?: { data?: unknown } };

type Catalogue = {
  key: string;
  title: string;
  blurb: string;
  nameOf: (row: Row) => string;
  fields: Field[];
  columns: Column[];
  list: () => Promise<ListResponse>;
  create: (body: Record<string, unknown>) => Promise<ListResponse>;
  update: (id: string, body: Record<string, unknown>) => Promise<ListResponse>;
  /** Retire (soft) or remove (hard), whichever the server does for this catalogue. */
  end: (id: string) => Promise<unknown>;
  endLabel: string;
  endConfirm: string;
  isEnded?: (row: Row) => boolean;
  empty: string;
  /** Extra editor shown beneath the form once the row exists (milestones). */
  extra?: (row: Row) => ReactNode;
};

// ---------------------------------------------------------------- options

const COMMUNITY_TYPES: Option[] = [
  { value: 'FIRST_NATIONS', label: 'First Nations' },
  { value: 'REFUGEE_IMMIGRANT', label: 'Refugee and immigrant' },
  { value: 'DV_SURVIVOR', label: 'DV survivor' },
  { value: 'DISABILITY', label: 'Disability' },
  { value: 'LGBTQIA', label: 'LGBTQIA+' },
  { value: 'SINGLE_PARENT', label: 'Single parent' },
  { value: 'RURAL_REGIONAL', label: 'Rural and regional' },
  { value: 'GENERAL', label: 'General' },
];
const REGIONS: Option[] = [
  { value: 'ANZ', label: 'Australia and New Zealand' },
  { value: 'SEA', label: 'South-East Asia' },
  { value: 'UK', label: 'United Kingdom' },
  { value: 'EU', label: 'Europe' },
  { value: 'US', label: 'United States' },
  { value: 'MEA', label: 'Middle East and Africa' },
  { value: 'ROW', label: 'Rest of world' },
];
const DV_TYPES: Option[] = [
  { value: 'CRISIS', label: 'Crisis line' },
  { value: 'LEGAL', label: 'Legal' },
  { value: 'FINANCIAL', label: 'Financial' },
  { value: 'HOUSING', label: 'Housing' },
  { value: 'COUNSELING', label: 'Counselling' },
  { value: 'CHILDREN', label: 'Children' },
];
const AU_STATES: Option[] = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT', 'NT'].map((s) => ({ value: s, label: s }));
const PARTNER_TYPES: Option[] = [
  { value: 'GOVERNMENT', label: 'Government' },
  { value: 'NGO', label: 'Not-for-profit' },
  { value: 'CORPORATE', label: 'Corporate' },
  { value: 'COMMUNITY', label: 'Community organisation' },
];
const RESOURCE_TYPES: Option[] = [
  { value: 'FUNDING', label: 'Funding' },
  { value: 'MENTORSHIP', label: 'Mentorship' },
  { value: 'JOB_BOARD', label: 'Jobs' },
  { value: 'TRAINING', label: 'Training' },
  { value: 'CULTURAL', label: 'Cultural' },
];

const labelOf = (options: Option[], value: unknown) => options.find((o) => o.value === value)?.label ?? String(value ?? '');
const count = (row: Row, key: string) => ((row._count as Record<string, number> | undefined)?.[key] ?? 0);
const errorMessage = (error: unknown) => {
  const data = (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
  return data?.message || data?.error;
};
const rowsOf = (res: ListResponse): Row[] => (Array.isArray(res.data?.data) ? (res.data!.data as Row[]) : []);

// ------------------------------------------------------- form conversions

function toValues(row: Row | null, fields: Field[]): Values {
  const values: Values = {};
  for (const field of fields) {
    const raw = row?.[field.name];
    switch (field.type) {
      case 'checkbox':
        values[field.name] = Boolean(raw);
        break;
      case 'multiselect':
        values[field.name] = Array.isArray(raw) ? raw.map(String) : [];
        break;
      case 'lines':
        values[field.name] = Array.isArray(raw) ? raw.map(String).join('\n') : '';
        break;
      case 'date':
        values[field.name] = typeof raw === 'string' ? raw.slice(0, 10) : '';
        break;
      default:
        values[field.name] = raw === null || raw === undefined ? '' : String(raw);
    }
  }
  return values;
}

function toBody(values: Values, fields: Field[]): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field.name];
    switch (field.type) {
      case 'checkbox':
        body[field.name] = Boolean(value);
        break;
      case 'multiselect':
        body[field.name] = Array.isArray(value) ? value : [];
        break;
      case 'lines':
        body[field.name] = String(value ?? '')
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        break;
      case 'number': {
        const text = String(value ?? '').trim();
        body[field.name] = text === '' ? null : Number(text);
        break;
      }
      case 'select': {
        const text = String(value ?? '');
        if (text !== '') body[field.name] = text;
        else if (field.clearable) body[field.name] = null;
        break;
      }
      case 'date': {
        const text = String(value ?? '').trim();
        body[field.name] = text === '' ? null : text;
        break;
      }
      default: {
        const text = String(value ?? '').trim();
        if (field.required) body[field.name] = text;
        else body[field.name] = text === '' ? null : text;
      }
    }
  }
  return body;
}

// ------------------------------------------------------------ form fields

function FieldInput({ id, field, value, onChange }: { id: string; field: Field; value: string | boolean | string[]; onChange: (next: string | boolean | string[]) => void }) {
  const base = 'input w-full text-sm';
  if (field.type === 'checkbox') {
    return (
      <label htmlFor={id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
        <input id={id} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
        {field.label}
        {field.help && <span className="text-xs text-slate-500">{field.help}</span>}
      </label>
    );
  }
  const labelled = (control: ReactNode) => (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {field.label}
        {field.required && <span aria-hidden="true"> *</span>}
      </label>
      {control}
      {field.help && <p className="mt-1 text-xs text-slate-500">{field.help}</p>}
    </div>
  );
  if (field.type === 'textarea' || field.type === 'lines') {
    return labelled(
      <textarea id={id} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} rows={field.type === 'lines' ? 4 : 3} required={field.required} placeholder={field.placeholder} className={base} />
    );
  }
  if (field.type === 'select') {
    return labelled(
      <select id={id} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} required={field.required} className={base}>
        <option value="">{field.required ? 'Choose…' : 'None'}</option>
        {(field.options ?? []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === 'multiselect') {
    const chosen = Array.isArray(value) ? value : [];
    return (
      <fieldset>
        <legend className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{field.label}</legend>
        <div className="flex flex-wrap gap-2">
          {(field.options ?? []).map((o) => {
            const optionId = `${id}-${o.value}`;
            const on = chosen.includes(o.value);
            return (
              <label key={o.value} htmlFor={optionId} className={cn('cursor-pointer rounded-full border px-3 py-1 text-xs', on ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-300 text-slate-600')}>
                <input id={optionId} type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked ? [...chosen, o.value] : chosen.filter((v) => v !== o.value))} className="sr-only" />
                {o.label}
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }
  const inputType = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text';
  return labelled(
    <input id={id} type={inputType} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} required={field.required} placeholder={field.placeholder} className={base} min={field.type === 'number' ? 0 : undefined} />
  );
}

// ------------------------------------------------------------- catalogue

function CatalogueSection({ spec }: { spec: Catalogue }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [values, setValues] = useState<Values>(() => toValues(null, spec.fields));

  const list = useQuery({ queryKey: ['admin-impact', spec.key], queryFn: spec.list, select: rowsOf });
  const rows = list.data ?? [];
  const current = editing === 'new' ? null : editing ? (rows.find((r) => r.id === editing.id) ?? editing) : null;

  const open = (row: Row | 'new') => {
    setEditing(row);
    setValues(toValues(row === 'new' ? null : row, spec.fields));
  };
  const close = () => setEditing(null);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => (current ? spec.update(current.id, body) : spec.create(body)),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-impact', spec.key] });
      toast.success('Saved.');
      const saved = res.data?.data as Row | undefined;
      if (saved?.id) setEditing(saved);
      else close();
    },
    onError: (e) => toast.error(errorMessage(e) || 'Could not save that'),
  });

  const end = useMutation({
    mutationFn: (id: string) => spec.end(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-impact', spec.key] });
      toast.success('Done.');
      close();
    },
    onError: (e) => toast.error(errorMessage(e) || 'Could not do that'),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(toBody(values, spec.fields));
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{spec.title}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">{spec.blurb}</p>
        </div>
        <button type="button" onClick={() => open('new')} className="btn-primary inline-flex items-center gap-1 py-2 text-sm">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      <div className={cn('grid gap-6', editing ? 'lg:grid-cols-[minmax(0,1fr)_420px]' : 'grid-cols-1')}>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {list.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : rows.length === 0 ? (
            <p className="p-10 text-center text-slate-500">{spec.empty}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                <tr>
                  {spec.columns.map((c) => (
                    <th key={c.label} className="px-4 py-2">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row) => (
                  <tr key={row.id} onClick={() => open(row)} className={cn('cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800', current?.id === row.id && 'bg-rose-50 dark:bg-rose-900/20', spec.isEnded?.(row) && 'opacity-60')}>
                    {spec.columns.map((c) => (
                      <td key={c.label} className="px-4 py-2 align-top text-slate-700 dark:text-slate-300">
                        {c.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {editing && (
          <aside className="card relative h-fit space-y-4 lg:sticky lg:top-6">
            <button type="button" onClick={close} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
            <h3 className="pr-8 text-base font-semibold text-slate-900 dark:text-white">{current ? spec.nameOf(current) : `New ${spec.title.toLowerCase().replace(/s$/, '')}`}</h3>
            <form onSubmit={submit} className="space-y-3">
              {spec.fields.map((field) => (
                <FieldInput key={field.name} id={`${spec.key}-${field.name}`} field={field} value={values[field.name]} onChange={(next) => setValues((v) => ({ ...v, [field.name]: next }))} />
              ))}
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="submit" disabled={save.isPending} className="btn-primary py-2 text-sm">
                  {save.isPending ? 'Saving…' : current ? 'Save changes' : 'Add it'}
                </button>
                {current && !(spec.isEnded?.(current) ?? false) && (
                  <button
                    type="button"
                    disabled={end.isPending}
                    onClick={() => {
                      if (window.confirm(spec.endConfirm)) end.mutate(current.id);
                    }}
                    className="btn-secondary py-2 text-sm text-red-700"
                  >
                    {spec.endLabel}
                  </button>
                )}
              </div>
            </form>
            {current && spec.extra?.(current)}
          </aside>
        )}
      </div>
    </section>
  );
}

// ------------------------------------------------------------ milestones

type Milestone = { id: string; title: string; description?: string | null; orderIndex: number; requiredForCompletion: boolean };

function MilestonesEditor({ program }: { program: Row }) {
  const queryClient = useQueryClient();
  const milestones = useMemo(() => ((program.milestones as Milestone[] | undefined) ?? []).slice().sort((a, b) => a.orderIndex - b.orderIndex), [program.milestones]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [required, setRequired] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-impact', 'programs'] });
  const onError = (e: unknown) => toast.error(errorMessage(e) || 'Could not change that milestone');

  const add = useMutation({
    mutationFn: () => adminImpactApi.milestones.create(program.id, { title: title.trim(), description: description.trim() || null, requiredForCompletion: required }),
    onSuccess: () => {
      refresh();
      setTitle('');
      setDescription('');
      setRequired(false);
    },
    onError,
  });
  const toggle = useMutation({
    mutationFn: (m: Milestone) => adminImpactApi.milestones.update(m.id, { requiredForCompletion: !m.requiredForCompletion }),
    onSuccess: refresh,
    onError,
  });
  const moveUp = useMutation({
    mutationFn: async (index: number) => {
      const above = milestones[index - 1];
      const here = milestones[index];
      await adminImpactApi.milestones.update(here.id, { orderIndex: above.orderIndex });
      await adminImpactApi.milestones.update(above.id, { orderIndex: here.orderIndex === above.orderIndex ? above.orderIndex + 1 : here.orderIndex });
    },
    onSuccess: refresh,
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminImpactApi.milestones.remove(id),
    onSuccess: refresh,
    onError,
  });

  return (
    <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Milestones</h4>
      <p className="text-xs text-slate-500">The steps a member ticks off as she goes. Required ones must be done before the program counts as complete.</p>
      {milestones.length === 0 ? (
        <p className="text-sm text-slate-500">None yet.</p>
      ) : (
        <ol className="space-y-2">
          {milestones.map((m, index) => (
            <li key={m.id} className="flex items-start gap-2 rounded-lg bg-slate-50 p-2 text-sm dark:bg-slate-800">
              <span className="mt-0.5 w-5 text-xs text-slate-400">{index + 1}.</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900 dark:text-white">{m.title}</p>
                {m.description && <p className="text-xs text-slate-500">{m.description}</p>}
                <button type="button" onClick={() => toggle.mutate(m)} className={cn('mt-1 rounded-full px-2 py-0.5 text-xs', m.requiredForCompletion ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-600')}>
                  {m.requiredForCompletion ? 'Required' : 'Optional'}
                </button>
              </div>
              <button type="button" onClick={() => moveUp.mutate(index)} disabled={index === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-30" aria-label={`Move ${m.title} up`}>
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => remove.mutate(m.id)} className="text-slate-400 hover:text-red-600" aria-label={`Remove ${m.title}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ol>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) add.mutate();
        }}
        className="space-y-2"
      >
        <label htmlFor="milestone-title" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          New milestone
        </label>
        <input id="milestone-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={200} className="input w-full text-sm" />
        <label htmlFor="milestone-description" className="sr-only">
          Milestone description
        </label>
        <input id="milestone-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What it involves (optional)" maxLength={2000} className="input w-full text-sm" />
        <label htmlFor="milestone-required" className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input id="milestone-required" type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          Required to complete the program
        </label>
        <button type="submit" disabled={add.isPending || !title.trim()} className="btn-secondary py-1.5 text-sm">
          {add.isPending ? 'Adding…' : 'Add milestone'}
        </button>
      </form>
    </div>
  );
}

// ------------------------------------------------------------ catalogues

const programsSpec: Catalogue = {
  key: 'programs',
  title: 'Community support programs',
  blurb: 'Structured programs for a community, with milestones a member works through. Retired programs stay for the women already enrolled.',
  nameOf: (r) => String(r.name),
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'communityType', label: 'Community', type: 'select', options: COMMUNITY_TYPES, required: true },
    { name: 'description', label: 'Description', type: 'textarea', required: true },
    { name: 'eligibilityDesc', label: 'Who is eligible', type: 'textarea' },
    { name: 'objectives', label: 'Objectives', type: 'lines', help: 'One per line.' },
    { name: 'partnerOrgs', label: 'Partner organisations', type: 'lines', help: 'One per line.' },
    { name: 'fundingSource', label: 'Funded by', type: 'text' },
    { name: 'maxParticipants', label: 'Places', type: 'number', help: 'Leave empty for no cap.' },
    { name: 'startDate', label: 'Starts', type: 'date' },
    { name: 'endDate', label: 'Ends', type: 'date' },
    { name: 'region', label: 'Region', type: 'select', options: REGIONS },
    { name: 'isActive', label: 'Open for enrolment', type: 'checkbox' },
  ],
  columns: [
    { label: 'Program', render: (r) => <span className="font-medium text-slate-900 dark:text-white">{String(r.name)}</span> },
    { label: 'Community', render: (r) => labelOf(COMMUNITY_TYPES, r.communityType) },
    { label: 'Enrolled', render: (r) => `${count(r, 'enrollments')}${r.maxParticipants ? ` of ${r.maxParticipants}` : ''}` },
    { label: 'Milestones', render: (r) => String((r.milestones as unknown[] | undefined)?.length ?? 0) },
    { label: 'Status', render: (r) => (r.isActive ? 'Open' : 'Retired') },
  ],
  list: adminImpactApi.programs.list,
  create: adminImpactApi.programs.create,
  update: adminImpactApi.programs.update,
  end: adminImpactApi.programs.retire,
  endLabel: 'Retire',
  endConfirm: 'Retire this program? Women already enrolled keep it; nobody new can join.',
  isEnded: (r) => !r.isActive,
  empty: 'No programs yet. Add the first from the provider’s own listing.',
  extra: (row) => <MilestonesEditor program={row} />,
};

const bridgingSpec: Catalogue = {
  key: 'bridging',
  title: 'Bridging programs',
  blurb: 'Courses that take an overseas qualification to the Australian one, listed by profession so a credential can find them.',
  nameOf: (r) => String(r.name),
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'provider', label: 'Provider', type: 'text', required: true },
    { name: 'profession', label: 'Profession', type: 'text', required: true, placeholder: 'nursing, engineering, accounting…', help: 'A credential in that field is matched to this program by this word.' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'duration', label: 'Duration', type: 'text', placeholder: '12 weeks' },
    { name: 'cost', label: 'Cost (AUD)', type: 'number' },
    { name: 'fundingAvailable', label: 'Funding available', type: 'checkbox' },
    { name: 'url', label: 'Provider page', type: 'url' },
    { name: 'requirements', label: 'Requirements', type: 'lines', help: 'One per line.' },
    { name: 'outcomes', label: 'Outcomes', type: 'lines', help: 'One per line.' },
    { name: 'region', label: 'Region', type: 'select', options: REGIONS },
    { name: 'isActive', label: 'Listed', type: 'checkbox' },
  ],
  columns: [
    { label: 'Program', render: (r) => <span className="font-medium text-slate-900 dark:text-white">{String(r.name)}</span> },
    { label: 'Profession', render: (r) => String(r.profession) },
    { label: 'Provider', render: (r) => String(r.provider) },
    { label: 'Enrolled', render: (r) => String(count(r, 'enrollments')) },
    { label: 'Status', render: (r) => (r.isActive ? 'Listed' : 'Retired') },
  ],
  list: adminImpactApi.bridging.list,
  create: adminImpactApi.bridging.create,
  update: adminImpactApi.bridging.update,
  end: adminImpactApi.bridging.retire,
  endLabel: 'Retire',
  endConfirm: 'Retire this bridging program? Women already enrolled keep it.',
  isEnded: (r) => !r.isActive,
  empty: 'No bridging programs yet.',
};

const dvServicesSpec: Catalogue = {
  key: 'dv-services',
  title: 'DV support services',
  blurb: 'The lines and services a survivor sees on the safety pages. Check the number on the service’s own site before saving it.',
  nameOf: (r) => String(r.name),
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'type', label: 'Kind', type: 'select', options: DV_TYPES, required: true },
    { name: 'phone', label: 'Phone', type: 'tel', placeholder: '1800 737 732' },
    { name: 'website', label: 'Website', type: 'url' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'available24x7', label: 'Available 24/7', type: 'checkbox' },
    { name: 'state', label: 'State or territory', type: 'select', options: AU_STATES, clearable: true, help: 'Leave empty for a national service and tick national below.' },
    { name: 'isNational', label: 'National', type: 'checkbox' },
  ],
  columns: [
    { label: 'Service', render: (r) => <span className="font-medium text-slate-900 dark:text-white">{String(r.name)}</span> },
    { label: 'Kind', render: (r) => labelOf(DV_TYPES, r.type) },
    { label: 'Phone', render: (r) => String(r.phone ?? '–') },
    { label: 'Covers', render: (r) => (r.isNational ? 'National' : String(r.state ?? '–')) },
    { label: '24/7', render: (r) => (r.available24x7 ? 'Yes' : 'No') },
  ],
  list: adminImpactApi.dvServices.list,
  create: adminImpactApi.dvServices.create,
  update: adminImpactApi.dvServices.update,
  end: adminImpactApi.dvServices.remove,
  endLabel: 'Remove',
  endConfirm: 'Remove this service from the directory?',
  empty: 'No services yet. The safety pages fall back to the national lines until some are added.',
};

const partnersSpec: Catalogue = {
  key: 'partners',
  title: 'Impact partners',
  blurb: 'Organisations the platform works with on its impact programs.',
  nameOf: (r) => String(r.name),
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'type', label: 'Kind', type: 'select', options: PARTNER_TYPES, required: true },
    { name: 'focusAreas', label: 'Focus areas', type: 'multiselect', options: COMMUNITY_TYPES },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'website', label: 'Website', type: 'url' },
    { name: 'logoUrl', label: 'Logo image link', type: 'url' },
    { name: 'contactEmail', label: 'Contact email', type: 'email' },
    { name: 'contactPhone', label: 'Contact phone', type: 'tel' },
    { name: 'partnerSince', label: 'Partner since', type: 'date' },
    { name: 'region', label: 'Region', type: 'select', options: REGIONS },
    { name: 'isActive', label: 'Active', type: 'checkbox' },
  ],
  columns: [
    { label: 'Partner', render: (r) => <span className="font-medium text-slate-900 dark:text-white">{String(r.name)}</span> },
    { label: 'Kind', render: (r) => labelOf(PARTNER_TYPES, r.type) },
    { label: 'Focus', render: (r) => (Array.isArray(r.focusAreas) ? r.focusAreas.map((f) => labelOf(COMMUNITY_TYPES, f)).join(', ') : '') },
    { label: 'Status', render: (r) => (r.isActive ? 'Active' : 'Retired') },
  ],
  list: adminImpactApi.partners.list,
  create: adminImpactApi.partners.create,
  update: adminImpactApi.partners.update,
  end: adminImpactApi.partners.retire,
  endLabel: 'Retire',
  endConfirm: 'Retire this partner? Its record is kept.',
  isEnded: (r) => !r.isActive,
  empty: 'No partners recorded yet.',
};

const communitiesSpec: Catalogue = {
  key: 'communities',
  title: 'First Nations community pages',
  blurb: 'Women-only spaces by nation or region. The cultural protocols are shown to everyone who joins.',
  nameOf: (r) => String(r.name),
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'nation', label: 'Nation or traditional owner group', type: 'text' },
    { name: 'region', label: 'Region', type: 'text', placeholder: 'South East Queensland' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'culturalProtocols', label: 'Cultural protocols', type: 'textarea' },
    { name: 'coverImage', label: 'Cover image link', type: 'url' },
    { name: 'moderatorIds', label: 'Moderator member IDs', type: 'lines', help: 'One member ID per line.' },
    { name: 'isWomenOnly', label: 'Women only', type: 'checkbox' },
    { name: 'isVerified', label: 'Verified by the community', type: 'checkbox' },
  ],
  columns: [
    { label: 'Page', render: (r) => <span className="font-medium text-slate-900 dark:text-white">{String(r.name)}</span> },
    { label: 'Nation', render: (r) => String(r.nation ?? '–') },
    { label: 'Members', render: (r) => String(count(r, 'members')) },
    { label: 'Verified', render: (r) => (r.isVerified ? 'Yes' : 'No') },
  ],
  list: adminImpactApi.communities.list,
  create: adminImpactApi.communities.create,
  update: adminImpactApi.communities.update,
  end: adminImpactApi.communities.remove,
  endLabel: 'Remove',
  endConfirm: 'Remove this page? Only a page nobody has joined can go.',
  empty: 'No community pages yet.',
};

function FirstNationsTab() {
  const communities = useQuery({ queryKey: ['admin-impact', 'communities'], queryFn: adminImpactApi.communities.list, select: rowsOf });
  const options = useMemo(() => (communities.data ?? []).map((c) => ({ value: c.id, label: String(c.name) })), [communities.data]);

  const resourcesSpec = useMemo<Catalogue>(
    () => ({
      key: 'resources',
      title: 'First Nations resources',
      blurb: 'Funding, mentoring, jobs, training and cultural links, national or attached to one page.',
      nameOf: (r) => String(r.title),
      fields: [
        { name: 'title', label: 'Title', type: 'text', required: true },
        { name: 'type', label: 'Kind', type: 'select', options: RESOURCE_TYPES, required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'url', label: 'Link', type: 'url' },
        { name: 'partnerOrg', label: 'Organisation', type: 'text' },
        { name: 'communityId', label: 'Attached to page', type: 'select', options, clearable: true },
        { name: 'isNational', label: 'National', type: 'checkbox' },
      ],
      columns: [
        { label: 'Resource', render: (r) => <span className="font-medium text-slate-900 dark:text-white">{String(r.title)}</span> },
        { label: 'Kind', render: (r) => labelOf(RESOURCE_TYPES, r.type) },
        { label: 'Page', render: (r) => String((r.community as { name?: string } | null)?.name ?? (r.isNational ? 'National' : '–')) },
        { label: 'Organisation', render: (r) => String(r.partnerOrg ?? '–') },
      ],
      list: adminImpactApi.resources.list,
      create: adminImpactApi.resources.create,
      update: adminImpactApi.resources.update,
      end: adminImpactApi.resources.remove,
      endLabel: 'Remove',
      endConfirm: 'Remove this resource?',
      empty: 'No resources yet.',
    }),
    [options]
  );

  return (
    <div className="space-y-10">
      <CatalogueSection spec={communitiesSpec} />
      <CatalogueSection spec={resourcesSpec} />
    </div>
  );
}

// ------------------------------------------------------------------- page

const TABS = [
  { id: 'programs', label: 'Programs' },
  { id: 'bridging', label: 'Bridging' },
  { id: 'dv', label: 'DV services' },
  { id: 'partners', label: 'Partners' },
  { id: 'first-nations', label: 'First Nations' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export default function AdminImpactPage() {
  const [tab, setTab] = useState<Tab>('programs');

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Link href="/admin" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Admin
      </Link>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <HeartHandshake className="h-7 w-7 text-rose-600" /> Impact catalogues
        </h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">What the impact dashboards show. Everything here is entered by staff from the provider’s own public listing; nothing is invented. The overseas-credentials queue is on its own page.</p>
        <Link href="/admin/credentials" className="mt-1 inline-block text-sm text-primary-600 hover:underline">
          Open the credentials queue
        </Link>
      </div>

      <div role="tablist" aria-label="Catalogue" className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn('-mb-px border-b-2 px-3 py-2 text-sm font-medium', tab === t.id ? 'border-rose-600 text-rose-700 dark:text-rose-300' : 'border-transparent text-slate-500 hover:text-slate-700')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'programs' && <CatalogueSection spec={programsSpec} />}
      {tab === 'bridging' && <CatalogueSection spec={bridgingSpec} />}
      {tab === 'dv' && <CatalogueSection spec={dvServicesSpec} />}
      {tab === 'partners' && <CatalogueSection spec={partnersSpec} />}
      {tab === 'first-nations' && <FirstNationsTab />}
    </div>
  );
}
