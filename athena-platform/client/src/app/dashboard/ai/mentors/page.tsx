'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Users, Loader2, Star, MessageCircle, Calendar, MapPin, Briefcase, Filter } from 'lucide-react';
import { aiAlgorithmsApi } from '@/lib/api';

type MentorMatch = {
  id: string;
  mentorId: string;
  mentor: {
    id: string;
    name: string;
    title?: string;
    company?: string;
    location?: string;
    bio?: string;
    avatarUrl?: string;
    industry?: string[];
    yearsExperience?: number;
    rating?: number;
    menteeCount?: number;
  };
  compatibilityScore: number;
  careerPathSimilarity: number;
  experienceGapScore: number;
  communicationStyleFit: number;
  availabilityMatch: number;
  industryOverlap: number;
  skillsToLearn: string[];
  matchReason: string;
  status: string;
};

const skillsAreas = [
  'Technology', 'Leadership', 'Finance', 'Marketing', 'Design',
  'Sales', 'Operations', 'Product', 'Data Science', 'Entrepreneurship'
];

export default function MentorMatchPage() {
  const [matches, setMatches] = useState<MentorMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [skillFilter, setSkillFilter] = useState<string>('');
  const [industryFilter, setIndustryFilter] = useState<string>('');
  const [minScore, setMinScore] = useState<number>(0);
  const [showFilters, setShowFilters] = useState(false);

  const loadMatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await aiAlgorithmsApi.getMentorMatches({
        skill: skillFilter || undefined,
        industry: industryFilter || undefined,
        minScore: minScore > 0 ? minScore : undefined,
      });
      setMatches(response.data?.data || []);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to load mentor matches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyFilters = () => {
    loadMatches();
    setShowFilters(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50';
    if (score >= 60) return 'text-blue-600 bg-blue-50';
    if (score >= 40) return 'text-amber-600 bg-amber-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-purple-600">
            <Users className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">MentorMatch</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
            AI Mentor Recommendations
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Mentors matched to your career goals and learning style
          </p>
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Skill Area
              </label>
              <select
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
              >
                <option value="">All skills</option>
                {skillsAreas.map(skill => (
                  <option key={skill} value={skill}>{skill}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Industry
              </label>
              <input
                type="text"
                value={industryFilter}
                onChange={(e) => setIndustryFilter(e.target.value)}
                placeholder="e.g. Technology, Healthcare"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Minimum Match Score
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-full"
              />
              <span className="text-sm text-gray-500">{minScore}%</span>
            </div>
          </div>
          <button
            onClick={handleApplyFilters}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
          >
            Apply Filters
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : matches.length === 0 ? (
        <div className="text-center py-20">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No mentor matches found</h3>
          <p className="text-gray-500 mt-1">Complete your profile to get AI-powered mentor recommendations</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{matches.length}</p>
              <p className="text-sm text-gray-500">Matched Mentors</p>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Math.round(matches.reduce((acc, m) => acc + m.compatibilityScore, 0) / matches.length)}%
              </p>
              <p className="text-sm text-gray-500">Avg. Compatibility</p>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {matches.filter(m => m.compatibilityScore >= 80).length}
              </p>
              <p className="text-sm text-gray-500">High Match (80%+)</p>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Array.from(new Set(matches.flatMap(m => m.skillsToLearn))).length}
              </p>
              <p className="text-sm text-gray-500">Skills to Learn</p>
            </div>
          </div>

          {/* Mentor Cards */}
          <div className="space-y-4">
            {matches.map((match) => (
              <div
                key={match.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6"
              >
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Mentor Info */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                      {match.mentor.avatarUrl ? (
                        <Image
                          src={match.mentor.avatarUrl}
                          alt={match.mentor.name || 'Mentor'}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <span className="text-2xl font-bold text-purple-600">
                          {match.mentor.name?.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {match.mentor.name}
                      </h3>
                      {match.mentor.title && (
                        <p className="text-gray-600 dark:text-gray-400">
                          {match.mentor.title}
                          {match.mentor.company && ` at ${match.mentor.company}`}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
                        {match.mentor.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {match.mentor.location}
                          </span>
                        )}
                        {match.mentor.yearsExperience && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-3 h-3" />
                            {match.mentor.yearsExperience} years experience
                          </span>
                        )}
                        {match.mentor.rating && (
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-500" />
                            {match.mentor.rating.toFixed(1)}
                          </span>
                        )}
                        {match.mentor.menteeCount != null && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {match.mentor.menteeCount} mentees
                          </span>
                        )}
                      </div>
                      {match.matchReason && (
                        <p className="text-sm text-purple-600 mt-2">
                          💡 {match.matchReason}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Match Score */}
                  <div className="flex flex-col items-center justify-center">
                    <div className={`w-20 h-20 rounded-full flex flex-col items-center justify-center ${getScoreColor(match.compatibilityScore)}`}>
                      <span className="text-2xl font-bold">{Math.round(match.compatibilityScore)}%</span>
                      <span className="text-xs">Match</span>
                    </div>
                  </div>
                </div>

                {/* Score Breakdown */}
                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Compatibility Breakdown</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900 dark:text-white">
                        {Math.round(match.careerPathSimilarity)}%
                      </div>
                      <div className="text-xs text-gray-500">Career Path</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900 dark:text-white">
                        {Math.round(match.experienceGapScore)}%
                      </div>
                      <div className="text-xs text-gray-500">Experience Gap</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900 dark:text-white">
                        {Math.round(match.communicationStyleFit)}%
                      </div>
                      <div className="text-xs text-gray-500">Communication</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900 dark:text-white">
                        {Math.round(match.availabilityMatch)}%
                      </div>
                      <div className="text-xs text-gray-500">Availability</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900 dark:text-white">
                        {Math.round(match.industryOverlap)}%
                      </div>
                      <div className="text-xs text-gray-500">Industry</div>
                    </div>
                  </div>
                </div>

                {/* Skills to Learn */}
                {match.skillsToLearn.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Skills You&apos;ll Learn</h4>
                    <div className="flex flex-wrap gap-2">
                      {match.skillsToLearn.map((skill) => (
                        <span
                          key={skill}
                          className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                  <button className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 flex items-center justify-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Connect
                  </button>
                  <button className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Schedule
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center">
        <Link href="/dashboard/ai" className="text-sm text-primary-600 hover:underline">
          ← Back to AI Tools
        </Link>
      </div>
    </div>
  );
}
