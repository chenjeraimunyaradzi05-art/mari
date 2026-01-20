'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Briefcase,
  GraduationCap,
  Target,
  CheckCircle,
  Upload,
  Plus,
  X,
} from 'lucide-react';
import { useUpdateProfile, useAuth, useMySkills, useRemoveSkill } from '@/lib/hooks';
import { userApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { PERSONA_LABELS, cn } from '@/lib/utils';

const steps = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'basics', title: 'Basic Info' },
  { id: 'experience', title: 'Experience' },
  { id: 'skills', title: 'Skills' },
  { id: 'goals', title: 'Goals' },
  { id: 'complete', title: 'Complete' },
];

const skillSuggestions = [
  'JavaScript', 'TypeScript', 'Python', 'React', 'Node.js',
  'Product Management', 'Data Analysis', 'UX Design', 'Machine Learning',
  'Project Management', 'Leadership', 'Marketing', 'Sales', 'Finance',
  'Communication', 'Problem Solving', 'Team Management', 'Agile',
];

const goalOptions = [
  { id: 'new_job', label: 'Find a new job', icon: Briefcase },
  { id: 'career_change', label: 'Change careers', icon: Target },
  { id: 'skill_up', label: 'Learn new skills', icon: GraduationCap },
  { id: 'networking', label: 'Build my network', icon: Sparkles },
  { id: 'mentorship', label: 'Find a mentor', icon: GraduationCap },
  { id: 'start_business', label: 'Start a business', icon: Target },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();
  const { data: mySkills } = useMySkills();
  const removeSkillMutation = useRemoveSkill();
  const [isSavingSkills, setIsSavingSkills] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    headline: '',
    bio: '',
    location: '',
    currentRole: '',
    currentCompany: '',
    yearsExperience: '',
    skills: [] as string[],
    goals: [] as string[],
  });
  const [newSkill, setNewSkill] = useState('');

  useEffect(() => {
    if (!mySkills?.length) return;
    if (formData.skills.length) return;

    setFormData((prev) => ({
      ...prev,
      skills: mySkills.map((skill: { name: string }) => skill.name),
    }));
  }, [mySkills, formData.skills.length]);

  const nonEmpty = (value: string) => {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  };

  const parseYearsExperience = (value: string): number | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    // UI options are ranges like "0-1", "5-10", "10+".
    const match = trimmed.match(/^(\d+)/);
    if (!match) return undefined;
    const num = Number(match[1]);
    return Number.isFinite(num) ? num : undefined;
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkipOnboarding = () => {
    router.push('/dashboard');
  };

  const handleComplete = async () => {
    const payload = {
      headline: nonEmpty(formData.headline),
      bio: nonEmpty(formData.bio),
      city: nonEmpty(formData.location),
      currentJobTitle: nonEmpty(formData.currentRole),
      currentCompany: nonEmpty(formData.currentCompany),
      yearsExperience: parseYearsExperience(formData.yearsExperience),
    };

    setIsSavingSkills(true);
    try {
      await updateProfile.mutateAsync(payload as any);

      const skillsToSave = Array.from(
        new Set(formData.skills.map((s) => s.trim()).filter(Boolean))
      );

      if (skillsToSave.length) {
        await Promise.allSettled(skillsToSave.map((skillName) => userApi.addSkill(skillName)));
      }

      router.push('/dashboard');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to complete onboarding');
    } finally {
      setIsSavingSkills(false);
    }
  };

  const addSkill = (skill: string) => {
    if (skill && !formData.skills.includes(skill)) {
      setFormData({ ...formData, skills: [...formData.skills, skill] });
    }
    setNewSkill('');
  };

  const removeSkill = (skill: string) => {
    const match = mySkills?.find(
      (s: { skillId: string; name: string }) => s.name.toLowerCase() === skill.toLowerCase()
    );

    if (match) {
      removeSkillMutation.mutate(match.skillId);
    }

    setFormData({
      ...formData,
      skills: formData.skills.filter((s) => s !== skill),
    });
  };

  const toggleGoal = (goalId: string) => {
    if (formData.goals.includes(goalId)) {
      setFormData({
        ...formData,
        goals: formData.goals.filter((g) => g !== goalId),
      });
    } else {
      setFormData({ ...formData, goals: [...formData.goals, goalId] });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  'flex items-center',
                  index < steps.length - 1 && 'flex-1'
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition',
                    index < currentStep
                      ? 'bg-primary-600 text-white'
                      : index === currentStep
                      ? 'bg-primary-600 text-white ring-4 ring-primary-100'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                  )}
                >
                  {index < currentStep ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-1 mx-2',
                      index < currentStep
                        ? 'bg-primary-600'
                        : 'bg-gray-200 dark:bg-gray-700'
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8">
          {/* Step 0: Welcome */}
          {currentStep === 0 && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                Welcome to ATHENA, {user?.firstName}! 🎉
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">
                Your journey to career success starts here.
              </p>
              <p className="text-gray-500 dark:text-gray-400 mb-8">
                Let's set up your profile to unlock personalized recommendations
                and connect you with the right opportunities.
              </p>
              <div className="bg-primary-50 dark:bg-primary-900/30 rounded-lg p-4 mb-8">
                <p className="text-sm text-primary-700 dark:text-primary-300">
                  <strong>Tip:</strong> A complete profile gets 5x more visibility
                  and better job matches!
                </p>
              </div>
            </div>
          )}

          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Tell us about yourself
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                This information helps us personalize your experience.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Professional Headline
                  </label>
                  <input
                    type="text"
                    value={formData.headline}
                    onChange={(e) =>
                      setFormData({ ...formData, headline: e.target.value })
                    }
                    placeholder="e.g. Senior Product Manager | Tech Enthusiast"
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Bio
                  </label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) =>
                      setFormData({ ...formData, bio: e.target.value })
                    }
                    rows={4}
                    placeholder="Tell us a bit about your background and what you're passionate about..."
                    className="input w-full resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    placeholder="e.g. Sydney, Australia"
                    className="input w-full"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Experience */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Your experience
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Help us understand your professional background.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Current Role
                  </label>
                  <input
                    type="text"
                    value={formData.currentRole}
                    onChange={(e) =>
                      setFormData({ ...formData, currentRole: e.target.value })
                    }
                    placeholder="e.g. Software Engineer"
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Company
                  </label>
                  <input
                    type="text"
                    value={formData.currentCompany}
                    onChange={(e) =>
                      setFormData({ ...formData, currentCompany: e.target.value })
                    }
                    placeholder="e.g. Tech Corp"
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Years of Experience
                  </label>
                  <select
                    value={formData.yearsExperience}
                    onChange={(e) =>
                      setFormData({ ...formData, yearsExperience: e.target.value })
                    }
                    className="input w-full"
                  >
                    <option value="">Select...</option>
                    <option value="0-1">Less than 1 year</option>
                    <option value="1-3">1-3 years</option>
                    <option value="3-5">3-5 years</option>
                    <option value="5-10">5-10 years</option>
                    <option value="10+">10+ years</option>
                  </select>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <Upload className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Upload your resume
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        We'll use AI to auto-fill your profile (optional)
                      </p>
                    </div>
                  </div>
                  <button className="mt-3 btn-outline px-4 py-2 text-sm">
                    Choose File
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Skills */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Your skills
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Add skills to help us match you with the right opportunities.
              </p>

              {/* Selected Skills */}
              {formData.skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {formData.skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm"
                    >
                      {skill}
                      <button
                        onClick={() => removeSkill(skill)}
                        className="ml-2 hover:text-primary-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Add Skill Input */}
              <div className="flex items-center space-x-2 mb-4">
                <input
                  type="text"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addSkill(newSkill)}
                  placeholder="Type a skill..."
                  className="input flex-1"
                />
                <button
                  onClick={() => addSkill(newSkill)}
                  className="btn-primary p-2.5"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* Skill Suggestions */}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Suggested skills:
                </p>
                <div className="flex flex-wrap gap-2">
                  {skillSuggestions
                    .filter((s) => !formData.skills.includes(s))
                    .slice(0, 12)
                    .map((skill) => (
                      <button
                        key={skill}
                        onClick={() => addSkill(skill)}
                        className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                      >
                        + {skill}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Goals */}
          {currentStep === 4 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Your goals
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                What are you looking to achieve with ATHENA? (Select all that apply)
              </p>
              <div className="grid grid-cols-2 gap-3">
                {goalOptions.map((goal) => (
                  <button
                    key={goal.id}
                    onClick={() => toggleGoal(goal.id)}
                    className={cn(
                      'flex items-center space-x-3 p-4 rounded-lg border-2 transition text-left',
                      formData.goals.includes(goal.id)
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    )}
                  >
                    <div
                      className={cn(
                        'p-2 rounded-lg',
                        formData.goals.includes(goal.id)
                          ? 'bg-primary-100 dark:bg-primary-900'
                          : 'bg-gray-100 dark:bg-gray-800'
                      )}
                    >
                      <goal.icon
                        className={cn(
                          'w-5 h-5',
                          formData.goals.includes(goal.id)
                            ? 'text-primary-600'
                            : 'text-gray-500'
                        )}
                      />
                    </div>
                    <span
                      className={cn(
                        'font-medium',
                        formData.goals.includes(goal.id)
                          ? 'text-primary-700 dark:text-primary-300'
                          : 'text-gray-700 dark:text-gray-300'
                      )}
                    >
                      {goal.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Complete */}
          {currentStep === 5 && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                You're all set! 🚀
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
                Your profile is ready. Let's start exploring opportunities!
              </p>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-left mb-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  What's next?
                </h3>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Browse personalized job recommendations</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Explore AI-powered career tools</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Connect with mentors and the community</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
            <div>
              {currentStep > 0 && currentStep < 5 && (
                <button
                  onClick={handlePrevious}
                  className="flex items-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition"
                >
                  <ChevronLeft className="w-5 h-5 mr-1" />
                  Back
                </button>
              )}
            </div>
            <div className="flex items-center space-x-3">
              {currentStep < 5 && (
                <button
                  onClick={handleSkipOnboarding}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition"
                >
                  Skip for now
                </button>
              )}
              {currentStep < 5 ? (
                <button
                  onClick={handleNext}
                  className="btn-primary px-6 py-2.5 flex items-center"
                >
                  {currentStep === 0 ? "Let's Go" : 'Continue'}
                  <ChevronRight className="w-5 h-5 ml-1" />
                </button>
              ) : (
                <button
                  onClick={handleComplete}
                  disabled={updateProfile.isPending}
                  className="btn-primary px-8 py-2.5"
                >
                  {updateProfile.isPending ? 'Saving...' : 'Go to Dashboard'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
