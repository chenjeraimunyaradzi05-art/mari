'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight, CheckCircle, Bell, Mail, Briefcase, GraduationCap, Users, Star } from 'lucide-react';

export default function WaitlistPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [interest, setInterest] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate submission
    setSubmitted(true);
  };

  const benefits = [
    { icon: Star, title: 'Early Access', description: 'Be first to try new AI features and tools' },
    { icon: Bell, title: 'Priority Onboarding', description: 'Skip the queue with dedicated support' },
    { icon: Briefcase, title: 'Exclusive Jobs', description: 'Access premium job listings before anyone else' },
    { icon: Users, title: 'Founding Community', description: 'Join our exclusive early adopter community' },
  ];

  const stats = [
    { value: '25,000+', label: 'On Waitlist' },
    { value: '500+', label: 'Companies Interested' },
    { value: '95%', label: 'Satisfaction Rate' },
  ];

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">You&apos;re on the list!</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Thanks for joining! We&apos;ll notify you at <span className="font-medium text-gray-900 dark:text-white">{email}</span> when it&apos;s your turn.
          </p>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">Your position:</p>
            <p className="text-3xl font-bold text-primary-600">#25,847</p>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Share with friends to move up the list!
          </p>
          <div className="flex gap-3 justify-center">
            <button className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">
              Share on Twitter
            </button>
            <button className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
              Share on LinkedIn
            </button>
          </div>
          <Link href="/" className="block mt-6 text-primary-600 hover:underline text-sm">
            Return to homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full mb-6">
              <Sparkles className="w-5 h-5" />
              <span className="text-sm font-medium">Limited Early Access</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Join the Future of Career Development
            </h1>
            <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
              Be among the first to experience AI-powered career matching, personalized mentorship, and tools that will transform how you find your dream job.
            </p>
            
            {/* Stats */}
            <div className="flex justify-center gap-8 mb-12">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-sm text-primary-200">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section className="container mx-auto px-4 -mt-16 relative z-20 pb-16">
        <div className="max-w-xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
              Reserve Your Spot
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="jane@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  What interests you most?
                </label>
                <select
                  value={interest}
                  onChange={(e) => setInterest(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select an option</option>
                  <option value="jobs">AI Job Matching</option>
                  <option value="mentors">Finding Mentors</option>
                  <option value="learning">Skills & Learning</option>
                  <option value="ai-tools">AI Career Tools</option>
                  <option value="networking">Professional Networking</option>
                  <option value="all">Everything!</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition flex items-center justify-center gap-2"
              >
                Join Waitlist
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
              By joining, you agree to our Terms of Service and Privacy Policy. No spam, ever.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
          Early Access Benefits
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {benefits.map((benefit) => (
            <div key={benefit.title} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 text-center">
              <div className="w-14 h-14 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                <benefit.icon className="w-7 h-7 text-primary-600" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{benefit.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{benefit.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-white dark:bg-gray-800 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            What Early Users Say
          </h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { quote: "The AI matching is incredible. Found my dream job in 2 weeks!", author: "Sarah K., Product Manager" },
              { quote: "My mentor helped me negotiate a 40% salary increase.", author: "Mike T., Software Engineer" },
              { quote: "The resume optimizer got me 3x more callbacks.", author: "Emily R., Marketing Director" },
            ].map((testimonial, i) => (
              <div key={i} className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <p className="text-gray-700 dark:text-gray-300 mb-4">&ldquo;{testimonial.quote}&rdquo;</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{testimonial.author}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
