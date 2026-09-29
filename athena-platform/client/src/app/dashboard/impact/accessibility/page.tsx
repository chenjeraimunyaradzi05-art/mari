'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Accessibility, Loader2, CheckCircle, Building2, Briefcase } from 'lucide-react';
import { impactApi } from '@/lib/api';
import { ACCESSIBILITY_PROFILE_QUERY_KEY } from '@/app/providers';
import { useAuthStore } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';
import { StaffDisabilityEmployers } from './StaffDisabilityEmployers';

type AccessibilityProfile = {
  id: string;
  hasVisionImpairment: boolean;
  hasHearingImpairment: boolean;
  hasMobilityImpairment: boolean;
  hasCognitiveDisability: boolean;
  usesScreenReader: boolean;
  usesVoiceControl: boolean;
  preferredFontSize?: string;
  highContrastMode: boolean;
  reducedMotion: boolean;
  captionsRequired: boolean;
  otherNeeds?: string;
  workAccommodations: string[];
};

type DisabilityFriendlyEmployer = {
  id: string;
  accessibilityRating?: number;
  accommodationsOffered: string[];
  hasWheelchairAccess: boolean;
  hasFlexibleWork: boolean;
  hasRemoteOptions: boolean;
  hasMentalHealthSupport: boolean;
  /** When ATHENA staff last checked this employer. The public list holds only checked ones. */
  verifiedAt: string;
  organization: {
    id: string;
    name: string;
    // The server sends the organisation's `logo`. This read `logoUrl`, which
    // nothing sends, so no employer's logo could ever have shown.
    logo?: string | null;
    industry?: string | null;
  };
};

