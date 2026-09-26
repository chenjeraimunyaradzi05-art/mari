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
import PremiumGate from '../PremiumGate';
import { cn } from '@/lib/utils';

/**
 * The shape POST /ai/idea-validator actually returns.
 *
 * Every scored field was declared here as a required number or object, which is
 * why the page could dump raw JSON at a member: the server omits a field the
 * model would not answer, and returns them all null when no key is configured
 * and nothing ran at all. TypeScript said that could not happen, so nobody
 * wrote the branch for it, and `JSON.stringify(result, null, 2)` was left
 * standing in the fallback — a member who validated her idea with the provider
 * down read `{"overallScore": null, "marketPotential": null, ...}` on the
 * screen. Marking them nullable is what forces the honest branch to exist.
 */
interface ValidationResult {
  analysis?: string | null;
  overallScore?: number | null;
  marketPotential?: {
    score?: number | null;
    analysis?: string | null;
  } | null;
  feasibility?: {
    score?: number | null;
    analysis?: string | null;
  } | null;
  competition?: {
    score?: number | null;
    analysis?: string | null;
    competitors?: string[] | null;
  } | null;
  targetAudience?: {
    description?: string | null;
    size?: string | null;
    demographics?: string[] | null;
  } | null;
  strengths?: string[] | null;
  weaknesses?: string[] | null;
  recommendations?: string[] | null;
  nextSteps?: string[] | null;
  /** True when no model was called — see getSimulatedIdeaValidation on the server. */
  simulated?: boolean;
}

/**
 * A validation complete enough to draw the scored view: the dial, the three
 * score tiles, the SWOT columns and the audience panel all read these without
 * checking, so every one of them has to be there before that view is chosen.
 * `size` is the exception — the prompt tells the model not to invent a market
 * size, so an answer that leaves it out is a good answer and the line that
 * would have printed it is simply not drawn.
 */
type ScoredValidation = {
  overallScore: number;
  marketPotential: { score: number; analysis: string };
  feasibility: { score: number };
  competition: { score: number; analysis: string; competitors: string[] };
  targetAudience: { description: string; size: string | null; demographics: string[] };
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  nextSteps: string[];
};

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Narrow a response to the scored view, or return null so the caller falls back
 * to prose. The three sub-scores are required because the tiles print them with
 * a percent sign after; a missing one used to be impossible according to the
 * types and would have rendered "%" on its own.
 */
