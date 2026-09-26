'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  TrendingUp,
  Sparkles,
  Target,
  Clock,
  BookOpen,
  Award,
  ChevronRight,
  CheckCircle2,
  Circle,
  Briefcase,
  RefreshCw,
  Lightbulb,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useGenerateCareerPath } from '@/lib/hooks';
import { aiApi } from '@/lib/api';
import { cn, formatSalary } from '@/lib/utils';
import PremiumGate from '../PremiumGate';

interface CareerMilestone {
  id: string;
  title: string;
  level: string;
  salary: { min: number; max: number };
  timeline: string;
  skills: string[];
  description: string;
  requirements: string[];
  completed?: boolean;
  current?: boolean;
}

/** The parts of the server's CareerPathPlan this page shows beyond the milestones. */
type PlanExtras = {
  matchScore: number | null;
  recommendedRoles: string[];
  learningPath: string[];
  careerAdvice: string | null;
};

const EMPTY_EXTRAS: PlanExtras = { matchScore: null, recommendedRoles: [], learningPath: [], careerAdvice: null };

/** What either career-path route answers with, read defensively: it is model output. */
type PlanResponse = {
  simulated?: boolean;
  milestones?: unknown;
  matchScore?: unknown;
  recommendedRoles?: unknown;
  learningPath?: unknown;
  careerAdvice?: unknown;
  targetLevel?: string | null;
  currentProfile?: { headline?: string | null };
};

const stringsOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '') : [];