export default function AccessibilityPage() {
  const queryClient = useQueryClient();
  const isStaff = useAuthStore().user?.role === 'ADMIN';
  const [profile, setProfile] = useState<AccessibilityProfile | null>(null);
  const [employers, setEmployers] = useState<DisabilityFriendlyEmployer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A failed load leaves the employer list empty, which must not read as
  // "there are no employers" when the truth is that we could not ask.
  const [loadFailed, setLoadFailed] = useState(false);

  // Form state
  const [hasVisionImpairment, setHasVisionImpairment] = useState(false);
  const [hasHearingImpairment, setHasHearingImpairment] = useState(false);
  const [hasMobilityImpairment, setHasMobilityImpairment] = useState(false);
  const [hasCognitiveDisability, setHasCognitiveDisability] = useState(false);
  const [usesScreenReader, setUsesScreenReader] = useState(false);
  const [highContrastMode, setHighContrastMode] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [captionsRequired, setCaptionsRequired] = useState(false);
  const [otherNeeds, setOtherNeeds] = useState('');
  const [workAccommodations, setWorkAccommodations] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setLoadFailed(false);
    try {
      const [profileRes, employersRes] = await Promise.all([
        impactApi.getAccessibilityProfile(),
        impactApi.getDisabilityFriendlyEmployers(),
      ]);
      const profileData = profileRes.data?.data || null;
      setProfile(profileData);
      setEmployers(employersRes.data?.data || []);

      // Populate form with existing data
      if (profileData) {
        setHasVisionImpairment(profileData.hasVisionImpairment);
        setHasHearingImpairment(profileData.hasHearingImpairment);
        setHasMobilityImpairment(profileData.hasMobilityImpairment);
        setHasCognitiveDisability(profileData.hasCognitiveDisability);
        setUsesScreenReader(profileData.usesScreenReader);
        setHighContrastMode(profileData.highContrastMode);
        setReducedMotion(profileData.reducedMotion);
        setCaptionsRequired(profileData.captionsRequired);
        setOtherNeeds(profileData.otherNeeds || '');
        setWorkAccommodations(profileData.workAccommodations?.join('\n') || '');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to load data');
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await impactApi.saveAccessibilityProfile({
        hasVisionImpairment,
        hasHearingImpairment,
        hasMobilityImpairment,
        hasCognitiveDisability,
        usesScreenReader,
        highContrastMode,
        reducedMotion,
        captionsRequired,
        otherNeeds: otherNeeds || undefined,
        workAccommodations: workAccommodations ? workAccommodations.split('\n').filter(Boolean) : [],
      });
      // So high contrast and reduced motion take effect now, not on the next visit.
      void queryClient.invalidateQueries({ queryKey: ACCESSIBILITY_PROFILE_QUERY_KEY });
      setShowForm(false);
      await loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const renderStars = (rating?: number) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={star <= rating ? 'text-yellow-400' : 'text-slate-300'}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-teal-600">
          <Accessibility className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Accessibility</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-2">
          Disability Support & Accommodations
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Set your accessibility preferences and find inclusive employers
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
          {/* Accessibility Profile */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                My Accessibility Profile
              </h2>
              <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm">
                {profile ? 'Update' : 'Create'} profile
              </button>
            </div>

            {showForm && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 mb-4 space-y-6">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    Impairment types (select all that apply)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={hasVisionImpairment} onChange={(e) => setHasVisionImpairment(e.target.checked)} />
                      Vision impairment
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={hasHearingImpairment} onChange={(e) => setHasHearingImpairment(e.target.checked)} />
                      Hearing impairment
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={hasMobilityImpairment} onChange={(e) => setHasMobilityImpairment(e.target.checked)} />
                      Mobility impairment
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={hasCognitiveDisability} onChange={(e) => setHasCognitiveDisability(e.target.checked)} />
                      Cognitive disability
                    </label>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    Assistive technology & preferences
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={usesScreenReader} onChange={(e) => setUsesScreenReader(e.target.checked)} />
                      Uses screen reader
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={highContrastMode} onChange={(e) => setHighContrastMode(e.target.checked)} />
                      High contrast mode
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} />
                      Reduced motion
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={captionsRequired} onChange={(e) => setCaptionsRequired(e.target.checked)} />
                      Captions required
                    </label>
                  </div>
                  {/* These two used to be a record and nothing more, and this
                      note said so. The app now applies them (ThemeSync in
                      providers.tsx), so the note says what they do. */}
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    High contrast and reduced motion change how ATHENA looks wherever you are signed in: stronger text and
                    borders, deeper button colours and a clear focus outline, and no animations. Your device&apos;s own
                    reduce-motion and contrast settings still apply as well.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Other accessibility needs
                  </label>
                  <textarea
                    value={otherNeeds}
                    onChange={(e) => setOtherNeeds(e.target.value)}
                    placeholder="Describe any other accessibility needs..."
                    rows={2}
                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Workplace accommodations needed (one per line)
                  </label>
                  <textarea
                    value={workAccommodations}
                    onChange={(e) => setWorkAccommodations(e.target.value)}
                    placeholder="e.g., Flexible hours, Standing desk, Quiet workspace..."
                    rows={3}
                    className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex gap-2">
                  <button onClick={handleSave} disabled={saving} className="btn-primary">
                    {saving ? 'Saving...' : 'Save profile'}
                  </button>
                  <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                </div>
              </div>
            )}

            {profile && !showForm && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {profile.hasVisionImpairment && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-teal-500" />
                      <span>Vision impairment</span>
                    </div>
                  )}
                  {profile.hasHearingImpairment && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-teal-500" />
                      <span>Hearing impairment</span>
                    </div>
                  )}
                  {profile.hasMobilityImpairment && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-teal-500" />
                      <span>Mobility impairment</span>
                    </div>
                  )}
                  {profile.hasCognitiveDisability && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-teal-500" />
                      <span>Cognitive disability</span>
                    </div>
                  )}
                  {profile.usesScreenReader && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      <span>Screen reader</span>
                    </div>
                  )}
                  {profile.captionsRequired && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      <span>Captions required</span>
                    </div>
                  )}
                </div>

                {profile.workAccommodations.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-500 mb-2">Workplace accommodations:</p>
                    <div className="flex flex-wrap gap-2">
                      {profile.workAccommodations.map((acc, idx) => (
                        <span key={idx} className="text-xs px-2 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-full">
                          {acc}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Disability-Friendly Employers */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5" /> Disability-friendly employers
            </h2>
            {/*
              The heading used to say "Disability-Confident", the name of a UK
              government scheme ATHENA has nothing to do with. These are
              employers ATHENA staff have checked themselves; the rating is
              theirs, and each card says when they last looked.
            */}
            <p className="text-sm text-slate-500 dark:text-slate-400 -mt-2 mb-4">
              Workplaces ATHENA staff have checked themselves. The rating out of five is our staff&rsquo;s assessment, not an accreditation.
            </p>

            {loadFailed ? (
              <p className="text-sm text-slate-500">We could not load employers just now.</p>
            ) : employers.length === 0 ? (
              // Not "none found": nothing has searched. No employer has been
              // listed here, and the page says that rather than implying a
              // search came back empty.
              <p className="text-sm text-slate-500">No employer has been listed here yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {employers.map((employer) => (
                  <div
                    key={employer.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                        {employer.organization.logo ? (
                          <img src={employer.organization.logo} alt="" className="w-8 h-8 object-contain" />
                        ) : (
                          <Building2 className="w-6 h-6 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          {employer.organization.name}
                        </h3>
                        {employer.organization.industry && (
                          <p className="text-xs text-slate-500">{employer.organization.industry}</p>
                        )}
                        {employer.accessibilityRating && (
                          <div className="mt-1">{renderStars(employer.accessibilityRating)}</div>
                        )}
                      </div>
                      <span className="text-xs bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 px-2 py-1 rounded-full whitespace-nowrap">
                        Checked {formatDate(employer.verifiedAt)}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                      {employer.hasWheelchairAccess && (
                        <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                          ♿ Wheelchair access
                        </span>
                      )}
                      {employer.hasFlexibleWork && (
                        <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                          Flexible work
                        </span>
                      )}
                      {employer.hasRemoteOptions && (
                        <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                          Remote options
                        </span>
                      )}
                      {employer.hasMentalHealthSupport && (
                        <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                          Mental health support
                        </span>
                      )}
                    </div>

                    {employer.accommodationsOffered.length > 0 && (
                      <div className="mt-3 text-xs text-slate-500">
                        Accommodations: {employer.accommodationsOffered.slice(0, 3).join(', ')}
                        {employer.accommodationsOffered.length > 3 && ` +${employer.accommodationsOffered.length - 3} more`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/*
        Staff only. The server refuses these routes to anyone else; this only
        keeps the panel off members' screens.
      */}
      {isStaff && <StaffDisabilityEmployers onChanged={() => loadData()} />}

      <div className="text-center">
        <Link href="/dashboard/impact" className="text-sm text-primary-600 hover:underline">
          ← Back to Impact Hub
        </Link>
      </div>
    </div>
  );
}
