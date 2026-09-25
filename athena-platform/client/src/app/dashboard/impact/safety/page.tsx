'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield, Loader2, Phone, Lock, AlertTriangle, Home } from 'lucide-react';
import { impactApi } from '@/lib/api';
import { SafeModeBanner } from '@/components/safety/SafeModeBanner';
import { safeHref } from '@/lib/safe-href';
import { QuickExitButton } from '../../safety/QuickExit';

type SafetyPlan = {
  id: string;
  emergencyContacts?: unknown;
  safeLocations?: unknown;
  warningTriggers?: unknown;
  exitStrategies?: unknown;
  importantDocs?: unknown;
  financialPlan?: unknown;
  legalContacts?: unknown;
  lastReviewedAt?: string;
};

/**
 * The seven things a safety plan holds, in the order a woman writing one
 * tends to think of them. The key is the column on SafetyPlan; the server
 * accepts all seven and stores each as a list of lines.
 *
 * Four of them — warning triggers, documents, money and legal contacts — had
 * no input on this page at all, so the column existed, the server accepted it
 * and there was no way to put anything in it.
 */
const PLAN_FIELDS = [
  {
    key: 'emergencyContacts',
    label: 'Emergency contacts',
    placeholder: 'Name - phone number - relationship',
    hint: 'People you would call. One per line.',
  },
  {
    key: 'safeLocations',
    label: 'Safe places',
    placeholder: 'An address, or enough to find it again',
    hint: 'Where you could go. One per line.',
  },
  {
    key: 'warningTriggers',
    label: 'Warning signs',
    placeholder: 'What happens before it gets worse',
    hint: 'The signs that tell you it is time to leave. One per line.',
  },
  {
    key: 'exitStrategies',
    label: 'Getting out',
    placeholder: 'The steps, in the order you would take them',
    hint: 'How you would leave. One per line.',
  },
  {
    key: 'importantDocs',
    label: 'Documents to take',
    placeholder: 'Passport, Medicare card, birth certificates',
    hint: 'What you would need with you, and where it is kept. One per line.',
  },
  {
    key: 'financialPlan',
    label: 'Money',
    placeholder: 'An account in your name only, cash put by, who holds it',
    hint: 'What you would have to live on. One per line.',
  },
  {
    key: 'legalContacts',
    label: 'Legal and police',
    placeholder: 'Solicitor, community legal centre, an officer you have spoken to',
    hint: 'Anyone official already involved. One per line.',
  },
] as const;

type PlanFieldKey = (typeof PLAN_FIELDS)[number]['key'];

type PlanDraft = Record<PlanFieldKey, string>;

const EMPTY_DRAFT = PLAN_FIELDS.reduce(
  (draft, field) => ({ ...draft, [field.key]: '' }),
  {} as PlanDraft
);

/**
 * A stored field back into lines. The column is Json and older rows may hold
 * a plain string rather than a list, so both are read; anything else reads as
 * empty rather than throwing on a page someone opened because she is afraid.
 */
function planLines(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split('\n').map((line) => line.trim()).filter(Boolean);
  }
  return [];
}

/**
 * An empty box has to erase what is stored, not leave it there.
 *
 * This sent `undefined` for a field the member had cleared, and Prisma reads
 * undefined in an update as "leave this alone" — so a safe address the abuser
 * had since found out about stayed in the record forever while the form
 * showed her an empty box. An empty list is a value, and it overwrites.
 */
function planPayload(draft: PlanDraft): Record<PlanFieldKey, string[]> {
  return PLAN_FIELDS.reduce(
    (payload, field) => ({ ...payload, [field.key]: planLines(draft[field.key]) }),
    {} as Record<PlanFieldKey, string[]>
  );
}

type DVService = {
  id: string;
  name: string;
  type: string;
  phone?: string;
  website?: string;
  description?: string;
  available24x7: boolean;
  state?: string;
  isNational: boolean;
  /**
   * 'catalogue' is a service ATHENA staff entered and stand behind.
   * 'built-in' is one of the nationally published numbers the server always
   * sends, so this page is never empty. The distinction is shown, because a
   * woman deserves to know which of these ATHENA has actually checked.
   */
  source?: 'catalogue' | 'built-in';
};

const serviceTypeLabels: Record<string, string> = {
  CRISIS: 'Crisis Line',
  LEGAL: 'Legal Support',
  FINANCIAL: 'Financial Aid',
  HOUSING: 'Housing',
  COUNSELING: 'Counseling',
  CHILDREN: 'Children Services',
};

