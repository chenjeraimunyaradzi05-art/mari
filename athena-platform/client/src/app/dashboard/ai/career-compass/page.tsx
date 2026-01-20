'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Compass, Loader2, TrendingUp, BookOpen, AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import { aiAlgorithmsApi } from '@/lib/api';

type CareerPrediction = {
  id: string;
  predictedRoles: Array<{
    role: string;
    probability: number;
    expectedSalary: string;
    timeline: string;
    skillsGap: string[];
  }>;
  prioritySkills: Array<{
    skill: string;
    salaryLift: number;
    learningTime: number;
    difficulty: number;
  }>;
  riskFactors?: {
    attritionRisk: number;
    burnoutIndicators: number;
    wageGapExposure: number;
  };
  confidenceScore: number;
  modelVersion: string;
  generatedAt: string;
  expiresAt: string;
};

export default function CareerCompassPage() {
  const [prediction, setPrediction] = useState<CareerPrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPrediction = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await aiAlgorithmsApi.getCareerPrediction();
      setPrediction(response.data?.data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to load prediction');
    } finally {
      setLoading(false);
    }
  };

  const generatePrediction = async () => {
    setGenerating(true);
    setError(null);
    try {
      const response = await aiAlgorithmsApi.generateCareerPrediction();
      setPrediction(response.data?.data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to generate prediction');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    loadPrediction();
  }, []);

  const getDifficultyLabel = (difficulty: number) => {
    if (difficulty <= 3) return 'Easy';
    if (difficulty <= 6) return 'Medium';
    return 'Hard';
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 3) return 'text-green-600 bg-green-100 dark:bg-green-900/30';
    if (difficulty <= 6) return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30';
    return 'text-red-600 bg-red-100 dark:bg-red-900/30';
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-purple-600">
          <Compass className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">CareerCompass</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
          Your Career Trajectory
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          AI-powered predictions for your optimal career moves over the next 3-5 years
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : !prediction ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-purple-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Generate Your Career Prediction
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Our AI analyzes your profile, skills, and career history to predict 
            your optimal next moves and highlight skills to prioritize.
          </p>
          <button
            onClick={generatePrediction}
            disabled={generating}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing your profile...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Prediction
              </>
            )}
          </button>
        </div>
      ) : (
        <>
          {/* Confidence & Refresh */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-500">
                Confidence: <span className="font-semibold text-purple-600">{Math.round(prediction.confidenceScore * 100)}%</span>
              </div>
              <span className="text-gray-300">•</span>
              <div className="text-sm text-gray-500">
                Generated {new Date(prediction.generatedAt).toLocaleDateString()}
              </div>
            </div>
            <button
              onClick={generatePrediction}
              disabled={generating}
              className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
            >
              <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Predicted Roles */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              Predicted Next Roles
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {prediction.predictedRoles.map((role, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{role.role}</h3>
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 text-xs font-semibold rounded">
                      {role.probability}% likely
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Expected Salary</span>
                      <span className="font-medium text-gray-900 dark:text-white">{role.expectedSalary}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Timeline</span>
                      <span className="font-medium text-gray-900 dark:text-white">{role.timeline}</span>
                    </div>
                  </div>
                  {role.skillsGap.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <p className="text-xs text-gray-500 mb-2">Skills to develop:</p>
                      <div className="flex flex-wrap gap-1">
                        {role.skillsGap.map((skill, sIdx) => (
                          <span key={sIdx} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Priority Skills */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              Priority Skills to Learn
            </h2>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Skill</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Salary Lift</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Learning Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Difficulty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {prediction.prioritySkills.map((skill, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{skill.skill}</td>
                      <td className="px-4 py-3 text-emerald-600 font-medium">+${skill.salaryLift.toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{skill.learningTime} hours</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(skill.difficulty)}`}>
                          {getDifficultyLabel(skill.difficulty)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Risk Factors */}
          {prediction.riskFactors && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                Risk Factors to Monitor
              </h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                  <p className="text-sm text-gray-500 mb-1">Attrition Risk</p>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{prediction.riskFactors.attritionRisk}%</span>
                    <span className="text-xs text-gray-500 mb-1">likelihood of leaving current role</span>
                  </div>
                  <div className="mt-2 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${prediction.riskFactors.attritionRisk}%` }}
                    />
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                  <p className="text-sm text-gray-500 mb-1">Burnout Indicators</p>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{prediction.riskFactors.burnoutIndicators}%</span>
                    <span className="text-xs text-gray-500 mb-1">based on engagement patterns</span>
                  </div>
                  <div className="mt-2 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full"
                      style={{ width: `${prediction.riskFactors.burnoutIndicators}%` }}
                    />
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                  <p className="text-sm text-gray-500 mb-1">Wage Gap Exposure</p>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{prediction.riskFactors.wageGapExposure}%</span>
                    <span className="text-xs text-gray-500 mb-1">gender pay gap in target roles</span>
                  </div>
                  <div className="mt-2 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${prediction.riskFactors.wageGapExposure}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div className="text-center">
        <Link href="/dashboard/ai" className="text-sm text-primary-600 hover:underline">
          ← Back to AI Tools
        </Link>
      </div>
    </div>
  );
}
