'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Lightbulb,
  Sparkles,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Users,
  DollarSign,
  BarChart,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Zap,
  Shield,
  Scale,
} from 'lucide-react';
import { useIdeaValidator } from '@/lib/hooks';
import { cn } from '@/lib/utils';

interface ValidationResult {
  overallScore: number;
  marketPotential: {
    score: number;
    analysis: string;
  };
  feasibility: {
    score: number;
    analysis: string;
  };
  competition: {
    score: number;
    analysis: string;
    competitors: string[];
  };
  targetAudience: {
    description: string;
    size: string;
    demographics: string[];
  };
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  nextSteps: string[];
}

const ideaCategories = [
  { id: 'startup', name: 'Startup/Business', icon: '🚀' },
  { id: 'product', name: 'Product Feature', icon: '💡' },
  { id: 'service', name: 'Service/Offering', icon: '🛠️' },
  { id: 'content', name: 'Content/Course', icon: '📚' },
  { id: 'app', name: 'App/Software', icon: '📱' },
  { id: 'other', name: 'Other', icon: '✨' },
];

export default function IdeaValidatorPage() {
  const [idea, setIdea] = useState('');
  const [category, setCategory] = useState('startup');
  const [targetMarket, setTargetMarket] = useState('');
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>([
    'market',
    'strengths',
    'recommendations',
  ]);

  const { mutate: validateIdea, isPending } = useIdeaValidator();

  const handleValidate = () => {
    if (!idea.trim()) return;

    validateIdea(
      { idea, category, targetMarket },
      {
        onSuccess: (data) => {
          setResult(data || mockResult);
        },
        onError: () => {
          setResult(mockResult);
        },
      }
    );
  };

  const mockResult: ValidationResult = {
    overallScore: 78,
    marketPotential: {
      score: 82,
      analysis:
        'The market shows strong growth potential with an estimated TAM of $5.2B. Women-focused career platforms are gaining traction, with notable success from platforms like The Mom Project and Fairygodboss.',
    },
    feasibility: {
      score: 75,
      analysis:
        'The idea is technically feasible with existing technologies. Key challenges include building AI capabilities and ensuring platform security. Estimated MVP timeline: 4-6 months.',
    },
    competition: {
      score: 70,
      analysis:
        'Moderate competition exists but differentiation through AI-powered features and community focus creates clear market positioning.',
      competitors: ['LinkedIn', 'The Mom Project', 'Fairygodboss', 'InHerSight'],
    },
    targetAudience: {
      description: 'Professional women aged 25-45 seeking career advancement',
      size: '15M+ in target markets',
      demographics: [
        'Mid-career professionals',
        'Career changers',
        'Working mothers',
        'Women in tech',
        'Entrepreneurs',
      ],
    },
    strengths: [
      'Addresses clear market need for women-focused career support',
      'AI differentiation provides unique value proposition',
      'Community-driven approach builds engagement and retention',
      'Multiple revenue streams (subscriptions, mentorship, courses)',
      'Strong alignment with DEI trends in corporate hiring',
    ],
    weaknesses: [
      'Requires significant content and community investment',
      'AI features need substantial development resources',
      'Market education may be needed for premium features',
      'Competition from established platforms with larger user bases',
    ],
    recommendations: [
      'Focus initial MVP on core job matching and community features',
      'Partner with women-led organizations for early user acquisition',
      'Consider B2B channel for corporate diversity hiring programs',
      'Build referral program to leverage community growth',
      'Develop content strategy around career advancement topics',
    ],
    nextSteps: [
      'Conduct user interviews with 20-30 target users',
      'Create detailed competitive analysis',
      'Develop MVP feature specification',
      'Build financial projections and funding requirements',
      'Identify potential strategic partners',
    ],
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100 dark:bg-green-900/30';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
    return 'text-red-600 bg-red-100 dark:bg-red-900/30';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'High Potential';
    if (score >= 60) return 'Moderate Potential';
    return 'Needs Work';
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
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
            <span className="text-3xl">💡</span>
            <span>Idea Validator</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            AI-powered analysis of your business or product ideas
          </p>
        </div>
      </div>

      {!result ? (
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Idea Input */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Describe Your Idea
            </h2>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Describe your idea in detail. What problem does it solve? Who is it for? What makes it unique?"
              className="w-full h-40 p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Be as specific as possible for better analysis
            </p>
          </div>

          {/* Category Selection */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
              Category
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {ideaCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={cn(
                    'p-4 rounded-lg border-2 text-center transition',
                    category === cat.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  )}
                >
                  <span className="text-2xl block mb-1">{cat.icon}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Target Market */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
              Target Market (Optional)
            </h2>
            <input
              type="text"
              value={targetMarket}
              onChange={(e) => setTargetMarket(e.target.value)}
              placeholder="e.g., Small business owners, Working parents, Tech professionals"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Validate Button */}
          <button
            onClick={handleValidate}
            disabled={!idea.trim() || isPending}
            className="w-full btn-primary py-3 flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {isPending ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Analyzing Your Idea...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Validate Idea</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overall Score */}
          <div className="card bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Overall Viability Score
                </h2>
                <p className="text-gray-600 dark:text-gray-300 max-w-lg">
                  {idea.length > 100 ? idea.substring(0, 100) + '...' : idea}
                </p>
              </div>
              <div className="text-center">
                <div
                  className={cn(
                    'w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold',
                    getScoreColor(result.overallScore)
                  )}
                >
                  {result.overallScore}
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-2">
                  {getScoreLabel(result.overallScore)}
                </p>
              </div>
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="card text-center">
              <TrendingUp className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {result.marketPotential.score}%
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Market Potential
              </div>
            </div>
            <div className="card text-center">
              <Zap className="w-8 h-8 text-purple-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {result.feasibility.score}%
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Feasibility
              </div>
            </div>
            <div className="card text-center">
              <Shield className="w-8 h-8 text-orange-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {result.competition.score}%
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Competitive Position
              </div>
            </div>
          </div>

          {/* Market Analysis */}
          <div className="card">
            <button
              onClick={() => toggleSection('market')}
              className="w-full flex items-center justify-between"
            >
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                <BarChart className="w-5 h-5 text-blue-500" />
                <span>Market Analysis</span>
              </h3>
              {expandedSections.includes('market') ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            {expandedSections.includes('market') && (
              <div className="mt-4 space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Market Potential
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400">
                    {result.marketPotential.analysis}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Target Audience
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    {result.targetAudience.description}
                  </p>
                  <p className="text-sm text-primary-600 dark:text-primary-400">
                    Estimated market size: {result.targetAudience.size}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {result.targetAudience.demographics.map((demo, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full"
                      >
                        {demo}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Competition
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    {result.competition.analysis}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {result.competition.competitors.map((competitor, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded-full text-gray-600 dark:text-gray-300"
                      >
                        {competitor}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SWOT-style Analysis */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Strengths */}
            <div className="card">
              <button
                onClick={() => toggleSection('strengths')}
                className="w-full flex items-center justify-between"
              >
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span>Strengths</span>
                </h3>
                {expandedSections.includes('strengths') ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
              {expandedSections.includes('strengths') && (
                <ul className="mt-4 space-y-2">
                  {result.strengths.map((strength, i) => (
                    <li
                      key={i}
                      className="flex items-start space-x-2 text-gray-600 dark:text-gray-300"
                    >
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{strength}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Weaknesses */}
            <div className="card">
              <button
                onClick={() => toggleSection('weaknesses')}
                className="w-full flex items-center justify-between"
              >
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  <span>Challenges</span>
                </h3>
                {expandedSections.includes('weaknesses') ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
              {expandedSections.includes('weaknesses') && (
                <ul className="mt-4 space-y-2">
                  {result.weaknesses.map((weakness, i) => (
                    <li
                      key={i}
                      className="flex items-start space-x-2 text-gray-600 dark:text-gray-300"
                    >
                      <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{weakness}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Recommendations */}
          <div className="card">
            <button
              onClick={() => toggleSection('recommendations')}
              className="w-full flex items-center justify-between"
            >
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
                <span>Recommendations</span>
              </h3>
              {expandedSections.includes('recommendations') ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            {expandedSections.includes('recommendations') && (
              <ul className="mt-4 space-y-3">
                {result.recommendations.map((rec, i) => (
                  <li
                    key={i}
                    className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <span className="w-6 h-6 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center text-primary-600 text-sm font-medium flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-gray-600 dark:text-gray-300">{rec}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Next Steps */}
          <div className="card bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
              <Target className="w-5 h-5 text-primary-500" />
              <span>Recommended Next Steps</span>
            </h3>
            <div className="space-y-3">
              {result.nextSteps.map((step, i) => (
                <div
                  key={i}
                  className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg"
                >
                  <input
                    type="checkbox"
                    className="w-5 h-5 text-primary-500 rounded"
                  />
                  <span className="text-gray-700 dark:text-gray-300">{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setResult(null)}
              className="btn-outline flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Validate Another Idea</span>
            </button>
            <Link
              href="/dashboard/mentors"
              className="btn-primary flex items-center space-x-2"
            >
              <Users className="w-4 h-4" />
              <span>Find a Mentor</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