/**
 * One support service, however it got here. Written once so the built-in
 * national numbers are as easy to call as anything staff entered — the only
 * difference between them is the label saying which is which.
 */
function ServiceCard({ service }: { service: DVService }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-red-600">
          {serviceTypeLabels[service.type] || service.type}
        </span>
        <div className="flex items-center gap-2">
          {service.available24x7 && (
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">24/7</span>
          )}
          {service.isNational && (
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 px-2 py-1 rounded-full">
              National
            </span>
          )}
          {service.state && !service.isNational && (
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 px-2 py-1 rounded-full">
              {service.state}
            </span>
          )}
          {service.source === 'built-in' && (
            <span
              title="A publicly published crisis line that ATHENA always shows. It is not a local service ATHENA staff have checked."
              className="text-xs bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200 px-2 py-1 rounded-full"
            >
              Published line
            </span>
          )}
        </div>
      </div>

      <h3 className="font-semibold text-slate-900 dark:text-white">{service.name}</h3>

      {service.description && (
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{service.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-3 mt-4">
        {service.phone && (
          <a
            href={`tel:${service.phone.replace(/\s/g, '')}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-red-600 hover:underline"
          >
            <Phone className="w-4 h-4" /> {service.phone}
          </a>
        )}
        {service.website && (
          <a
            href={safeHref(service.website)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            Visit website
          </a>
        )}
      </div>
    </div>
  );
}

export default function SafetyPage() {
  const [safetyPlan, setSafetyPlan] = useState<SafetyPlan | null>(null);
  const [services, setServices] = useState<DVService[]>([]);
  // The nationally published numbers the server always sends. They are held
  // separately from `services` so the type filter above narrows only what
  // staff entered: filtering to Housing must never take the crisis lines off
  // a page someone opened because she is frightened.
  const [fallback, setFallback] = useState<DVService[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [serviceType, setServiceType] = useState('');
  const [error, setError] = useState<string | null>(null);

  // What is in the boxes right now. Filled from the saved plan every time it
  // loads, because "Update plan" used to open three empty boxes over a plan
  // she had already written, and saving from there wiped what she could not
  // see.
  const [draft, setDraft] = useState<PlanDraft>(EMPTY_DRAFT);

  const hydrateDraft = (plan: SafetyPlan | null) => {
    setDraft(
      PLAN_FIELDS.reduce(
        (next, field) => ({ ...next, [field.key]: planLines(plan?.[field.key]).join('\n') }),
        {} as PlanDraft
      )
    );
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [planRes, servicesRes] = await Promise.all([
        impactApi.getSafetyPlan(),
        impactApi.getDVServices({ type: serviceType || undefined }),
      ]);
      const plan: SafetyPlan | null = planRes.data?.data || null;
      setSafetyPlan(plan);
      hydrateDraft(plan);
      setServices(servicesRes.data?.data || []);
      setFallback(servicesRes.data?.fallback || []);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType]);

  const handleSavePlan = async () => {
    setSaving(true);
    setError(null);
    try {
      await impactApi.saveSafetyPlan(planPayload(draft));
      setShowPlanForm(false);
      await loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to save safety plan');
    } finally {
      setSaving(false);
    }
  };

  const planHasContent = PLAN_FIELDS.some((field) => planLines(safetyPlan?.[field.key]).length > 0);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/*
        This is the page where she writes down her safe addresses and her way
        out. Quick exit belonged here before it belonged anywhere, and it was
        on the settings page instead.
      */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-red-600">
            <Shield className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Safety Planning</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-2">
            DV Survivor Support
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Safety planning tools and support services
          </p>
        </div>
        <QuickExitButton />
      </div>

      <SafeModeBanner />

      {/* Safe housing: DV-safe places are checked by staff and shown only to members with Safe Mode on or a verified account. */}
      <Link
        href="/dashboard/housing?dvSafe=true"
        className="flex items-start gap-3 rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900 hover:bg-purple-100 dark:border-purple-900/50 dark:bg-purple-900/20 dark:text-purple-100"
      >
        <Home className="mt-0.5 h-5 w-5 flex-shrink-0" />
        <span>
          <span className="font-semibold">Safe housing.</span> DV-safe, emergency and transitional places, checked by ATHENA staff and shown only to members with Safe Mode on or a verified account. The address stays hidden until the lister answers you, and they see you as an alias, not your name.
        </span>
      </Link>

      {/* Emergency Banner */}
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">
              If you are in immediate danger
            </h2>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              Call 000 (Australia) or your local emergency number immediately.
            </p>
            <div className="flex flex-wrap gap-4 mt-4">
              <a href="tel:1800737732" className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                <Phone className="w-4 h-4" /> 1800RESPECT (1800 737 732)
              </a>
              <a href="tel:131114" className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50">
                <Phone className="w-4 h-4" /> Lifeline (13 11 14)
              </a>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading...
        </div>
      ) : (
        <>
          {/* Safety Plan */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Lock className="w-5 h-5" /> My Safety Plan
              </h2>
              <button onClick={() => setShowPlanForm(!showPlanForm)} className="btn-primary text-sm">
                {safetyPlan ? 'Update' : 'Create'} plan
              </button>
            </div>

            {/*
              This said "private and encrypted". Nothing encrypts it — the
              columns are plain Json and the schema comment saying otherwise
              was aspirational. Telling a woman her safe addresses are
              encrypted when they are not is the kind of claim she would make
              a decision on, so it says what is actually true: nobody else
              reaches it through ATHENA, and it lives in our database.
            */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4 text-sm text-yellow-800 dark:text-yellow-200">
              <Lock className="w-4 h-4 inline mr-2" />
              Your safety plan is yours alone. No one else on ATHENA can open it — not other members, not staff. It is stored on ATHENA&rsquo;s servers, so put in it only what you would be comfortable having there, and clear anything that stops being safe to keep.
            </div>

            {showPlanForm && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 mb-4 space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Every box is optional. Emptying one and saving deletes what was in it.
                </p>
                {PLAN_FIELDS.map((field) => (
                  <div key={field.key}>
                    <label
                      htmlFor={`plan-${field.key}`}
                      className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      {field.label}
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{field.hint}</p>
                    <textarea
                      id={`plan-${field.key}`}
                      value={draft[field.key]}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      rows={3}
                      className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                ))}
                <div className="flex gap-2">
                  <button onClick={handleSavePlan} disabled={saving} className="btn-primary">
                    {saving ? 'Saving...' : 'Save plan'}
                  </button>
                  <button
                    onClick={() => {
                      hydrateDraft(safetyPlan);
                      setShowPlanForm(false);
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/*
              Her plan, read back to her. This used to render three cards
              saying "Configured" whether or not the field held anything, and
              the contents were never shown anywhere — so a plan she wrote
              once she could never read again, and a field she thought she had
              filled in looked identical to one she had not.
            */}
            {safetyPlan && !showPlanForm && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
                {planHasContent ? (
                  PLAN_FIELDS.map((field) => {
                    const lines = planLines(safetyPlan[field.key]);
                    if (lines.length === 0) return null;
                    return (
                      <div key={field.key}>
                        <h3 className="text-sm font-medium text-slate-900 dark:text-white">{field.label}</h3>
                        <ul className="mt-2 space-y-1">
                          {lines.map((line, index) => (
                            <li
                              key={`${field.key}-${index}`}
                              className="text-sm text-slate-600 dark:text-slate-300 break-words"
                            >
                              {line}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Your plan is empty. Press Update to write one — or leave it empty, which is also a decision.
                  </p>
                )}
                {safetyPlan.lastReviewedAt && (
                  <p className="text-xs text-slate-500">
                    Last saved: {new Date(safetyPlan.lastReviewedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Support Services */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Support Services
              </h2>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
              >
                <option value="">All services</option>
                {Object.entries(serviceTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {services.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((service) => (
                  <ServiceCard key={service.id} service={service} />
                ))}
              </div>
            )}

            {/*
              Never an empty list. A woman opens this page because something
              is wrong at home, and "No services found" is the last thing she
              should read. The local directory is filled in by staff and may
              well be empty; the national lines below are always here, and are
              shown as what they are rather than dressed up as local services
              ATHENA has checked.
            */}
            {fallback.length > 0 && (
              <div className={services.length > 0 ? 'mt-6' : ''}>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {services.length === 0 ? 'Who you can call right now' : 'Always available'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">
                  {services.length === 0
                    ? 'ATHENA has no checked local services to show here yet. These lines are open now, and the people who answer them do this every day.'
                    : 'These lines are open whatever else is listed above.'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {fallback.map((service) => (
                    <ServiceCard key={service.id} service={service} />
                  ))}
                </div>
              </div>
            )}

            {services.length === 0 && fallback.length === 0 && (
              <p className="text-sm text-slate-500">
                The service list could not be loaded. Call 000 if you are in immediate danger, or 1800RESPECT on 1800 737 732.
              </p>
            )}
          </section>
        </>
      )}

      <div className="text-center">
        <Link href="/dashboard/impact" className="text-sm text-primary-600 hover:underline">
          ← Back to Impact Hub
        </Link>
      </div>
    </div>
  );
}
