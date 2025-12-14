'use client';

import React, { useState } from 'react';
import { 
  FileText, Upload, CheckCircle, AlertCircle, 
  Search, Filter, Download, X, ChevronRight, 
  LayoutDashboard, History, Settings, 
  Brain, User, Briefcase, GraduationCap, 
  Award, Zap, ArrowRight, Loader2, FileJson
} from 'lucide-react';

// --- Types ---
type ViewState = 'upload' | 'analysis' | 'history' | 'settings';

interface ParsedResume {
  id: string;
  fileName: string;
  candidateName: string;
  email: string;
  score: number;
  skills: string[];
  experience: number; // years
  education: string;
  status: 'completed' | 'processing' | 'failed';
  date: string;
}

// --- Mock Data ---
const RECENT_UPLOADS: ParsedResume[] = [
  {
    id: '1',
    fileName: 'alex_morgan_resume.pdf',
    candidateName: 'Alex Morgan',
    email: 'alex.m@example.com',
    score: 92,
    skills: ['React', 'Node.js', 'TypeScript', 'AWS'],
    experience: 5,
    education: 'BS Computer Science',
    status: 'completed',
    date: '2 mins ago'
  },
  {
    id: '2',
    fileName: 'sarah_chen_cv.docx',
    candidateName: 'Sarah Chen',
    email: 'sarah.c@example.com',
    score: 88,
    skills: ['Python', 'Data Analysis', 'SQL', 'Tableau'],
    experience: 3,
    education: 'MS Data Science',
    status: 'completed',
    date: '1 hour ago'
  },
  {
    id: '3',
    fileName: 'jordan_smith_resume.pdf',
    candidateName: 'Jordan Smith',
    email: 'j.smith@example.com',
    score: 75,
    skills: ['Java', 'Spring Boot', 'MySQL'],
    experience: 2,
    education: 'BS Software Engineering',
    status: 'processing',
    date: 'Just now'
  }
];

// --- Components ---

const UploadArea = ({ onUpload }: { onUpload: () => void }) => (
  <div className="bg-white rounded-2xl border-2 border-dashed border-indigo-200 p-12 text-center hover:border-indigo-400 transition-colors cursor-pointer group">
    <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
      <Upload className="w-10 h-10 text-indigo-600" />
    </div>
    <h3 className="text-xl font-bold text-slate-900 mb-2">Drop your resume here</h3>
    <p className="text-slate-500 mb-8 max-w-md mx-auto">
      Support for PDF, DOCX, and TXT files. Our AI engine will automatically extract skills, experience, and education details.
    </p>
    <button 
      onClick={onUpload}
      className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
    >
      Select File
    </button>
  </div>
);

