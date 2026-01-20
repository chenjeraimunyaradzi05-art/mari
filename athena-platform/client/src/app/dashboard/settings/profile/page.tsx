'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
} from 'lucide-react';
import { useAuth, useUpdateProfile, useMySkills, useAddSkill, useRemoveSkill } from '@/lib/hooks';
import { getInitials, PERSONA_LABELS } from '@/lib/utils';

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Profile Settings
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Avatar Section */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
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
              <h3 className="font-medium text-gray-900 dark:text-white">
                {user?.firstName} {user?.lastName}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {user?.persona ? PERSONA_LABELS[user.persona] : 'ATHENA Member'}
              </p>
              {isEditing && (
                <p className="text-xs text-gray-400 mt-2">
                  JPG, PNG or GIF. Max 5MB.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Basic Information */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Basic Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                First Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('firstName', { required: 'First name is required' })}
                  disabled={!isEditing}
                  className="input pl-10 w-full disabled:bg-gray-50 dark:disabled:bg-gray-800"
                />
              </div>
              {errors.firstName && (
                <p className="text-sm text-red-500 mt-1">{errors.firstName.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Last Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('lastName', { required: 'Last name is required' })}
                  disabled={!isEditing}
                  className="input pl-10 w-full disabled:bg-gray-50 dark:disabled:bg-gray-800"
                />
              </div>
              {errors.lastName && (
                <p className="text-sm text-red-500 mt-1">{errors.lastName.message}</p>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Headline
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('headline')}
                  placeholder="e.g. Senior Product Manager at Tech Corp"
                  disabled={!isEditing}
                  className="input pl-10 w-full disabled:bg-gray-50 dark:disabled:bg-gray-800"
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bio
              </label>
              <textarea
                {...register('bio')}
                rows={4}
                placeholder="Tell us about yourself..."
                disabled={!isEditing}
                className="input w-full disabled:bg-gray-50 dark:disabled:bg-gray-800 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('location')}
                  placeholder="City, Country"
                  disabled={!isEditing}
                  className="input pl-10 w-full disabled:bg-gray-50 dark:disabled:bg-gray-800"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('phone')}
                  placeholder="+1 (555) 000-0000"
                  disabled={!isEditing}
                  className="input pl-10 w-full disabled:bg-gray-50 dark:disabled:bg-gray-800"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
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
              <p className="text-sm text-gray-500 dark:text-gray-400">
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Social Links
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Website
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('website')}
                  placeholder="https://yourwebsite.com"
                  disabled={!isEditing}
                  className="input pl-10 w-full disabled:bg-gray-50 dark:disabled:bg-gray-800"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                LinkedIn
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('linkedinUrl')}
                  placeholder="https://linkedin.com/in/yourprofile"
                  disabled={!isEditing}
                  className="input pl-10 w-full disabled:bg-gray-50 dark:disabled:bg-gray-800"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Twitter
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('twitterUrl')}
                  placeholder="https://twitter.com/yourhandle"
                  disabled={!isEditing}
                  className="input pl-10 w-full disabled:bg-gray-50 dark:disabled:bg-gray-800"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                GitHub
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('githubUrl')}
                  placeholder="https://github.com/yourusername"
                  disabled={!isEditing}
                  className="input pl-10 w-full disabled:bg-gray-50 dark:disabled:bg-gray-800"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Email (read-only) */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Account Email
          </h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                value={user?.email || ''}
                disabled
                className="input pl-10 w-full bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              To change your email, please contact support.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
