'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Loader2, CheckCircle, Clock, Target } from 'lucide-react';
import { communitySupportApi } from '@/lib/api';

type Program = {
  id: string;
  name: string;
  communityType: string;
  description: string;
  eligibilityDesc?: string;
  objectives: string[];
  partnerOrgs: string[];
  maxParticipants?: number;
  currentParticipants: number;
  isActive: boolean;
  milestones: { id: string; title: string; description?: string }[];
  _count: { enrollments: number };
};

type Enrollment = {
  id: string;
  status: string;
  enrolledAt: string;
  program: Program;
  milestoneProgress: { milestoneId: string; isCompleted: boolean }[];
};

const communityTypeLabels: Record<string, string> = {
  FIRST_NATIONS: 'First Nations',
  REFUGEE_IMMIGRANT: 'Refugee & Immigrant',
  DV_SURVIVOR: 'DV Survivor',
  DISABILITY: 'Disability',
  LGBTQIA: 'LGBTQIA+',
  SINGLE_PARENT: 'Single Parent',
  RURAL_REGIONAL: 'Rural & Regional',
  GENERAL: 'General',
};

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  COMPLETED: 'bg-blue-50 text-blue-700',
  PAUSED: 'bg-yellow-50 text-yellow-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [programsRes, enrollmentsRes] = await Promise.all([
        communitySupportApi.getPrograms({ communityType: filterType || undefined }),
        communitySupportApi.getMyEnrollments(),
      ]);
      setPrograms(programsRes.data?.data || []);
      setEnrollments(enrollmentsRes.data?.data || []);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to load programs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

  const handleEnroll = async (programId: string) => {
    setEnrolling(programId);
    setError(null);
    try {
      await communitySupportApi.enrollInProgram(programId);
      await loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to enroll');
    } finally {
      setEnrolling(null);
    }
  };

  const enrolledProgramIds = enrollments.map((e) => e.program.id);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-purple-600">
          <Users className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Support Programs</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
          Community Support Programs
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Tailored programs to help you achieve your goals
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>
      )}

      {/* My Enrollments */}
      {enrollments.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">My Enrollments</h2>
          <div className="space-y-4">
            {enrollments.map((enrollment) => {
              const completedMilestones = enrollment.milestoneProgress.filter((p) => p.isCompleted).length;
              const totalMilestones = enrollment.program.milestones.length;
              const progress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

              return (
                <div
                  key={enrollment.id}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{enrollment.program.name}</h3>
                      <p className="text-xs text-gray-500">
                        {communityTypeLabels[enrollment.program.communityType] || enrollment.program.communityType}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full self-start ${statusColors[enrollment.status]}`}>
                      {enrollment.status}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span>{completedMilestones} of {totalMilestones} milestones</span>
                      <span className="text-gray-500">{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {enrollment.program.milestones.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {enrollment.program.milestones.slice(0, 3).map((milestone) => {
                        const isComplete = enrollment.milestoneProgress.some(
                          (p) => p.milestoneId === milestone.id && p.isCompleted
                        );
                        return (
                          <div key={milestone.id} className="flex items-center gap-2 text-sm">
                            {isComplete ? (
                              <CheckCircle className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Clock className="w-4 h-4 text-gray-400" />
                            )}
                            <span className={isComplete ? 'text-gray-500 line-through' : 'text-gray-700 dark:text-gray-300'}>
                              {milestone.title}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Filter */}
      <div className="flex items-center gap-4">
        <label className="text-sm text-gray-600 dark:text-gray-400">Filter by community:</label>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
        >
          <option value="">All communities</option>
          {Object.entries(communityTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Available Programs */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading programs...
        </div>
      ) : programs.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 text-center text-sm text-gray-500">
          No programs available in this category.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {programs.map((program) => {
            const isEnrolled = enrolledProgramIds.includes(program.id);
            const isFull = program.maxParticipants && program.currentParticipants >= program.maxParticipants;

            return (
              <div
                key={program.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 flex flex-col"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-xs text-purple-600 font-medium">
                      {communityTypeLabels[program.communityType] || program.communityType}
                    </span>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{program.name}</h3>
                  </div>
                  {program.maxParticipants && (
                    <span className="text-xs text-gray-500">
                      {program.currentParticipants}/{program.maxParticipants}
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{program.description}</p>

                {program.objectives.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                      <Target className="w-3 h-3" /> Objectives
                    </p>
                    <ul className="text-sm space-y-1">
                      {program.objectives.slice(0, 3).map((obj, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                          <span className="text-purple-500">•</span> {obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {program.partnerOrgs.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-1">
                    {program.partnerOrgs.slice(0, 3).map((org, idx) => (
                      <span key={idx} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400">
                        {org}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-auto">
                  {isEnrolled ? (
                    <button disabled className="w-full btn-secondary opacity-50">Already enrolled</button>
                  ) : isFull ? (
                    <button disabled className="w-full btn-secondary opacity-50">Program full</button>
                  ) : (
                    <button
                      onClick={() => handleEnroll(program.id)}
                      disabled={enrolling === program.id}
                      className="w-full btn-primary"
                    >
                      {enrolling === program.id ? 'Enrolling...' : 'Enroll now'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-center">
        <Link href="/dashboard/impact" className="text-sm text-primary-600 hover:underline">
          ← Back to Impact Hub
        </Link>
      </div>
    </div>
  );
}
