'use client';

/**
 * The waitlist. A signup is a Lead the marketing hub can see, and the person
 * is told their real place in the queue rather than a made-up one.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, CheckCircle, Bell, Briefcase, Users, Star } from 'lucide-react';
import LeadForm from '@/components/marketing/LeadForm';

const INTERESTS = ['AI job matching', 'Finding mentors', 'Skills and learning', 'AI career tools', 'Professional networking', 'Starting a business', 'Everything'];

export default function WaitlistPage() {
  const [done, setDone] = useState<{ position: number | null; email: string } | null>(null);

  const benefits = [
    { icon: Star, title: 'Early Access', description: 'Be first to try new AI features and tools' },
    { icon: Bell, title: 'Priority Onboarding', description: 'Skip the queue with dedicated support' },
    { icon: Briefcase, title: 'Exclusive Jobs', description: 'Access premium job listings before anyone else' },
    { icon: Users, title: 'Founding Community', description: 'Join our exclusive early adopter community' },
  ];

  if (done) {
    const shareUrl = typeof window !== 'undefined' ? window.location.origin + '/waitlist' : 'https://athena.com/waitlist';
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">You&apos;re on the list!</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            We&apos;ll email <span className="font-medium text-slate-900 dark:text-white">{done.email}</span> when it&apos;s your turn.
          </p>
          {done.position != null && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 mb-6">
              <p className="text-sm text-slate-600 dark:text-slate-400">Your place in the queue:</p>
              <p className="text-3xl font-bold text-primary-600">#{done.position.toLocaleString('en-AU')}</p>
            </div>
          )}
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Know someone who should be here too?</p>
          <div className="flex gap-3 justify-center">
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('I just joined the ATHENA waitlist, the life operating system for women.')}&url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
            >
              Share on X
            </a>
            <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
              Share on LinkedIn
            </a>
          </div>
          <Link href="/" className="block mt-6 text-primary-600 hover:underline text-sm">
            Return to homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <section className="relative bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full mb-6">
              <Sparkles className="w-5 h-5" />
              <span className="text-sm font-medium">Limited Early Access</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Join the Future of Career Development</h1>
            <p className="text-xl text-primary-100 mb-4 max-w-2xl mx-auto">
              Be among the first to experience AI-powered career matching, personalised mentorship, and tools that will transform how you find your dream job.
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 -mt-10 relative z-20 pb-16">
        <div className="max-w-xl mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-700">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 text-center">Reserve Your Spot</h2>
            <LeadForm source="WAITLIST" variant="waitlist" interestOptions={INTERESTS} submitLabel="Join Waitlist" onDone={setDone} />
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-4">
              By joining, you agree to our{' '}
              <Link href="/terms" className="underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="underline">
                Privacy Policy
              </Link>
              . No spam, ever.
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 text-center">Early Access Benefits</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {benefits.map((benefit) => (
            <div key={benefit.title} className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 text-center">
              <div className="w-14 h-14 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                <benefit.icon className="w-7 h-7 text-primary-600" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{benefit.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">{benefit.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
