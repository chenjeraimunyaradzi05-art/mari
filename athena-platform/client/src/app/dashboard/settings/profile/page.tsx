'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Link as LinkIcon,
  Camera,
  Save,
  X,
  Plus,
  Trash2,
  ShieldCheck,
  CalendarDays,
} from 'lucide-react';
import { useAuth, useUpdateProfile, useMySkills, useAddSkill, useRemoveSkill } from '@/lib/hooks';
import { getInitials, PERSONA_LABELS } from '@/lib/utils';
import { DATE_OF_BIRTH_REFUSAL, latestAdultBirthDate, meetsMinimumAge } from '@/lib/age-gate';
import { fetchIdentityGates, saveDateOfBirth, womanGateApi } from '@/lib/woman-gate';

type ProfileFormData = {
  firstName: string;
  lastName: string;
  headline: string;
  bio: string;
  location: string;
  phone: string;
  website: string;
  linkedinUrl: string;
  twitterUrl: string;
  githubUrl: string;
};

const WOMAN_GATE_STATUS_COPY: Record<string, string> = {
  UNVERIFIED: 'Not started',
  PENDING: 'With a reviewer',
  VERIFIED: 'Verified',
  REJECTED: 'Not approved',
};

/**
 * The two gates on an account: how old ATHENA believes the member is, and
 * whether her women-only verification has been completed.
 *
 * What stood here before was a status chip and a button that posted an empty
 * body. The request collected nothing, so a reviewer decided a membership from
 * a name and a subscription tier, and the copy told her that verification was
 * something paid subscribers could ask for — which was true, and was the
 * wrong rule. Both are fixed on the server; this is the form that feeds it.
 */
