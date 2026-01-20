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

export default function ResumeOptimizerPage() {
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
            <span className="text-3xl">📄</span>
            <span>Resume Optimizer</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            AI-powered resume optimization tailored to specific job postings
          </p>
        </div>
      </div>

      <PaywallGate featureName="Resume Optimizer">
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-6">
          {/* Resume Input */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                <FileText className="w-5 h-5 text-primary-500" />
                <span>Your Resume</span>
              </h2>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-outline text-sm py-1.5 flex items-center space-x-1"
              >
                <Upload className="w-4 h-4" />
                <span>Upload File</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.doc,.docx,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
            <textarea
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              placeholder="Paste your resume content here or upload a file..."
              className="w-full h-64 p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              For best results, include your full resume content
            </p>
          </div>

          {/* Job Description Input */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center space-x-2 mb-4">
              <Target className="w-5 h-5 text-purple-500" />
              <span>Target Job Description</span>
            </h2>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description you're applying for..."
              className="w-full h-48 p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          {/* Optimize Button */}
          <button
            onClick={handleOptimize}
            disabled={!resume || !jobDescription || isOptimizing}
            className="w-full btn-primary py-3 flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {isOptimizing ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Analyzing & Optimizing...</span>
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
        <div className="space-y-4">
          {!result && !isOptimizing && (
            <div className="card h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-primary-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Ready to Optimize
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                Paste your resume and the job description, then click optimize to get
                AI-powered suggestions
              </p>
            </div>
          )}

          {isOptimizing && (
            <div className="card h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-4 animate-pulse">
                <Zap className="w-8 h-8 text-primary-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Analyzing Your Resume
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                Our AI is comparing your resume against the job requirements and
                generating personalized suggestions...
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Match Score */}
              <div className="card bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Match Score
                    </p>
                    <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                      {result.matchScore}%
                    </p>
                  </div>
                  <div className="w-16 h-16 rounded-full border-4 border-primary-500 flex items-center justify-center">
                    <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                      {result.matchScore >= 80 ? 'A' : result.matchScore >= 60 ? 'B' : 'C'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="card">
                <button
                  onClick={() => toggleSection('summary')}
                  className="w-full flex items-center justify-between"
                >
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                    <Check className="w-5 h-5 text-green-500" />
                    <span>Summary</span>
                  </h3>
                  {expandedSections.includes('summary') ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                {expandedSections.includes('summary') && (
                  <p className="mt-4 text-gray-600 dark:text-gray-300">
                    {result.summary || 'Your resume shows strong alignment with the job requirements. Focus on the suggested improvements to increase your match score.'}
                  </p>
                )}
              </div>

              {/* Missing Keywords */}
              <div className="card">
                <button
                  onClick={() => toggleSection('keywords')}
                  className="w-full flex items-center justify-between"
                >
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                    <span>Missing Keywords</span>
                  </h3>
                  {expandedSections.includes('keywords') ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                {expandedSections.includes('keywords') && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                      Add these keywords to improve ATS compatibility:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(result.missingKeywords || ['project management', 'agile', 'stakeholder communication', 'data analysis']).map((keyword: string, i: number) => (
                        <span
                          key={i}
                          className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-sm"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Suggested Improvements */}
              <div className="card">
                <button
                  onClick={() => toggleSection('improvements')}
                  className="w-full flex items-center justify-between"
                >
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                    <span>Suggested Improvements</span>
                  </h3>
                  {expandedSections.includes('improvements') ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                {expandedSections.includes('improvements') && (
                  <ul className="mt-4 space-y-3">
                    {(result.improvements || [
                      'Add quantifiable achievements (e.g., "increased sales by 25%")',
                      'Include more action verbs at the start of bullet points',
                      'Add a professional summary section',
                      'List relevant certifications prominently',
                    ]).map((improvement: string, i: number) => (
                      <li
                        key={i}
                        className="flex items-start space-x-2 text-gray-600 dark:text-gray-300"
                      >
                        <span className="w-5 h-5 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-purple-600 dark:text-purple-400 text-xs flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span>{improvement}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Optimized Resume */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Optimized Resume
                  </h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => copyToClipboard(result.optimizedResume || resume)}
                      className="btn-outline text-sm py-1.5 flex items-center space-x-1"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </button>
                    <button className="btn-primary text-sm py-1.5 flex items-center space-x-1">
                      <Download className="w-4 h-4" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <pre className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-sans">
                    {result.optimizedResume || 'Optimized resume content will appear here...'}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </PaywallGate>

      {/* Tips */}
      <div className="card bg-gray-50 dark:bg-gray-800">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
          💡 Pro Tips for Resume Optimization
        </h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-300">
          <div className="flex items-start space-x-2">
            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>Use the exact keywords from the job description</span>
          </div>
          <div className="flex items-start space-x-2">
            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>Quantify achievements with numbers and percentages</span>
          </div>
          <div className="flex items-start space-x-2">
            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>Keep formatting simple for ATS compatibility</span>
          </div>
          <div className="flex items-start space-x-2">
            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>Tailor your resume for each application</span>
          </div>
        </div>
      </div>
    </div>
  );
}