export default function CareerPathPage() {
  const [currentRole, setCurrentRole] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [yearsExperience, setYearsExperience] = useState(3);
  const [pathGenerated, setPathGenerated] = useState(false);
  const [milestones, setMilestones] = useState<CareerMilestone[]>([]);
  const [extras, setExtras] = useState<PlanExtras>(EMPTY_EXTRAS);
  const [pathError, setPathError] = useState<string | null>(null);
  // Which of the two routes drew the plan on screen, so Regenerate asks the same one.
  const [source, setSource] = useState<'form' | 'profile'>('form');

  const { mutate: generatePath, isPending } = useGenerateCareerPath();

  /**
   * GET /ai/career-path plans from what her ATHENA profile already holds —
   * headline, skills, experience and education — and nothing on the web app
   * ever called it. It is offered beside the form for a member whose profile
   * already says what the form asks.
   */
  const profilePlan = useMutation({
    mutationFn: async () => {
      const response = await aiApi.careerPath();
      return response.data?.data;
    },
  });

  const failPlan = (error: unknown) => {
    setMilestones([]);
    setExtras(EMPTY_EXTRAS);
    setPathGenerated(false);
    setPathError(
      (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Career path generation is unavailable right now. Please try again later.'
    );
  };

  const showPlan = (data: PlanResponse | undefined) => {
    // With no model connected the server says so rather than inventing a
    // plan, and so does this page: nothing is drawn.
    if (data?.simulated) {
      setMilestones([]);
      setExtras(EMPTY_EXTRAS);
      setPathGenerated(false);
      setPathError('The career planner is not connected to its AI model on this deployment, so no plan was made.');
      return;
    }

    // No milestone is marked done. The first used to be drawn with a green
    // tick as "completed" — a step the model had just suggested she take.
    const normalizedMilestones: CareerMilestone[] = Array.isArray(data?.milestones)
      ? data.milestones.map((milestone: any, index: number) => ({
          id: milestone.id || String(index + 1),
          title: milestone.title || milestone.role || `Step ${index + 1}`,
          level: milestone.timeframe || milestone.level || (index === 0 ? 'First step' : 'Next step'),
          salary: {
            min: milestone.salary?.min || milestone.salaryMin || 0,
            max: milestone.salary?.max || milestone.salaryMax || 0,
          },
          timeline: milestone.timeline || milestone.timeframe || 'Timeline not estimated',
          skills: milestone.skills || milestone.skillsToAcquire || [],
          description: milestone.description || milestone.action || '',
          requirements: milestone.requirements || milestone.recommendedActions || [],
          completed: false,
          current: index === 0,
        }))
      : [];
    setMilestones(normalizedMilestones);
    setExtras({
      matchScore: typeof data?.matchScore === 'number' ? data.matchScore : null,
      recommendedRoles: stringsOf(data?.recommendedRoles),
      learningPath: stringsOf(data?.learningPath),
      careerAdvice: typeof data?.careerAdvice === 'string' && data.careerAdvice.trim() ? data.careerAdvice : null,
    });
    setPathGenerated(true);
    if (normalizedMilestones.length === 0) {
      setPathError('The career path service completed but did not return milestones.');
    }
  };

  const handleGenerate = () => {
    if (!currentRole || !targetRole) return;
    setPathError(null);
    setSource('form');

    generatePath(
      { currentRole, targetRole, yearsExperience },
      { onSuccess: showPlan, onError: failPlan }
    );
  };

  const handleProfilePlan = () => {
    setPathError(null);
    setSource('profile');
    profilePlan.mutate(undefined, {
      onSuccess: (data: PlanResponse | undefined) => {
        setCurrentRole(data?.currentProfile?.headline || 'Your ATHENA profile');
        setTargetRole(data?.targetLevel || 'Where the plan leads');
        showPlan(data);
      },
      onError: failPlan,
    });
  };

  const busy = isPending || profilePlan.isPending;

  if (!pathGenerated) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard/ai"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <span className="text-3xl">🚀</span>
              <span>Career Path Planner</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Map your journey from where you are to where you want to be
            </p>
          </div>
        </div>

        {/* The gate is here and not at the route, because POST /ai/career-path
            carries requirePremium on the server and this page had no idea. A
            free member reached the form from the AI hub, the platform
            directory, her persona page or onboarding, filled in her current and
            target role, pressed Generate, and got a toast reading "Failed to
            generate career path" — a 403 rendered as a fault. Nothing told her
            the feature was paid, and nothing offered her the upgrade. */}
        <PremiumGate featureName="Career Path Planner">
        {/* Input Form */}
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
            Tell us about your career goals
          </h2>

          <div className="space-y-6">
            {/* Current Role */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Your Current Role
              </label>
              <input
                type="text"
                value={currentRole}
                onChange={(e) => setCurrentRole(e.target.value)}
                placeholder="e.g., Product Manager, Software Engineer, Marketing Coordinator"
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Target Role */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Your Dream Role
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g., VP of Product, CTO, Chief Marketing Officer"
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Years Experience */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Years of Experience: <span className="text-primary-600">{yearsExperience} years</span>
              </label>
              <input
                type="range"
                min="0"
                max="25"
                value={yearsExperience}
                onChange={(e) => setYearsExperience(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
              />
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>0</span>
                <span>5</span>
                <span>10</span>
                <span>15</span>
                <span>20</span>
                <span>25+</span>
              </div>
            </div>

            {pathError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                {pathError}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!currentRole || !targetRole || busy}
              className="w-full btn-primary py-3 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Generating Your Path...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Generate Career Path</span>
                </>
              )}
            </button>

            <div className="text-center text-sm text-slate-500 dark:text-slate-400">
              <p className="mb-2">Or plan from what your ATHENA profile already says — your headline, skills, experience and education.</p>
              <button
                onClick={handleProfilePlan}
                disabled={busy}
                className="btn-outline inline-flex items-center space-x-2 disabled:opacity-50"
              >
                {profilePlan.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Briefcase className="w-4 h-4" />}
                <span>{profilePlan.isPending ? 'Reading your profile…' : 'Plan from my profile'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* What You'll Get */}
        <div className="card bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center space-x-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            <span>What You'll Get</span>
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-start space-x-3">
              <Target className="w-5 h-5 text-primary-500 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Step-by-Step Roadmap</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">Clear milestones from your current role to your goal</p>
              </div>
            </div>
            {/* "Realistic timeframes" and "Salary Projections: expected
                compensation at each level" were promised here. The model is
                not asked for salaries and returns none, and its timeframes are
                its suggestion, not a forecast; the cards say what comes back. */}
            <div className="flex items-start space-x-3">
              <Clock className="w-5 h-5 text-primary-500 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Rough Timeframes</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">The model&apos;s suggestion for each step — a guide, not a forecast</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <BookOpen className="w-5 h-5 text-primary-500 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Skills to Develop</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">Key skills and competencies for each step</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Lightbulb className="w-5 h-5 text-primary-500 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Roles and Learning</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">Roles to look at next, and what to study on the way</p>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            What you enter is sent to ATHENA&apos;s AI model to write the plan. The plan is not saved; it is gone when you leave this page.
          </p>
        </div>
        </PremiumGate>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setPathGenerated(false)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Your Career Path
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              {currentRole} → {targetRole}
            </p>
          </div>
        </div>
        <button
          onClick={source === 'profile' ? handleProfilePlan : handleGenerate}
          disabled={busy}
          className="btn-outline flex items-center space-x-2 disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', busy && 'animate-spin')} />
          <span>Regenerate</span>
        </button>
      </div>

      {/* Summary Stats. Three of these four were constants — "7-10 Years to
          Goal", "+3x Salary Growth", "12+ Skills to Master" — printed for every
          member over every plan. Each is now counted from the plan on screen,
          and readiness is shown only when the model gave one, labelled as its
          own estimate. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <TrendingUp className="w-6 h-6 text-primary-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {milestones.length}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Steps in this plan
          </div>
        </div>
        <div className="card text-center">
          <Award className="w-6 h-6 text-purple-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {new Set(milestones.flatMap((m) => m.skills.map((s) => s.toLowerCase()))).size}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Skills named
          </div>
        </div>
        <div className="card text-center">
          <Briefcase className="w-6 h-6 text-blue-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {extras.recommendedRoles.length}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Roles to look at
          </div>
        </div>
        <div className="card text-center">
          <Target className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {extras.matchScore !== null ? `${extras.matchScore}%` : '—'}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {extras.matchScore !== null ? 'Readiness, as the model judged it' : 'No readiness estimate given'}
          </div>
        </div>
      </div>

      {/* Career Timeline */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
          Your Career Journey
        </h2>

        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />

          {/* Milestones */}
          <div className="space-y-8">
            {milestones.length === 0 ? (
              <div className="relative pl-16">
                <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                  {pathError || 'No milestones were returned for this path yet.'}
                </div>
              </div>
            ) : milestones.map((milestone, index) => (
              <div key={milestone.id} className="relative pl-16">
                {/* Timeline Dot */}
                <div
                  className={cn(
                    'absolute left-4 w-5 h-5 rounded-full border-2 flex items-center justify-center',
                    milestone.completed
                      ? 'bg-green-500 border-green-500'
                      : milestone.current
                      ? 'bg-primary-500 border-primary-500 animate-pulse'
                      : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'
                  )}
                >
                  {milestone.completed && (
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  )}
                  {milestone.current && !milestone.completed && (
                    <Circle className="w-2 h-2 text-white fill-current" />
                  )}
                </div>

                {/* Milestone Card */}
                <div
                  className={cn(
                    'p-6 rounded-xl border transition',
                    milestone.current
                      ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-primary-200 dark:hover:border-primary-800'
                  )}
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span
                          className={cn(
                            'text-xs font-medium px-2 py-0.5 rounded-full',
                            milestone.completed
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : milestone.current
                              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                          )}
                        >
                          {milestone.level}
                        </span>
                        <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center">
                          <Clock className="w-3.5 h-3.5 mr-1" />
                          {milestone.timeline}
                        </span>
                      </div>
                      <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                        {milestone.title}
                      </h3>
                      <p className="text-slate-600 dark:text-slate-300 mb-4">
                        {milestone.description}
                      </p>

                      {/* Skills */}
                      {milestone.skills.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Key Skills:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {milestone.skills.map((skill, i) => (
                            <span
                              key={i}
                              className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                      )}

                      {/* Requirements */}
                      {milestone.requirements.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Requirements:
                        </p>
                        <ul className="space-y-1">
                          {milestone.requirements.map((req, i) => (
                            <li
                              key={i}
                              className="text-sm text-slate-600 dark:text-slate-400 flex items-center"
                            >
                              <ChevronRight className="w-4 h-4 text-primary-500 mr-1" />
                              {req}
                            </li>
                          ))}
                        </ul>
                      </div>
                      )}
                    </div>

                    {/* Salary */}
                    {(milestone.salary.min > 0 || milestone.salary.max > 0) && (
                    <div className="md:text-right">
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                        Salary Range
                      </p>
                      <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                        {formatSalary(milestone.salary.min)} - {formatSalary(milestone.salary.max)}
                      </p>
                    </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  {!milestone.completed && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-2">
                      <Link
                        href="/dashboard/learn"
                        className="btn-outline text-sm py-1.5 flex items-center space-x-1"
                      >
                        <BookOpen className="w-4 h-4" />
                        <span>Find Courses</span>
                      </Link>
                      <Link
                        href="/dashboard/jobs"
                        className="btn-outline text-sm py-1.5 flex items-center space-x-1"
                      >
                        <Briefcase className="w-4 h-4" />
                        <span>Browse Jobs</span>
                      </Link>
                      <Link
                        href="/dashboard/mentors"
                        className="btn-outline text-sm py-1.5 flex items-center space-x-1"
                      >
                        <Target className="w-4 h-4" />
                        <span>Find Mentor</span>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Next steps, from the plan. These used to be three fixed cards —
          leadership, quantifiable impact, networking — shown under every
          plan as though the model had written them for her, while the advice,
          roles and learning path it did write were dropped on the floor. */}
      {(extras.careerAdvice || extras.recommendedRoles.length > 0 || extras.learningPath.length > 0) && (
        <div className="card bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
            📌 From your plan
          </h3>
          <div className="space-y-3">
            {extras.careerAdvice && (
              <p className="p-3 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-300">
                {extras.careerAdvice}
              </p>
            )}
            {extras.recommendedRoles.length > 0 && (
              <div className="p-3 bg-white dark:bg-slate-800 rounded-lg">
                <p className="font-medium text-slate-900 dark:text-white mb-1">Roles to look at</p>
                <ul className="space-y-1">
                  {extras.recommendedRoles.map((role) => (
                    <li key={role} className="text-sm text-slate-600 dark:text-slate-400 flex items-start">
                      <CheckCircle2 className="w-4 h-4 text-primary-500 mr-2 mt-0.5 flex-shrink-0" />
                      {role}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {extras.learningPath.length > 0 && (
              <div className="p-3 bg-white dark:bg-slate-800 rounded-lg">
                <p className="font-medium text-slate-900 dark:text-white mb-1">What to learn</p>
                <ul className="space-y-1">
                  {extras.learningPath.map((item) => (
                    <li key={item} className="text-sm text-slate-600 dark:text-slate-400 flex items-start">
                      <BookOpen className="w-4 h-4 text-primary-500 mr-2 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Written by an AI model from what you gave it. It can be wrong, and it is not saved: note down anything you want to keep.
      </p>
    </div>
  );
}
