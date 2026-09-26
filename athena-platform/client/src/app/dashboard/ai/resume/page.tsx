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
import PremiumGate from '../PremiumGate';
import { downloadText } from '@/lib/download';

/** The one shape the analysis arrives in; `score` null means none was made. */
type ResumeAnalysis = {
  score: number | null;
  strengths: string | null;
  weaknesses: string | null;
  improvements: Array<{ section: string | null; suggestion: string }>;
  keywordsMatched: string[];
  keywordsMissing: string[];
  simulated: boolean;
  targetJob?: string | null;
};

export default function ResumePage() {
  const [resume, setResume] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [result, setResult] = useState<ResumeAnalysis | null>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>(['summary', 'keywords', 'improvements']);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutate: optimize, isPending: isOptimizing } = useResumeOptimizer();
  const [fileError, setFileError] = useState<string | null>(null);

  /**
   * Plain text only.
   *
   * This accepted .pdf and .docx and read every file with readAsText, so a PDF
   * or Word résumé arrived in the box as its raw bytes — compressed streams and
   * XML — and was sent to the model to be scored as though it were her CV.
   * Nothing on this page or the server can pull the text out of either format,
   * so the honest thing is to take the files it can read and ask her to paste
   * the rest.
   */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setFileError(null);
    const isText = file.type === 'text/plain' || /\.(txt|md)$/i.test(file.name);
    if (!isText) {
      setFileError(
        'That file is not plain text, so it cannot be read here. Open it, copy the text of your résumé, and paste it into the box below.'
      );
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError('That file is larger than 5MB. Paste the text of your résumé into the box below instead.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setResume(typeof event.target?.result === 'string' ? event.target.result : '');
    };
    reader.onerror = () => setFileError('That file could not be read. Paste the text into the box below instead.');
    reader.readAsText(file);
  };

  const handleOptimize = () => {
    if (!resume || !jobDescription) return;
    
    optimize(
      { resumeText: resume, jobDescription },
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
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <FileText className="w-7 h-7 text-purple-600" />
            <span>AI Resume Optimizer</span>
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Optimize your resume for any job with AI-powered suggestions
          </p>
        </div>
      </div>

      <PremiumGate featureName="AI Resume Optimizer">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Resume Upload */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center space-x-2">
                <Upload className="w-5 h-5 text-purple-600" />
                <span>Your Resume</span>
              </h2>
              
              <div className="space-y-4">
                <div
                  className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-6 text-center cursor-pointer hover:border-purple-500 transition"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Click to choose a file
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Plain text (.txt), up to 5MB. For a PDF or Word file, paste the text below.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,text/plain"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
                {fileError && (
                  <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                    {fileError}
                  </p>
                )}

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-300 dark:border-slate-600" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-slate-800 text-slate-500">or paste</span>
                  </div>
                </div>

                <textarea
                  value={resume}
                  onChange={(e) => setResume(e.target.value)}
                  placeholder="Paste your resume content here..."
                  rows={8}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Job Description */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center space-x-2">
                <Target className="w-5 h-5 text-blue-600" />
                <span>Target Job Description</span>
              </h2>
              
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description you're applying for..."
                rows={8}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
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
              <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-slate-200 dark:border-slate-700 text-center">
                <Sparkles className="w-16 h-16 text-purple-600/20 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  Ready to Optimize
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Upload your resume and paste a job description to get AI-powered optimization suggestions.
                </p>
              </div>
            ) : (
              <>
                {result.simulated && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    Your resume was not analysed: the AI service is not available right now. What follows
                    is general resume guidance, not a reading of your document.
                  </div>
                )}

                {/* Match score, only when one was actually made. */}
                {result.score !== null ? (
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        Match Score
                      </h3>
                      <div className={`text-3xl font-bold ${
                        result.score >= 80 ? 'text-green-600' :
                        result.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {result.score}%
                      </div>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-500 ${
                          result.score >= 80 ? 'bg-green-600' :
                          result.score >= 60 ? 'bg-yellow-600' : 'bg-red-600'
                        }`}
                        style={{ width: `${result.score}%` }}
                      />
                    </div>
                  </div>
                ) : !result.simulated ? (
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400">
                    No match score came back for this analysis.
                  </div>
                ) : null}

                {/* What reads well, and what does not. */}
                {(result.strengths || result.weaknesses) && (
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <button
                      onClick={() => toggleSection('summary')}
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
                    >
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
                        <Zap className="w-5 h-5 text-yellow-600" />
                        <span>Summary</span>
                      </h3>
                      {expandedSections.includes('summary') ? (
                        <ChevronUp className="w-5 h-5 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-500" />
                      )}
                    </button>
                    {expandedSections.includes('summary') && (
                      <div className="px-6 pb-4 space-y-3 text-slate-700 dark:text-slate-300">
                        {result.strengths && (
                          <p><span className="font-medium text-green-700 dark:text-green-400">Reads well:</span> {result.strengths}</p>
                        )}
                        {result.weaknesses && (
                          <p><span className="font-medium text-amber-700 dark:text-amber-400">Could be stronger:</span> {result.weaknesses}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Keywords */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <button
                    onClick={() => toggleSection('keywords')}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
                  >
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
                      <Target className="w-5 h-5 text-blue-600" />
                      <span>Missing Keywords</span>
                    </h3>
                    {expandedSections.includes('keywords') ? (
                      <ChevronUp className="w-5 h-5 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-500" />
                    )}
                  </button>
                  {expandedSections.includes('keywords') && (
                    <div className="px-6 pb-4 space-y-3">
                      {result.keywordsMissing.length === 0 && result.keywordsMatched.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          No keyword comparison came back for this analysis.
                        </p>
                      ) : (
                        <>
                          {result.keywordsMissing.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {result.keywordsMissing.map((keyword, index) => (
                                <span
                                  key={index}
                                  className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-sm"
                                >
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          )}
                          {result.keywordsMatched.length > 0 && (
                            <div>
                              <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Already covered</p>
                              <div className="flex flex-wrap gap-2">
                                {result.keywordsMatched.map((keyword, index) => (
                                  <span
                                    key={index}
                                    className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm"
                                  >
                                    {keyword}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Improvements */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <button
                    onClick={() => toggleSection('improvements')}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
                  >
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
                      <Check className="w-5 h-5 text-green-600" />
                      <span>Suggested Improvements</span>
                    </h3>
                    {expandedSections.includes('improvements') ? (
                      <ChevronUp className="w-5 h-5 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-500" />
                    )}
                  </button>
                  {expandedSections.includes('improvements') && (
                    <div className="px-6 pb-4 space-y-3">
                      {result.improvements.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          No specific improvements came back for this analysis.
                        </p>
                      ) : (
                        result.improvements.map((improvement, index) => (
                          <div key={index} className="flex items-start space-x-3">
                            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span className="text-slate-700 dark:text-slate-300">
                              {improvement.section && (
                                <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                  {improvement.section}
                                </span>
                              )}
                              {improvement.suggestion}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-4">
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(result, null, 2))}
                    className="flex-1 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center justify-center space-x-2 transition"
                  >
                    <Copy className="w-5 h-5" />
                    <span>Copy Results</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadText('resume-report.json', JSON.stringify(result, null, 2), 'application/json')}
                    className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 flex items-center justify-center space-x-2 transition"
                  >
                    <Download className="w-5 h-5" />
                    <span>Download Report</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </PremiumGate>
    </div>
  );
}
