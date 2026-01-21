'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Upload,
  FileText,
  Sparkles,
  Check,
  AlertCircle,
  Download,
  Copy,
  ChevronDown,
  ChevronUp,
  Target,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { useResumeOptimizer } from '@/lib/hooks';
import PaywallGate from '@/components/subscription/PaywallGate';

export default function ResumePage() {
  const [resume, setResume] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [result, setResult] = useState<any>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>(['summary', 'keywords', 'improvements']);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutate: optimize, isPending: isOptimizing } = useResumeOptimizer();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setResume(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleOptimize = () => {
    if (!resume || !jobDescription) return;
    
    optimize(
      { resume, jobDescription },
      {
        onSuccess: (data) => {
          setResult(data);
        },
        onError: (error) => {
          console.error('Optimization failed:', error);
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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
            <FileText className="w-7 h-7 text-purple-600" />
            <span>AI Resume Optimizer</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Optimize your resume for any job with AI-powered suggestions
          </p>
        </div>
      </div>

      <PaywallGate feature="ai_resume_optimizer" featureName="AI Resume Optimizer">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Resume Upload */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                <Upload className="w-5 h-5 text-purple-600" />
                <span>Your Resume</span>
              </h2>
              
              <div className="space-y-4">
                <div
                  className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-purple-500 transition"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    TXT, PDF, or DOCX (max 5MB)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.pdf,.docx"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">or paste</span>
                  </div>
                </div>

                <textarea
                  value={resume}
                  onChange={(e) => setResume(e.target.value)}
                  placeholder="Paste your resume content here..."
                  rows={8}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Job Description */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                <Target className="w-5 h-5 text-blue-600" />
                <span>Target Job Description</span>
              </h2>
              
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description you're applying for..."
                rows={8}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Optimize Button */}
            <button
              onClick={handleOptimize}
              disabled={!resume || !jobDescription || isOptimizing}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition"
            >
              {isOptimizing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Optimize Resume</span>
                </>
              )}
            </button>
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {!result ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 text-center">
                <Sparkles className="w-16 h-16 text-purple-600/20 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Ready to Optimize
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Upload your resume and paste a job description to get AI-powered optimization suggestions.
                </p>
              </div>
            ) : (
              <>
                {/* Match Score */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Match Score
                    </h3>
                    <div className={`text-3xl font-bold ${
                      (result.matchScore || 75) >= 80 ? 'text-green-600' :
                      (result.matchScore || 75) >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {result.matchScore || 75}%
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${
                        (result.matchScore || 75) >= 80 ? 'bg-green-600' :
                        (result.matchScore || 75) >= 60 ? 'bg-yellow-600' : 'bg-red-600'
                      }`}
                      style={{ width: `${result.matchScore || 75}%` }}
                    />
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <button
                    onClick={() => toggleSection('summary')}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                      <Zap className="w-5 h-5 text-yellow-600" />
                      <span>Summary</span>
                    </h3>
                    {expandedSections.includes('summary') ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                  {expandedSections.includes('summary') && (
                    <div className="px-6 pb-4">
                      <p className="text-gray-700 dark:text-gray-300">
                        {result.summary || 'Your resume shows strong alignment with the job requirements. Focus on highlighting your technical skills and quantifying your achievements for better impact.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Keywords */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <button
                    onClick={() => toggleSection('keywords')}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                      <Target className="w-5 h-5 text-blue-600" />
                      <span>Missing Keywords</span>
                    </h3>
                    {expandedSections.includes('keywords') ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                  {expandedSections.includes('keywords') && (
                    <div className="px-6 pb-4">
                      <div className="flex flex-wrap gap-2">
                        {(result.missingKeywords || ['Leadership', 'Agile', 'Cross-functional', 'Data-driven']).map((keyword: string, index: number) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-sm"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Improvements */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <button
                    onClick={() => toggleSection('improvements')}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                      <Check className="w-5 h-5 text-green-600" />
                      <span>Suggested Improvements</span>
                    </h3>
                    {expandedSections.includes('improvements') ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                  {expandedSections.includes('improvements') && (
                    <div className="px-6 pb-4 space-y-3">
                      {(result.improvements || [
                        'Add quantifiable metrics to your achievements (e.g., "increased sales by 25%")',
                        'Include relevant certifications mentioned in the job description',
                        'Reorder experience section to highlight most relevant roles first',
                        'Add a professional summary tailored to this specific role'
                      ]).map((improvement: string, index: number) => (
                        <div key={index} className="flex items-start space-x-3">
                          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-700 dark:text-gray-300">{improvement}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-4">
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(result, null, 2))}
                    className="flex-1 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center justify-center space-x-2 transition"
                  >
                    <Copy className="w-5 h-5" />
                    <span>Copy Results</span>
                  </button>
                  <button className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 flex items-center justify-center space-x-2 transition">
                    <Download className="w-5 h-5" />
                    <span>Download Report</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </PaywallGate>
    </div>
  );
}
