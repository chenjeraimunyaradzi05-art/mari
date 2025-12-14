'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function JobApplicationPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const job = {
    title: "Senior Frontend Developer",
    company: "TechFlow",
    location: "Remote",
    type: "Full-time"
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      alert("Application submitted successfully!");
      router.push('/jobs');
    }, 1500);
  };

  return (
    <div className="aura-container py-12">
      <div className="max-w-3xl mx-auto">
        <Link href="/jobs" className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-indigo-600 mb-8">
          ← Back to Job Description
        </Link>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-900 to-slate-900 p-10 text-white">
            <h1 className="text-3xl font-bold mb-2">Apply for {job.title}</h1>
            <p className="text-indigo-200 text-lg">{job.company} • {job.location} • {job.type}</p>
          </div>

          <form onSubmit={handleSubmit} className="p-10 space-y-8">
            {/* Personal Info */}
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm">1</span>
                Contact Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">First Name</label>
                  <input type="text" required className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Last Name</label>
                  <input type="text" required className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
                  <input type="email" required className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Phone Number</label>
                  <input type="tel" className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500" />
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* Resume/CV */}
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm">2</span>
                Resume / CV
              </h2>
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer">
                <div className="text-4xl mb-4">📄</div>
                <p className="font-bold text-slate-700 mb-1">Upload your resume</p>
                <p className="text-sm text-slate-500">PDF, DOCX up to 5MB</p>
                <button type="button" className="mt-4 px-6 py-2 bg-white border border-slate-200 rounded-full text-sm font-bold text-indigo-600 hover:bg-indigo-50">
                  Select File
                </button>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* Additional Questions */}
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm">3</span>
                Additional Questions
              </h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Why do you want to work at {job.company}?</label>
                  <textarea rows={4} className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"></textarea>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Portfolio URL / GitHub</label>
                  <input type="url" className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500" placeholder="https://" />
                </div>
              </div>
            </section>

            <div className="pt-6 flex justify-end gap-4">
              <button type="button" className="px-8 py-3 font-bold text-slate-600 hover:text-slate-900">Cancel</button>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="aura-btn aura-btn-primary px-10 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Sending...
                  </>
                ) : (
                  'Submit Application'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
