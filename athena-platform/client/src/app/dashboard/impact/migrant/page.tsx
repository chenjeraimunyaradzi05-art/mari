'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Globe, Loader2, Plus, GraduationCap, FileCheck, Languages, ExternalLink } from 'lucide-react';
import { communitySupportApi } from '@/lib/api';

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
  australianEquiv?: string;
  bridgingRequired?: string;
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

export default function MigrantPage() {
  const [languageProfile, setLanguageProfile] = useState<LanguageProfile | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [bridgingPrograms, setBridgingPrograms] = useState<BridgingProgram[]>([]);
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

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [langRes, credRes, bridgingRes] = await Promise.all([
        communitySupportApi.getLanguageProfile(),
        communitySupportApi.getCredentials(),
        communitySupportApi.getBridgingPrograms(),
      ]);
      setLanguageProfile(langRes.data?.data || null);
      setCredentials(credRes.data?.data || []);
      setBridgingPrograms(bridgingRes.data?.data || []);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to save language profile');
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
      setShowCredForm(false);
      await loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to add credential');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-blue-600">
          <Globe className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Migrant Services</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
          Refugee & Immigrant Integration
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Credential recognition, language support, and settlement services
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading...
        </div>
      ) : (
        <>
          {/* Language Profile */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Languages className="w-5 h-5" /> Language Profile
              </h2>
              <button onClick={() => setShowLangForm(!showLangForm)} className="btn-secondary text-sm">
                {languageProfile ? 'Edit' : 'Add'} profile
              </button>
            </div>

            {showLangForm && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    value={primaryLanguage}
                    onChange={(e) => setPrimaryLanguage(e.target.value)}
                    placeholder="Primary language (e.g. Arabic, Vietnamese)"
                    className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
                  />
                  <select
                    value={englishProficiency}
                    onChange={(e) => setEnglishProficiency(e.target.value)}
                    className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
                  >
                    {Object.entries(proficiencyLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label} English</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
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
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">Primary language</p>
                    <p className="font-medium text-gray-900 dark:text-white">{languageProfile.primaryLanguage}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">English level</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {proficiencyLabels[languageProfile.englishProficiency]}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Interpreter needed</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {languageProfile.needsInterpreter ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* International Credentials */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5" /> International Credentials
              </h2>
              <button onClick={() => setShowCredForm(!showCredForm)} className="btn-primary text-sm inline-flex items-center gap-1">
                <Plus className="w-4 h-4" /> Add credential
              </button>
            </div>

            {showCredForm && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    value={credCountry}
                    onChange={(e) => setCredCountry(e.target.value)}
                    placeholder="Country of origin"
                    className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
                  />
                  <select
                    value={credType}
                    onChange={(e) => setCredType(e.target.value)}
                    className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="DEGREE">Degree</option>
                    <option value="DIPLOMA">Diploma</option>
                    <option value="CERTIFICATE">Certificate</option>
                    <option value="LICENSE">License</option>
                  </select>
                  <input
                    value={credName}
                    onChange={(e) => setCredName(e.target.value)}
                    placeholder="Credential name"
                    className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
                  />
                  <input
                    value={credInstitution}
                    onChange={(e) => setCredInstitution(e.target.value)}
                    placeholder="Institution"
                    className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
                  />
                  <input
                    value={credYear}
                    onChange={(e) => setCredYear(e.target.value)}
                    type="number"
                    placeholder="Year obtained"
                    className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
                  />
                  <input
                    value={credField}
                    onChange={(e) => setCredField(e.target.value)}
                    placeholder="Field of study"
                    className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddCredential} disabled={saving} className="btn-primary">
                    {saving ? 'Adding...' : 'Add credential'}
                  </button>
                  <button onClick={() => setShowCredForm(false)} className="btn-secondary">Cancel</button>
                </div>
              </div>
            )}

            {credentials.length === 0 ? (
              <p className="text-sm text-gray-500">No credentials added yet.</p>
            ) : (
              <div className="space-y-4">
                {credentials.map((cred) => (
                  <div
                    key={cred.id}
                    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{cred.credentialName}</h3>
                        <p className="text-sm text-gray-500">{cred.institution}, {cred.originalCountry}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${credentialStatusColors[cred.status]}`}>
                        {cred.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs">Type</p>
                        <p className="text-gray-900 dark:text-white">{cred.credentialType}</p>
                      </div>
                      {cred.yearObtained && (
                        <div>
                          <p className="text-gray-500 text-xs">Year</p>
                          <p className="text-gray-900 dark:text-white">{cred.yearObtained}</p>
                        </div>
                      )}
                      {cred.australianEquiv && (
                        <div>
                          <p className="text-gray-500 text-xs">AU Equivalent</p>
                          <p className="text-gray-900 dark:text-white">{cred.australianEquiv}</p>
                        </div>
                      )}
                      {cred.bridgingRequired && (
                        <div>
                          <p className="text-gray-500 text-xs">Bridging needed</p>
                          <p className="text-orange-600">{cred.bridgingRequired}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Bridging Programs */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FileCheck className="w-5 h-5" /> Bridging Programs
            </h2>

            {bridgingPrograms.length === 0 ? (
              <p className="text-sm text-gray-500">No bridging programs available.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bridgingPrograms.map((program) => (
                  <div
                    key={program.id}
                    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5"
                  >
                    <span className="text-xs text-blue-600 font-medium">{program.profession}</span>
                    <h3 className="font-semibold text-gray-900 dark:text-white mt-1">{program.name}</h3>
                    <p className="text-sm text-gray-500">{program.provider}</p>

                    {program.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{program.description}</p>
                    )}

                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                      {program.duration && <span>{program.duration}</span>}
                      {program.fundingAvailable && (
                        <span className="text-emerald-600">Funding available</span>
                      )}
                    </div>

                    {program.url && (
                      <a
                        href={program.url}
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