function IdentityGatesCard() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [statement, setStatement] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const completedReturn = useRef(false);

  const { data: gates, isLoading, isError } = useQuery({
    queryKey: ['identity-gates'],
    queryFn: fetchIdentityGates,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['identity-gates'] });
    queryClient.invalidateQueries({ queryKey: ['auth'] });
  };

  const startIdentityCheck = useMutation({
    mutationFn: () => womanGateApi.request({ method: 'IDENTITY' }),
    onSuccess: (response) => {
      const url = response.data?.redirectUrl;
      if (url) {
        // Stripe hosts the document and selfie capture; there is nothing to
        // show here until she comes back to the return_url.
        window.location.assign(url);
        return;
      }
      refresh();
      toast.success('Your request has been submitted.');
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Could not start the document check');
    },
  });

  const sendWrittenRequest = useMutation({
    mutationFn: () =>
      womanGateApi.request({
        method: 'MANUAL',
        statement: statement.trim(),
        ...(evidenceUrl.trim() ? { evidenceUrl: evidenceUrl.trim() } : {}),
      }),
    onSuccess: () => {
      setStatement('');
      setEvidenceUrl('');
      refresh();
      toast.success('Thank you. A reviewer will look at this shortly.');
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Could not send your request');
    },
  });

  const completeIdentityCheck = useMutation({
    mutationFn: womanGateApi.complete,
    onSuccess: (response) => {
      refresh();
      if (response.data?.documentCheck === 'verified') {
        toast.success('Your document check passed. Your request is with a reviewer.');
      }
    },
    // Coming back from Stripe with nothing waiting is an ordinary outcome —
    // a reload of the return URL, or a webhook that already closed it out —
    // so it is not worth a red toast.
    onError: () => refresh(),
  });

  const saveBirthDate = useMutation({
    mutationFn: () => saveDateOfBirth(dateOfBirth),
    onSuccess: () => {
      setDateOfBirth('');
      refresh();
      toast.success('Date of birth saved');
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Could not save your date of birth');
    },
  });

  // Stripe sends her back here with ?woman-verification=done. Asking Stripe
  // directly means the page can tell her the answer straight away instead of
  // waiting on a webhook she cannot see.
  const returnedFromCheck = searchParams?.get('woman-verification') === 'done';
  const completeMutation = completeIdentityCheck.mutate;
  useEffect(() => {
    if (!returnedFromCheck || completedReturn.current) return;
    completedReturn.current = true;
    completeMutation();
  }, [returnedFromCheck, completeMutation]);

  if (isLoading) {
    return <div className="card h-40 animate-pulse bg-slate-100 dark:bg-slate-800" />;
  }

  if (isError || !gates) {
    return (
      <div className="card border-red-200 text-sm text-red-700 dark:border-red-900/50 dark:text-red-300">
        Your verification status could not be loaded. Please reload the page.
      </div>
    );
  }

  const woman = gates.womanVerification;
  const evidence = woman.evidence;
  const documentPassed = Boolean(evidence?.documentCheckPassedAt);
  // Not after a refusal. The server stopped taking a fresh request from a
  // member a reviewer has refused — one request used to reopen everything the
  // reviewer had just closed — and this page went on offering the form, so
  // every press came back 403 while the copy above it said to send another.
  // A refusal goes to an appeal, which puts it back in front of a person.
  const canAskAgain = woman.status !== 'REJECTED' && (woman.status === 'UNVERIFIED' || !evidence);

  return (
    <div className="space-y-6">
      {!gates.dateOfBirth && (
        <div className="card border-amber-200 dark:border-amber-900/50">
          <div className="flex items-start space-x-3">
            <CalendarDays className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your date of birth</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                ATHENA is an adults-only community, and your account was created before we
                started asking. Add it once and the rest of the platform opens up. It is never
                shown on your profile.
              </p>
              <div className="mt-4 flex flex-wrap items-start gap-3">
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                  className="input"
                  autoComplete="bday"
                  max={latestAdultBirthDate()}
                  aria-label="Date of birth"
                />
                <button
                  type="button"
                  onClick={() => saveBirthDate.mutate()}
                  disabled={saveBirthDate.isPending || !meetsMinimumAge(dateOfBirth)}
                  className="btn-primary px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saveBirthDate.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
              {dateOfBirth && !meetsMinimumAge(dateOfBirth) && (
                <p className="mt-2 text-sm text-red-600">{DATE_OF_BIRTH_REFUSAL}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-start space-x-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-600" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Women-only verification
              </h2>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                {WOMAN_GATE_STATUS_COPY[woman.status] ?? woman.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              ATHENA is a space for women. Verification is free, and it is what opens the
              members-only parts of the platform, including the DV-safe housing listings.
            </p>

            {woman.status === 'VERIFIED' && (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                You are verified. Nothing else to do here.
              </p>
            )}

            {woman.status === 'PENDING' && (
              <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-800/60">
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  {documentPassed
                    ? 'Your document check passed and your request is with a reviewer.'
                    : evidence
                    ? 'Your request is with a reviewer.'
                    : 'You started a document check but have not finished it yet.'}
                </p>
                {!documentPassed && evidence?.provider === 'stripe_identity' && (
                  <button
                    type="button"
                    onClick={() => startIdentityCheck.mutate()}
                    disabled={startIdentityCheck.isPending}
                    className="btn-outline mt-3 px-4 py-2"
                  >
                    {startIdentityCheck.isPending ? 'Opening...' : 'Finish the document check'}
                  </button>
                )}
              </div>
            )}

            {woman.status === 'REJECTED' && (
              <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-800/60">
                <p className="text-slate-700 dark:text-slate-200">
                  A reviewer did not approve your request. If you think that was wrong, appeal the
                  decision and a person will look at it again. You can tell them anything the first
                  request did not say.
                </p>
                <a
                  href="/help/appeal?type=verification_decision"
                  className="btn-outline mt-3 inline-flex px-4 py-2"
                >
                  Appeal this decision
                </a>
              </div>
            )}

            {canAskAgain && woman.status !== 'VERIFIED' && (
              <div className="mt-4 space-y-4">
                {woman.identityCheckAvailable && (
                  <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      Photo ID and a selfie
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      The quickest way. You photograph an identity document and your face on
                      our payment provider&apos;s secure page; ATHENA never sees the images,
                      only the result.
                    </p>
                    <button
                      type="button"
                      onClick={() => startIdentityCheck.mutate()}
                      disabled={startIdentityCheck.isPending}
                      className="btn-primary mt-3 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {startIdentityCheck.isPending ? 'Opening...' : 'Start the check'}
                    </button>
                  </div>
                )}

                <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {woman.identityCheckAvailable ? 'Or write to a reviewer' : 'Write to a reviewer'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    If you would rather not, or cannot, use a document — which is a real
                    situation for a lot of women here — tell us in a couple of sentences and a
                    person will read it.
                  </p>
                  <textarea
                    value={statement}
                    onChange={(event) => setStatement(event.target.value)}
                    className="input mt-3 min-h-[96px] w-full"
                    maxLength={1000}
                    placeholder="A couple of sentences is plenty."
                    aria-label="Why you are asking to be verified"
                  />
                  <input
                    type="url"
                    value={evidenceUrl}
                    onChange={(event) => setEvidenceUrl(event.target.value)}
                    className="input mt-3 w-full"
                    placeholder="A supporting link (optional)"
                    aria-label="A link to supporting evidence, optional"
                  />
                  <button
                    type="button"
                    onClick={() => sendWrittenRequest.mutate()}
                    disabled={sendWrittenRequest.isPending || statement.trim().length < 20}
                    className="btn-outline mt-3 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sendWrittenRequest.isPending ? 'Sending...' : 'Send for review'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfileSettingsPage() {
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();
  const { data: mySkills } = useMySkills();
  const addSkillMutation = useAddSkill();
  const removeSkillMutation = useRemoveSkill();
  const [isEditing, setIsEditing] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [newSkill, setNewSkill] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProfileFormData>({
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      headline: user?.headline || '',
      bio: user?.bio || '',
      location: user?.city || '',
      phone: '',
      website: user?.profile?.websiteUrl || '',
      linkedinUrl: user?.profile?.linkedinUrl || '',
      twitterUrl: user?.profile?.twitterUrl || '',
      githubUrl: '',
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    updateProfile.mutate(data, {
      onSuccess: () => {
        setIsEditing(false);
      },
    });
  };

  const handleCancel = () => {
    reset();
    setIsEditing(false);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddSkill = () => {
    const trimmed = newSkill.trim();
    if (!trimmed) return;

    addSkillMutation.mutate(
      { skillName: trimmed },
      {
        onSuccess: () => setNewSkill(''),
      }
    );
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Profile Settings
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Update your personal information and public profile
          </p>
        </div>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="btn-primary px-4 py-2"
          >
            Edit Profile
          </button>
        ) : (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCancel}
              className="btn-outline px-4 py-2"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit(onSubmit)}
              disabled={!isDirty || updateProfile.isPending}
              className="btn-primary px-4 py-2 flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>{updateProfile.isPending ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Outside the profile form on purpose: it has its own inputs and its own
          submit, and nesting those inside a form would make Enter save the
          wrong thing. The boundary is for useSearchParams, which reads the
          ?woman-verification=done that Stripe returns her with. */}
      <Suspense fallback={<div className="card h-40 animate-pulse bg-slate-100 dark:bg-slate-800" />}>
        <IdentityGatesCard />
      </Suspense>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Avatar Section */}
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Profile Photo
          </h2>
          <div className="flex items-center space-x-6">
            <div className="relative">
              {avatarPreview || user?.avatar ? (
                <img
                  src={avatarPreview || user?.avatar}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 font-bold text-2xl">
                  {getInitials(user?.firstName || '', user?.lastName || '')}
                </div>
              )}
              {isEditing && (
                <label className="absolute bottom-0 right-0 p-2 bg-primary-600 text-white rounded-full cursor-pointer hover:bg-primary-700 transition">
                  <Camera className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <div>
              <h3 className="font-medium text-slate-900 dark:text-white">
                {user?.firstName} {user?.lastName}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {user?.persona ? PERSONA_LABELS[user.persona] : 'ATHENA Member'}
              </p>
              {isEditing && (
                <p className="text-xs text-slate-400 mt-2">
                  JPG, PNG or GIF. Max 5MB.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Basic Information */}
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Basic Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                First Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  {...register('firstName', { required: 'First name is required' })}
                  disabled={!isEditing}
                  className="input pl-10 w-full disabled:bg-slate-50 dark:disabled:bg-slate-800"
                />
              </div>
              {errors.firstName && (
                <p className="text-sm text-red-500 mt-1">{errors.firstName.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Last Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  {...register('lastName', { required: 'Last name is required' })}
                  disabled={!isEditing}
                  className="input pl-10 w-full disabled:bg-slate-50 dark:disabled:bg-slate-800"
                />
              </div>
              {errors.lastName && (
                <p className="text-sm text-red-500 mt-1">{errors.lastName.message}</p>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Headline
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  {...register('headline')}
                  placeholder="e.g. Senior Product Manager at Tech Corp"
                  disabled={!isEditing}
                  className="input pl-10 w-full disabled:bg-slate-50 dark:disabled:bg-slate-800"
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Bio
              </label>
              <textarea
                {...register('bio')}
                rows={4}
                placeholder="Tell us about yourself..."
                disabled={!isEditing}
                className="input w-full disabled:bg-slate-50 dark:disabled:bg-slate-800 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  {...register('location')}
                  placeholder="City, Country"
                  disabled={!isEditing}
                  className="input pl-10 w-full disabled:bg-slate-50 dark:disabled:bg-slate-800"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Phone
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  {...register('phone')}
                  placeholder="+1 (555) 000-0000"
                  disabled={!isEditing}
                  className="input pl-10 w-full disabled:bg-slate-50 dark:disabled:bg-slate-800"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Skills
          </h2>
          <div className="space-y-4">
            {mySkills && mySkills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {mySkills.map((skill: any) => (
                  <span
                    key={skill.skillId}
                    className="inline-flex items-center px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm"
                  >
                    {skill.name}
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => removeSkillMutation.mutate(skill.skillId)}
                        className="ml-2 hover:text-primary-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No skills added yet.
              </p>
            )}

            {isEditing && (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSkill();
                    }
                  }}
                  placeholder="Add a skill..."
                  className="input flex-1"
                />
                <button
                  type="button"
                  onClick={handleAddSkill}
                  disabled={addSkillMutation.isPending}
                  className="btn-primary p-2.5"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Social Links */}
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Social Links
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Website
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  {...register('website')}
                  placeholder="https://yourwebsite.com"
                  disabled={!isEditing}
                  className="input pl-10 w-full disabled:bg-slate-50 dark:disabled:bg-slate-800"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                LinkedIn
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  {...register('linkedinUrl')}
                  placeholder="https://linkedin.com/in/yourprofile"
                  disabled={!isEditing}
                  className="input pl-10 w-full disabled:bg-slate-50 dark:disabled:bg-slate-800"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Twitter
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  {...register('twitterUrl')}
                  placeholder="https://twitter.com/yourhandle"
                  disabled={!isEditing}
                  className="input pl-10 w-full disabled:bg-slate-50 dark:disabled:bg-slate-800"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                GitHub
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  {...register('githubUrl')}
                  placeholder="https://github.com/yourusername"
                  disabled={!isEditing}
                  className="input pl-10 w-full disabled:bg-slate-50 dark:disabled:bg-slate-800"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Email (read-only) */}
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Account Email
          </h2>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                value={user?.email || ''}
                disabled
                className="input pl-10 w-full bg-slate-50 dark:bg-slate-800 cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              To change your email, please contact support.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