function toScored(value: ValidationResult | null): ScoredValidation | null {
  if (!value) return null;
  const { overallScore, marketPotential, feasibility, competition, targetAudience } = value;

  if (!isNumber(overallScore)) return null;
  if (!marketPotential || !isNumber(marketPotential.score)) return null;
  if (!feasibility || !isNumber(feasibility.score)) return null;
  if (!competition || !isNumber(competition.score)) return null;
  if (!targetAudience || !targetAudience.description) return null;

  return {
    overallScore,
    marketPotential: { score: marketPotential.score, analysis: marketPotential.analysis || '' },
    feasibility: { score: feasibility.score },
    competition: {
      score: competition.score,
      analysis: competition.analysis || '',
      competitors: competition.competitors || [],
    },
    targetAudience: {
      description: targetAudience.description,
      size: targetAudience.size || null,
      demographics: targetAudience.demographics || [],
    },
    strengths: value.strengths || [],
    weaknesses: value.weaknesses || [],
    recommendations: value.recommendations || [],
    nextSteps: value.nextSteps || [],
  };
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
  const [validationError, setValidationError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>([
    'market',
    'strengths',
    'recommendations',
  ]);

  const { mutate: validateIdea, isPending } = useIdeaValidator();

  const handleValidate = () => {
    if (!idea.trim()) return;
    setValidationError(null);

    validateIdea(
      { idea, category, targetMarket },
      {
        onSuccess: (data) => {
          setResult(data || null);
        },
        onError: (error: any) => {
          setResult(null);
          setValidationError(
            error?.response?.data?.message ||
              'Idea validation is unavailable right now. Please try again later.'
          );
        },
      }
    );
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

  const scored = toScored(result);

  // Nothing ran: no provider was configured, so the server returned an empty
  // assessment with simulated:true rather than inventing one. There is no prose
  // to fall back to either, and a member is owed the reason instead of a blank
  // panel or, as before, the JSON.
  const nothingRan = Boolean(result?.simulated);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
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
            <span className="text-3xl">💡</span>
            <span>Idea Validator</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            AI-powered analysis of your business or product ideas
          </p>
        </div>
      </div>

      {/* POST /ai/idea-validator carries requirePremium. A free member used
          to reach this form from the AI hub and the platform directory, write
          out the idea she had been sitting on, and get back a toast. */}
      <PremiumGate featureName="Business Idea Validator">
      {!result ? (
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Idea Input */}
          <div className="card">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Describe Your Idea
            </h2>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Describe your idea in detail. What problem does it solve? Who is it for? What makes it unique?"
              className="w-full h-40 p-4 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 resize-none"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Be as specific as possible for better analysis
            </p>
          </div>

          {/* Category Selection */}
          <div className="card">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4">
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
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  )}
                >
                  <span className="text-2xl block mb-1">{cat.icon}</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Target Market */}
          <div className="card">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4">
              Target Market (Optional)
            </h2>
            <input
              type="text"
              value={targetMarket}
              onChange={(e) => setTargetMarket(e.target.value)}
              placeholder="e.g., Small business owners, Working parents, Tech professionals"
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {validationError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
              {validationError}
            </div>
          )}

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
      ) : !scored ? (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              {nothingRan || !result?.analysis ? 'No assessment was made' : 'Analysis'}
            </h2>
            {nothingRan ? (
              <p className="text-slate-700 dark:text-slate-300">
                ATHENA&apos;s idea validation is not connected to a language model on this
                deployment, so nothing read your idea. Your description has not been scored,
                and no assessment was produced. Nothing you wrote has been lost — try again
                later, or take it to a mentor in the meantime.
              </p>
            ) : result?.analysis ? (
              <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                {result.analysis}
              </p>
            ) : (
              <p className="text-slate-700 dark:text-slate-300">
                The validator answered, but not with anything it was willing to score — no
                viability rating, no market or feasibility read, and no summary. Rather than
                show you a partial picture as though it were the assessment, ATHENA is
                telling you it came back empty. Adding more detail about the problem your
                idea solves and who it is for usually gives it more to work with.
              </p>
            )}
          </div>
          <button
            onClick={() => setResult(null)}
            className="btn-primary flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Validate Another Idea</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overall Score */}
          <div className="card bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  Overall Viability Score
                </h2>
                <p className="text-slate-600 dark:text-slate-300 max-w-lg">
                  {idea.length > 100 ? idea.substring(0, 100) + '...' : idea}
                </p>
              </div>
              <div className="text-center">
                <div
                  className={cn(
                    'w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold',
                    getScoreColor(scored.overallScore)
                  )}
                >
                  {scored.overallScore}
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-2">
                  {getScoreLabel(scored.overallScore)}
                </p>
              </div>
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="card text-center">
              <TrendingUp className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {scored.marketPotential.score}%
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Market Potential
              </div>
            </div>
            <div className="card text-center">
              <Zap className="w-8 h-8 text-purple-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {scored.feasibility.score}%
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Feasibility
              </div>
            </div>
            <div className="card text-center">
              <Shield className="w-8 h-8 text-orange-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {scored.competition.score}%
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
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
              <h3 className="font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
                <BarChart className="w-5 h-5 text-blue-500" />
                <span>Market Analysis</span>
              </h3>
              {expandedSections.includes('market') ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </button>
            {expandedSections.includes('market') && (
              <div className="mt-4 space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Market Potential
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400">
                    {scored.marketPotential.analysis}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Target Audience
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400 mb-2">
                    {scored.targetAudience.description}
                  </p>
                  {/* Only when the model gave one. It is told not to invent a
                      market size, so the honest answer is often no answer, and
                      "Estimated market size:" followed by nothing is worse than
                      the line being absent. */}
                  {scored.targetAudience.size && (
                    <p className="text-sm text-primary-600 dark:text-primary-400">
                      Estimated market size: {scored.targetAudience.size}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {scored.targetAudience.demographics.map((demo, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full"
                      >
                        {demo}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Competition
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400 mb-2">
                    {scored.competition.analysis}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {scored.competition.competitors.map((competitor, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded-full text-slate-600 dark:text-slate-300"
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
                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span>Strengths</span>
                </h3>
                {expandedSections.includes('strengths') ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </button>
              {expandedSections.includes('strengths') && (
                <ul className="mt-4 space-y-2">
                  {scored.strengths.map((strength, i) => (
                    <li
                      key={i}
                      className="flex items-start space-x-2 text-slate-600 dark:text-slate-300"
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
                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  <span>Challenges</span>
                </h3>
                {expandedSections.includes('weaknesses') ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </button>
              {expandedSections.includes('weaknesses') && (
                <ul className="mt-4 space-y-2">
                  {scored.weaknesses.map((weakness, i) => (
                    <li
                      key={i}
                      className="flex items-start space-x-2 text-slate-600 dark:text-slate-300"
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
              <h3 className="font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
                <span>Recommendations</span>
              </h3>
              {expandedSections.includes('recommendations') ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </button>
            {expandedSections.includes('recommendations') && (
              <ul className="mt-4 space-y-3">
                {scored.recommendations.map((rec, i) => (
                  <li
                    key={i}
                    className="flex items-start space-x-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                  >
                    <span className="w-6 h-6 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center text-primary-600 text-sm font-medium flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-slate-600 dark:text-slate-300">{rec}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Next Steps */}
          <div className="card bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center space-x-2">
              <Target className="w-5 h-5 text-primary-500" />
              <span>Recommended Next Steps</span>
            </h3>
            <div className="space-y-3">
              {scored.nextSteps.map((step, i) => (
                <div
                  key={i}
                  className="flex items-center space-x-3 p-3 bg-white dark:bg-slate-800 rounded-lg"
                >
                  <input
                    type="checkbox"
                    className="w-5 h-5 text-primary-500 rounded"
                  />
                  <span className="text-slate-700 dark:text-slate-300">{step}</span>
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
      </PremiumGate>
    </div>
  );
}