const AnalysisResult = () => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    {/* Score Header */}
    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
      <div className="flex items-center gap-6">
        <div className="relative w-24 h-24 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
            <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251.2} strokeDashoffset={251.2 * (1 - 0.92)} className="text-indigo-600" />
          </svg>
          <span className="absolute text-2xl font-bold text-slate-900">92</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Excellent Match</h2>
          <p className="text-slate-500">Alex Morgan • Senior Frontend Engineer Role</p>
        </div>
      </div>
      <div className="flex gap-3">
        <button className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold hover:bg-slate-200 transition-colors flex items-center gap-2">
          <FileJson className="w-4 h-4" /> Export JSON
        </button>
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2">
          <Download className="w-4 h-4" /> Download Report
        </button>
      </div>
    </div>

    <div className="grid md:grid-cols-2 gap-6">
      {/* Extracted Info */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <User className="w-5 h-5 text-indigo-600" /> Candidate Details
        </h3>
        
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-xl">
            <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Contact Info</div>
            <div className="font-medium text-slate-900">alex.m@example.com</div>
            <div className="text-slate-600">+1 (555) 123-4567</div>
            <div className="text-slate-600">San Francisco, CA</div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl">
            <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Education</div>
            <div className="font-medium text-slate-900">BS Computer Science</div>
            <div className="text-slate-600">University of California, Berkeley</div>
            <div className="text-sm text-slate-500">2015 - 2019</div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl">
            <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Experience Summary</div>
            <div className="font-medium text-slate-900">5 Years Total Experience</div>
            <div className="text-slate-600">Most recent: Senior Developer at TechCorp</div>
          </div>
        </div>
      </div>

      {/* Skills & Analysis */}
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-indigo-600" /> Skills Analysis
          </h3>
          <div className="flex flex-wrap gap-2 mb-6">
            {['React', 'TypeScript', 'Node.js', 'AWS', 'GraphQL', 'Tailwind CSS', 'Jest', 'CI/CD'].map((skill, i) => (
              <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium border border-indigo-100">
                {skill}
              </span>
            ))}
          </div>
          
          <h4 className="text-sm font-bold text-slate-900 mb-3">Missing Keywords</h4>
          <div className="flex flex-wrap gap-2">
            {['Docker', 'Kubernetes', 'Microservices'].map((skill, i) => (
              <span key={i} className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-sm font-medium border border-red-100 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {skill}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-indigo-900 p-6 rounded-2xl text-white">
          <h3 className="font-bold flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-yellow-400" /> AI Insight
          </h3>
          <p className="text-indigo-100 text-sm leading-relaxed">
            This candidate shows strong progression in frontend technologies. Their experience aligns well with the Senior Engineer role, though they lack some containerization experience mentioned in the job description.
          </p>
        </div>
      </div>
    </div>
  </div>
);

export default function ResumeParserPage() {
  const [currentView, setCurrentView] = useState<ViewState>('upload');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleUpload = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      setCurrentView('analysis');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col p-4 sticky top-0 h-screen">
        <div className="mb-8 px-4 pt-4">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xl">
            <FileText className="w-6 h-6" />
            <span>Resume AI</span>
          </div>
        </div>
        
        <nav className="space-y-1 flex-1">
          <button onClick={() => setCurrentView('upload')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'upload' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Upload className="w-5 h-5" /><span className="font-medium">Upload</span>
          </button>
          <button onClick={() => setCurrentView('analysis')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'analysis' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Brain className="w-5 h-5" /><span className="font-medium">Analysis</span>
          </button>
          <button onClick={() => setCurrentView('history')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'history' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-600 hover:bg-slate-100'}`}>
            <History className="w-5 h-5" /><span className="font-medium">History</span>
          </button>
          <button onClick={() => setCurrentView('settings')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${currentView === 'settings' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Settings className="w-5 h-5" /><span className="font-medium">Settings</span>
          </button>
        </nav>

        <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 mt-4">
          <div className="flex items-center gap-2 text-indigo-900 font-bold mb-1">
            <Zap className="w-4 h-4" /> Pro Feature
          </div>
          <p className="text-xs text-indigo-700 mb-3">Batch processing is available for enterprise plans.</p>
          <button className="w-full py-2 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-indigo-700 hover:bg-white/50">
            Upgrade Plan
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto h-screen">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Resume Parser</h1>
            <p className="text-slate-500">Extract insights from candidate documents instantly.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600">Credits: 45/50</span>
            <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 w-[90%]" />
            </div>
          </div>
        </div>

        {/* Content Views */}
        {currentView === 'upload' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {isAnalyzing ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">Analyzing Document...</h3>
                <p className="text-slate-500">Extracting skills, experience, and education details.</p>
              </div>
            ) : (
              <UploadArea onUpload={handleUpload} />
            )}

            <div>
              <h3 className="font-bold text-slate-900 mb-4">Recent Uploads</h3>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {RECENT_UPLOADS.map((resume, i) => (
                  <div key={resume.id} className={`p-4 flex items-center justify-between hover:bg-slate-50 transition-colors ${i !== RECENT_UPLOADS.length - 1 ? 'border-b border-slate-100' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{resume.fileName}</div>
                        <div className="text-xs text-slate-500">{resume.candidateName} • {resume.date}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {resume.status === 'completed' ? (
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Done
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-bold flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Processing
                        </span>
                      )}
                      <button className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentView === 'analysis' && <AnalysisResult />}
        
        {(currentView === 'history' || currentView === 'settings') && (
          <div className="flex items-center justify-center h-64 text-slate-500">
            Section under construction...
          </div>
        )}
      </div>
    </div>
  );
}