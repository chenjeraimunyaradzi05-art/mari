'use client';

/**
 * Settling in with an overseas qualification. A credential she adds is
 * matched to the Australian body that assesses it and to the bridging
 * programs for her profession; what the body decides is recorded by her
 * (or by staff) rather than guessed. When her English is below vocational
 * level the free Commonwealth program is offered, with whatever English
 * courses providers have listed on ATHENA.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Globe, Loader2, Plus, GraduationCap, FileCheck, Languages, ExternalLink, Compass, BookOpen, PencilLine } from 'lucide-react';
import { communitySupportApi, courseApi } from '@/lib/api';
import { credentialPathwayApi, type CredentialOutcome } from '@/lib/impact-api';
import { safeHref } from '@/lib/safe-href';

type LanguageProfile = {
  id: string;
  primaryLanguage: string;
  primaryProficiency: string;
  englishProficiency: string;
  otherLanguages?: { language: string; proficiency: string }[];
  needsInterpreter: boolean;
  preferredInterpreterLang?: string;
};

type Credential = {
  id: string;
  originalCountry: string;
  credentialType: string;
  credentialName: string;
  institution: string;
  yearObtained?: number;
  fieldOfStudy?: string;
  status: string;
  australianEquiv?: string | null;
  bridgingRequired?: string | null;
  assessmentBody?: string | null;
  assessmentDate?: string | null;
  notes?: string | null;
};

type BridgingProgram = {
  id: string;
  name: string;
  provider: string;
  profession: string;
  description?: string;
  duration?: string;
  cost?: string | number;
  fundingAvailable: boolean;
  url?: string;
};

type AssessingBody = { name: string; url: string; role: string };
type Pathway = {
  matched: boolean;
  profession: { id: string; label: string };
  body: AssessingBody;
  also: AssessingBody[];
  note: string;
};
type EnglishSupport = {
  name: string;
  shortName: string;
  provider: string;
  cost: string;
  url: string;
  summary: string;
  eligibility: string;
};
type PathwayData = { pathway: Pathway | null; bridgingPrograms: BridgingProgram[]; englishSupport: EnglishSupport | null };
type EnglishCourse = { id: string; title: string; slug: string; providerName?: string | null; organization?: { name: string } | null };

const proficiencyLabels: Record<string, string> = {
  NATIVE: 'Native',
  FLUENT: 'Fluent',
  ADVANCED: 'Advanced',
  INTERMEDIATE: 'Intermediate',
  BEGINNER: 'Beginner',
  NONE: 'None',
};

const credentialStatusColors: Record<string, string> = {
  PENDING_REVIEW: 'bg-yellow-50 text-yellow-700',
  RECOGNIZED: 'bg-emerald-50 text-emerald-700',
  PARTIALLY_RECOGNIZED: 'bg-blue-50 text-blue-700',
  BRIDGING_REQUIRED: 'bg-orange-50 text-orange-700',
  NOT_RECOGNIZED: 'bg-red-50 text-red-700',
};

const credentialStatusLabels: Record<string, string> = {
  PENDING_REVIEW: 'Waiting on the assessment',
  RECOGNIZED: 'Recognised',
  PARTIALLY_RECOGNIZED: 'Partly recognised',
  BRIDGING_REQUIRED: 'Bridging needed',
  NOT_RECOGNIZED: 'Not recognised',
};

type OutcomeStatus = NonNullable<CredentialOutcome['status']>;
const OUTCOMES: Array<[OutcomeStatus, string]> = [
  ['RECOGNIZED', 'Recognised'],
  ['PARTIALLY_RECOGNIZED', 'Partly recognised'],
  ['BRIDGING_REQUIRED', 'They asked for a bridging step'],
  ['NOT_RECOGNIZED', 'Not recognised'],
  ['PENDING_REVIEW', 'Still waiting'],
];

const inputClass = 'w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm';
const errorOf = (err: unknown, fallback: string) => {
  const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return data?.error || data?.message || fallback;
};
const dataOf = <T,>(res: { data?: { data?: T } }): T | undefined => res.data?.data;

export default function MigrantPage() {
  const [languageProfile, setLanguageProfile] = useState<LanguageProfile | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [bridgingPrograms, setBridgingPrograms] = useState<BridgingProgram[]>([]);
  const [pathways, setPathways] = useState<Record<string, PathwayData>>({});
  const [englishSupport, setEnglishSupport] = useState<EnglishSupport | null>(null);
  const [englishCourses, setEnglishCourses] = useState<EnglishCourse[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLangForm, setShowLangForm] = useState(false);
  const [showCredForm, setShowCredForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Language form state
  const [primaryLanguage, setPrimaryLanguage] = useState('');
  const [englishProficiency, setEnglishProficiency] = useState('INTERMEDIATE');
  const [needsInterpreter, setNeedsInterpreter] = useState(false);

  // Credential form state
  const [credCountry, setCredCountry] = useState('');
  const [credType, setCredType] = useState('DEGREE');
  const [credName, setCredName] = useState('');
  const [credInstitution, setCredInstitution] = useState('');
  const [credYear, setCredYear] = useState('');
  const [credField, setCredField] = useState('');
  const [draftPathway, setDraftPathway] = useState<Pathway | null>(null);

  // Recording what the assessing body said
  const [outcomeFor, setOutcomeFor] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ status: OutcomeStatus; australianEquiv: string; bridgingRequired: string; assessmentBody: string; assessmentDate: string; notes: string }>({
    status: 'RECOGNIZED',
    australianEquiv: '',
    bridgingRequired: '',
    assessmentBody: '',
    assessmentDate: '',
    notes: '',
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [langRes, credRes, bridgingRes] = await Promise.all([
        communitySupportApi.getLanguageProfile(),
        communitySupportApi.getCredentials(),
        communitySupportApi.getBridgingPrograms(),
      ]);
      const creds: Credential[] = dataOf<Credential[]>(credRes) || [];
      setLanguageProfile(dataOf<LanguageProfile | null>(langRes) || null);
      setCredentials(creds);
      setBridgingPrograms(dataOf<BridgingProgram[]>(bridgingRes) || []);

      // The pathway for each credential, and the English support on its own when there are none.
      const pathwayResponses = await Promise.all(creds.map((c) => credentialPathwayApi.pathway({ credentialId: c.id })));
      const next: Record<string, PathwayData> = {};
      creds.forEach((c, i) => {
        const d = dataOf<PathwayData>(pathwayResponses[i]);
        if (d) next[c.id] = d;
      });
      setPathways(next);
      const firstPathway = creds.length > 0 ? dataOf<PathwayData>(pathwayResponses[0]) : dataOf<PathwayData>(await credentialPathwayApi.pathway());
      setEnglishSupport(firstPathway?.englishSupport ?? null);
    } catch (err: unknown) {
      setError(errorOf(err, 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Whatever English courses providers have listed; none is an honest answer.
  useEffect(() => {
    if (!englishSupport) {
      setEnglishCourses(null);
      return;
    }
    let cancelled = false;
    courseApi
      .getAll({ search: 'English', limit: 4 })
      .then((res) => {
        if (!cancelled) setEnglishCourses(dataOf<EnglishCourse[]>(res) || []);
      })
      .catch(() => {
        if (!cancelled) setEnglishCourses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [englishSupport]);

  // As she types the field of study, say who would assess it.
  useEffect(() => {
    if (!showCredForm) return;
    const fieldOfStudy = credField.trim();
    const credentialName = credName.trim();
    if (!fieldOfStudy && !credentialName) {
      setDraftPathway(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      credentialPathwayApi
        .pathway({ fieldOfStudy: fieldOfStudy || undefined, credentialName: credentialName || undefined })
        .then((res) => {
          if (!cancelled) setDraftPathway(dataOf<PathwayData>(res)?.pathway ?? null);
        })
        .catch(() => {
          if (!cancelled) setDraftPathway(null);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [credField, credName, showCredForm]);

  const handleSaveLanguage = async () => {
    if (!primaryLanguage.trim()) {
      setError('Primary language is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await communitySupportApi.saveLanguageProfile({
        primaryLanguage: primaryLanguage.trim(),
        englishProficiency,
        needsInterpreter,
      });
      setShowLangForm(false);
      await loadData();
    } catch (err: unknown) {
      setError(errorOf(err, 'Failed to save language profile'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddCredential = async () => {
    if (!credCountry || !credName || !credInstitution) {
      setError('Country, credential name, and institution are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await communitySupportApi.addCredential({
        originalCountry: credCountry,
        credentialType: credType,
        credentialName: credName,
        institution: credInstitution,
        yearObtained: credYear ? parseInt(credYear) : undefined,
        fieldOfStudy: credField || undefined,
      });
      setCredCountry('');
      setCredName('');
      setCredInstitution('');
      setCredYear('');
      setCredField('');
      setDraftPathway(null);
      setShowCredForm(false);
      await loadData();
    } catch (err: unknown) {
      setError(errorOf(err, 'Failed to add credential'));
    } finally {
      setSaving(false);
    }
  };

  const openOutcome = (cred: Credential) => {
    const suggestion = pathways[cred.id]?.pathway;
    setOutcome({
      status: cred.status === 'PENDING_REVIEW' ? 'RECOGNIZED' : (cred.status as OutcomeStatus),
      australianEquiv: cred.australianEquiv ?? '',
      bridgingRequired: cred.bridgingRequired ?? '',
      assessmentBody: cred.assessmentBody ?? suggestion?.body.name ?? '',
      assessmentDate: cred.assessmentDate ? cred.assessmentDate.slice(0, 10) : '',
      notes: cred.notes ?? '',
    });
    setOutcomeFor(cred.id);
  };

  const handleRecordOutcome = async (credentialId: string) => {
    setSaving(true);
    setError(null);
    try {
      await credentialPathwayApi.recordOutcome(credentialId, {
        status: outcome.status,
        australianEquiv: outcome.australianEquiv.trim() || null,
        bridgingRequired: outcome.bridgingRequired.trim() || null,
        assessmentBody: outcome.assessmentBody.trim() || null,
        assessmentDate: outcome.assessmentDate || null,
        notes: outcome.notes.trim() || null,
      });
      setOutcomeFor(null);
      await loadData();
    } catch (err: unknown) {
      setError(errorOf(err, 'Could not record that'));
    } finally {
      setSaving(false);
    }
  };

  const bodyLink = (body: AssessingBody) => (
    <a href={safeHref(body.url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline">
      {body.name} <ExternalLink className="w-3 h-3" />
    </a>
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-blue-600">
          <Globe className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Migrant Services</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-2">
          Refugee & Immigrant Integration
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Credential recognition, language support, and settlement services
        </p>
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
          {/* Language Profile */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Languages className="w-5 h-5" /> Language Profile
              </h2>
              <button onClick={() => setShowLangForm(!showLangForm)} className="btn-secondary text-sm">
                {languageProfile ? 'Edit' : 'Add'} profile
              </button>
            </div>

            {showLangForm && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 mb-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="primary-language" className="sr-only">Primary language</label>
                    <input
                      id="primary-language"
                      value={primaryLanguage}
                      onChange={(e) => setPrimaryLanguage(e.target.value)}
                      placeholder="Primary language (e.g. Arabic, Vietnamese)"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="english-proficiency" className="sr-only">English level</label>
                    <select
                      id="english-proficiency"
                      value={englishProficiency}
                      onChange={(e) => setEnglishProficiency(e.target.value)}
                      className={inputClass}
                    >
                      {Object.entries(proficiencyLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label} English</option>
                      ))}
                    </select>
                  </div>
                </div>
                <label htmlFor="needs-interpreter" className="flex items-center gap-2 text-sm">
                  <input
                    id="needs-interpreter"
                    type="checkbox"
                    checked={needsInterpreter}
                    onChange={(e) => setNeedsInterpreter(e.target.checked)}
                  />
                  I need interpreter services
                </label>
                <div className="flex gap-2">
                  <button onClick={handleSaveLanguage} disabled={saving} className="btn-primary">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setShowLangForm(false)} className="btn-secondary">Cancel</button>
                </div>
              </div>
            )}

            {languageProfile && !showLangForm && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs">Primary language</p>
                    <p className="font-medium text-slate-900 dark:text-white">{languageProfile.primaryLanguage}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">English level</p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {proficiencyLabels[languageProfile.englishProficiency]}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Interpreter needed</p>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {languageProfile.needsInterpreter ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* English support, only when her English is below vocational level */}
          {englishSupport && (
            <section aria-labelledby="english-support-heading">
              <h2 id="english-support-heading" className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5" /> Free English classes
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-rose-50 to-amber-50 dark:from-slate-900 dark:to-slate-900 border border-rose-100 dark:border-slate-800 rounded-xl p-5">
                  <span className="text-xs text-rose-600 font-medium">{englishSupport.cost} · {englishSupport.provider}</span>
                  <h3 className="font-semibold text-slate-900 dark:text-white mt-1">{englishSupport.name}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{englishSupport.summary}</p>
                  <p className="text-xs text-slate-500 mt-2">{englishSupport.eligibility}</p>
                  <a
                    href={safeHref(englishSupport.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    Find an {englishSupport.shortName} provider <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                  <h3 className="font-semibold text-slate-900 dark:text-white">English courses on ATHENA</h3>
                  {englishCourses === null ? (
                    <p className="text-sm text-slate-500 mt-2">Looking…</p>
                  ) : englishCourses.length === 0 ? (
                    <p className="text-sm text-slate-500 mt-2">None listed yet. Providers add their own courses, so it is worth checking back.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {englishCourses.map((course) => (
                        <li key={course.id}>
                          <Link href={`/courses/${course.slug}`} className="text-sm font-medium text-blue-600 hover:underline">
                            {course.title}
                          </Link>
                          {(course.providerName || course.organization?.name) && (
                            <p className="text-xs text-slate-500">{course.providerName || course.organization?.name}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link href="/courses" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
                    Search all courses
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* International Credentials */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5" /> International Credentials
              </h2>
              <button onClick={() => setShowCredForm(!showCredForm)} className="btn-primary text-sm inline-flex items-center gap-1">
                <Plus className="w-4 h-4" /> Add credential
              </button>
            </div>

            {showCredForm && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 mb-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="cred-country" className="sr-only">Country of origin</label>
                    <input id="cred-country" value={credCountry} onChange={(e) => setCredCountry(e.target.value)} placeholder="Country of origin" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="cred-type" className="sr-only">Credential type</label>
                    <select id="cred-type" value={credType} onChange={(e) => setCredType(e.target.value)} className={inputClass}>
                      <option value="DEGREE">Degree</option>
                      <option value="DIPLOMA">Diploma</option>
                      <option value="CERTIFICATE">Certificate</option>
                      <option value="LICENSE">License</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="cred-name" className="sr-only">Credential name</label>
                    <input id="cred-name" value={credName} onChange={(e) => setCredName(e.target.value)} placeholder="Credential name" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="cred-institution" className="sr-only">Institution</label>
                    <input id="cred-institution" value={credInstitution} onChange={(e) => setCredInstitution(e.target.value)} placeholder="Institution" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="cred-year" className="sr-only">Year obtained</label>
                    <input id="cred-year" value={credYear} onChange={(e) => setCredYear(e.target.value)} type="number" placeholder="Year obtained" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="cred-field" className="sr-only">Field of study</label>
                    <input id="cred-field" value={credField} onChange={(e) => setCredField(e.target.value)} placeholder="Field of study (e.g. Nursing, Civil engineering)" className={inputClass} />
                  </div>
                </div>
                {draftPathway && (
                  <p className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2">
                    <Compass className="w-4 h-4 mt-0.5 text-blue-600 shrink-0" />
                    <span>
                      {draftPathway.matched ? `For ${draftPathway.profession.label.toLowerCase()}, the body to ask is ` : 'No specialist body covers this field; the general assessor is '}
                      {bodyLink(draftPathway.body)}.
                    </span>
                  </p>
                )}
                <div className="flex gap-2">
                  <button onClick={handleAddCredential} disabled={saving} className="btn-primary">
                    {saving ? 'Adding...' : 'Add credential'}
                  </button>
                  <button onClick={() => setShowCredForm(false)} className="btn-secondary">Cancel</button>
                </div>
              </div>
            )}

            {credentials.length === 0 ? (
              <p className="text-sm text-slate-500">No credentials added yet. Add one and we will say who assesses it here.</p>
            ) : (
              <div className="space-y-4">
                {credentials.map((cred) => {
                  const pathway = pathways[cred.id];
                  const matches = pathway?.bridgingPrograms ?? [];
                  return (
                    <div
                      key={cred.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white">{cred.credentialName}</h3>
                          <p className="text-sm text-slate-500">{cred.institution}, {cred.originalCountry}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${credentialStatusColors[cred.status] ?? ''}`}>
                          {credentialStatusLabels[cred.status] ?? cred.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500 text-xs">Type</p>
                          <p className="text-slate-900 dark:text-white">{cred.credentialType}</p>
                        </div>
                        {cred.yearObtained && (
                          <div>
                            <p className="text-slate-500 text-xs">Year</p>
                            <p className="text-slate-900 dark:text-white">{cred.yearObtained}</p>
                          </div>
                        )}
                        {cred.australianEquiv && (
                          <div>
                            <p className="text-slate-500 text-xs">AU Equivalent</p>
                            <p className="text-slate-900 dark:text-white">{cred.australianEquiv}</p>
                          </div>
                        )}
                        {cred.bridgingRequired && (
                          <div>
                            <p className="text-slate-500 text-xs">Bridging needed</p>
                            <p className="text-orange-600">{cred.bridgingRequired}</p>
                          </div>
                        )}
                      </div>

                      {/* Where to take it */}
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-4 text-sm space-y-2">
                        {cred.assessmentBody ? (
                          <p className="text-slate-700 dark:text-slate-200">
                            <span className="text-xs text-slate-500 block">Assessed by</span>
                            {cred.assessmentBody}
                            {cred.assessmentDate ? ` · ${new Date(cred.assessmentDate).toLocaleDateString('en-AU')}` : ''}
                          </p>
                        ) : pathway?.pathway ? (
                          <p className="text-slate-700 dark:text-slate-200 flex items-start gap-2">
                            <Compass className="w-4 h-4 mt-0.5 text-blue-600 shrink-0" />
                            <span>
                              {pathway.pathway.matched ? `For ${pathway.pathway.profession.label.toLowerCase()}, the body to ask is ` : 'No specialist body covers this field; the general assessor is '}
                              {bodyLink(pathway.pathway.body)}.
                              {pathway.pathway.also.length > 0 && (
                                <span className="block text-xs text-slate-500 mt-1">
                                  Then: {pathway.pathway.also.map((b, i) => (
                                    <span key={b.name}>
                                      {i > 0 ? ' · ' : ''}
                                      {bodyLink(b)}
                                    </span>
                                  ))}
                                </span>
                              )}
                            </span>
                          </p>
                        ) : null}
                        {cred.notes && <p className="text-xs text-slate-500 whitespace-pre-wrap">{cred.notes}</p>}
                        {matches.length > 0 && (
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            Bridging programs for {pathway?.pathway?.profession.label.toLowerCase()}:{' '}
                            {matches.map((m, i) => (
                              <span key={m.id}>
                                {i > 0 ? ', ' : ''}
                                {m.url && safeHref(m.url) ? (
                                  <a href={safeHref(m.url)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{m.name}</a>
                                ) : (
                                  m.name
                                )}
                              </span>
                            ))}
                          </p>
                        )}
                        {outcomeFor !== cred.id && (
                          <button type="button" onClick={() => openOutcome(cred)} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                            <PencilLine className="w-4 h-4" /> {cred.assessmentBody ? 'Update what they said' : 'Record what they said'}
                          </button>
                        )}
                      </div>

                      {outcomeFor === cred.id && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleRecordOutcome(cred.id);
                          }}
                          className="rounded-lg border border-blue-100 dark:border-slate-700 p-4 space-y-3"
                        >
                          <p className="text-sm text-slate-600 dark:text-slate-300">When the assessing body writes to you, keep the answer here so the rest of your plan can follow it.</p>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label htmlFor={`outcome-status-${cred.id}`} className="block text-xs text-slate-500 mb-1">What they decided</label>
                              <select id={`outcome-status-${cred.id}`} value={outcome.status} onChange={(e) => setOutcome((o) => ({ ...o, status: e.target.value as OutcomeStatus }))} className={inputClass}>
                                {OUTCOMES.map(([value, label]) => (
                                  <option key={value} value={value}>{label}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label htmlFor={`outcome-body-${cred.id}`} className="block text-xs text-slate-500 mb-1">Assessing body</label>
                              <input id={`outcome-body-${cred.id}`} value={outcome.assessmentBody} onChange={(e) => setOutcome((o) => ({ ...o, assessmentBody: e.target.value }))} maxLength={200} className={inputClass} />
                            </div>
                            <div>
                              <label htmlFor={`outcome-equiv-${cred.id}`} className="block text-xs text-slate-500 mb-1">Australian equivalent they named</label>
                              <input id={`outcome-equiv-${cred.id}`} value={outcome.australianEquiv} onChange={(e) => setOutcome((o) => ({ ...o, australianEquiv: e.target.value }))} placeholder="e.g. Bachelor of Nursing" maxLength={200} className={inputClass} />
                            </div>
                            <div>
                              <label htmlFor={`outcome-bridging-${cred.id}`} className="block text-xs text-slate-500 mb-1">Bridging they asked for</label>
                              <input id={`outcome-bridging-${cred.id}`} value={outcome.bridgingRequired} onChange={(e) => setOutcome((o) => ({ ...o, bridgingRequired: e.target.value }))} placeholder="Leave empty if none" maxLength={500} className={inputClass} />
                            </div>
                            <div>
                              <label htmlFor={`outcome-date-${cred.id}`} className="block text-xs text-slate-500 mb-1">Date of their letter</label>
                              <input id={`outcome-date-${cred.id}`} type="date" value={outcome.assessmentDate} onChange={(e) => setOutcome((o) => ({ ...o, assessmentDate: e.target.value }))} className={inputClass} />
                            </div>
                            <div>
                              <label htmlFor={`outcome-notes-${cred.id}`} className="block text-xs text-slate-500 mb-1">Anything else worth keeping</label>
                              <input id={`outcome-notes-${cred.id}`} value={outcome.notes} onChange={(e) => setOutcome((o) => ({ ...o, notes: e.target.value }))} maxLength={2000} className={inputClass} />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button type="submit" disabled={saving} className="btn-primary text-sm">
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button type="button" onClick={() => setOutcomeFor(null)} className="btn-secondary text-sm">Cancel</button>
                          </div>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Bridging Programs */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <FileCheck className="w-5 h-5" /> Bridging Programs
            </h2>

            {bridgingPrograms.length === 0 ? (
              <p className="text-sm text-slate-500">No bridging programs are listed yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bridgingPrograms.map((program) => (
                  <div
                    key={program.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5"
                  >
                    <span className="text-xs text-blue-600 font-medium">{program.profession}</span>
                    <h3 className="font-semibold text-slate-900 dark:text-white mt-1">{program.name}</h3>
                    <p className="text-sm text-slate-500">{program.provider}</p>

                    {program.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{program.description}</p>
                    )}

                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                      {program.duration && <span>{program.duration}</span>}
                      {program.fundingAvailable && (
                        <span className="text-emerald-600">Funding available</span>
                      )}
                    </div>

                    {program.url && (
                      <a
                        href={safeHref(program.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                      >
                        Learn more <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
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
