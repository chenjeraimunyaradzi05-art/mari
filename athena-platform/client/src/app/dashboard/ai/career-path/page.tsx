'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  TrendingUp,
  Sparkles,
  Target,
  Clock,
  DollarSign,
  BookOpen,
  Award,
  ChevronRight,
  CheckCircle2,
  Circle,
  MapPin,
  Briefcase,
  RefreshCw,
  Lightbulb,
} from 'lucide-react';
import { useGenerateCareerPath } from '@/lib/hooks';
import { cn, formatSalary } from '@/lib/utils';

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

export default function CareerPathPage() {
  const [currentRole, setCurrentRole] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [yearsExperience, setYearsExperience] = useState(3);
  const [pathGenerated, setPathGenerated] = useState(false);
  const [milestones, setMilestones] = useState<CareerMilestone[]>([]);
  const [pathError, setPathError] = useState<string | null>(null);

  const { mutate: generatePath, isPending } = useGenerateCareerPath();

  const handleGenerate = () => {
    if (!currentRole || !targetRole) return;
    setPathError(null);

    generatePath(
      { currentRole, targetRole, yearsExperience },
      {
        onSuccess: (data) => {
          const normalizedMilestones = Array.isArray(data?.milestones)
            ? data.milestones.map((milestone: any, index: number) => ({
                id: milestone.id || String(index + 1),
                title: milestone.title || milestone.role || `Step ${index + 1}`,
                level: milestone.timeframe || milestone.level || (index === 0 ? 'Current' : 'Next Step'),
                salary: {
                  min: milestone.salary?.min || milestone.salaryMin || 0,
                  max: milestone.salary?.max || milestone.salaryMax || 0,
                },
                timeline: milestone.timeline || milestone.timeframe || 'Timeline not estimated',
                skills: milestone.skills || milestone.skillsToAcquire || [],
                description: milestone.description || milestone.action || '',
                requirements: milestone.requirements || milestone.recommendedActions || [],
                completed: index === 0,
                current: index === 0,
              }))
            : [];
          setMilestones(normalizedMilestones);
          setPathGenerated(true);
          if (normalizedMilestones.length === 0) {
            setPathError('The career path service completed but did not return milestones.');
          }
        },
        onError: (error: any) => {
          setMilestones([]);
          setPathGenerated(false);
          setPathError(
            error?.response?.data?.message ||
              'Career path generation is unavailable right now. Please try again later.'
          );
        },
      }
    );
  };

  if (!pathGenerated) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard/ai"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <span className="text-3xl">🚀</span>
              <span>Career Path Planner</span>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Map your journey from where you are to where you want to be
            </p>
          </div>
        </div>

        {/* Input Form */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Tell us about your career goals
          </h2>

          <div className="space-y-6">
            {/* Current Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Your Current Role
              </label>
              <input
                type="text"
                value={currentRole}
                onChange={(e) => setCurrentRole(e.target.value)}
                placeholder="e.g., Product Manager, Software Engineer, Marketing Coordinator"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Target Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Your Dream Role
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g., VP of Product, CTO, Chief Marketing Officer"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Years Experience */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Years of Experience: <span className="text-primary-600">{yearsExperience} years</span>
              </label>
              <input
                type="range"
                min="0"
                max="25"
                value={yearsExperience}
                onChange={(e) => setYearsExperience(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
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
              disabled={!currentRole || !targetRole || isPending}
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
          </div>
        </div>

        {/* What You'll Get */}
        <div className="card bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            <span>What You'll Get</span>
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-start space-x-3">
              <Target className="w-5 h-5 text-primary-500 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Step-by-Step Roadmap</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Clear milestones from your current role to your goal</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Clock className="w-5 h-5 text-primary-500 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Timeline Estimates</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Realistic timeframes for each career transition</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <BookOpen className="w-5 h-5 text-primary-500 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Skills to Develop</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Key skills and competencies for each level</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <DollarSign className="w-5 h-5 text-primary-500 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Salary Projections</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Expected compensation at each level</p>
              </div>
            </div>
          </div>
        </div>
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
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Your Career Path
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              {currentRole} → {targetRole}
            </p>
          </div>
        </div>
        <button onClick={handleGenerate} className="btn-outline flex items-center space-x-2">
          <RefreshCw className="w-4 h-4" />
          <span>Regenerate</span>
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <TrendingUp className="w-6 h-6 text-primary-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {milestones.length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Career Milestones
          </div>
        </div>
        <div className="card text-center">
          <Clock className="w-6 h-6 text-blue-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            7-10
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Years to Goal
          </div>
        </div>
        <div className="card text-center">
          <DollarSign className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            +3x
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Salary Growth
          </div>
        </div>
        <div className="card text-center">
          <Award className="w-6 h-6 text-purple-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            12+
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Skills to Master
          </div>
        </div>
      </div>

      {/* Career Timeline */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Your Career Journey
        </h2>

        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

          {/* Milestones */}
          <div className="space-y-8">
            {milestones.length === 0 ? (
              <div className="relative pl-16">
                <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
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
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
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
                      : 'border-gray-200 dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-800'
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
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                          )}
                        >
                          {milestone.level}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                          <Clock className="w-3.5 h-3.5 mr-1" />
                          {milestone.timeline}
                        </span>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        {milestone.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300 mb-4">
                        {milestone.description}
                      </p>

                      {/* Skills */}
                      {milestone.skills.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Key Skills:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {milestone.skills.map((skill, i) => (
                            <span
                              key={i}
                              className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full"
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
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Requirements:
                        </p>
                        <ul className="space-y-1">
                          {milestone.requirements.map((req, i) => (
                            <li
                              key={i}
                              className="text-sm text-gray-600 dark:text-gray-400 flex items-center"
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
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
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
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-2">
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

      {/* Recommendations */}
      <div className="card bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          📌 Recommended Next Steps
        </h3>
        <div className="space-y-3">
          <div className="flex items-start space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-primary-500 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                Develop leadership skills
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Take on mentoring responsibilities and lead cross-functional projects
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-primary-500 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                Build quantifiable impact
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Track and document metrics that demonstrate business value
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-primary-500 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                Expand your network
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Connect with leaders in your target role through industry events
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
