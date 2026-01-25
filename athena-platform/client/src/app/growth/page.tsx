'use client';

import Link from 'next/link';
import { TrendingUp, Users, Lightbulb, Target, Rocket, ArrowRight, CheckCircle, BarChart, Calendar, Award } from 'lucide-react';

export default function GrowthPage() {
  const programs = [
    {
      title: 'Career Accelerator',
      description: 'Fast-track your career growth with personalized coaching and skill development.',
      icon: Rocket,
      features: ['1:1 Executive Coaching', 'Leadership Training', 'Skill Gap Analysis', 'Career Roadmap'],
      duration: '12 weeks',
      price: '$2,999',
    },
    {
      title: 'Leadership Development',
      description: 'Build the skills to lead teams and drive organizational success.',
      icon: Users,
      features: ['Management Fundamentals', 'Strategic Thinking', 'Team Building', 'Executive Presence'],
      duration: '8 weeks',
      price: '$1,999',
    },
    {
      title: 'Entrepreneurship Track',
      description: 'Turn your business ideas into reality with mentorship and resources.',
      icon: Lightbulb,
      features: ['Business Planning', 'Funding Strategies', 'Product Development', 'Go-to-Market'],
      duration: '16 weeks',
      price: '$3,499',
    },
  ];

  const stats = [
    { value: '85%', label: 'Career Advancement Rate' },
    { value: '$25K', label: 'Avg. Salary Increase' },
    { value: '500+', label: 'Success Stories' },
    { value: '4.9★', label: 'Program Rating' },
  ];

  const successStories = [
    { name: 'Alex Chen', role: 'Senior Manager → VP', company: 'Tech Corp', increase: '+65% salary' },
    { name: 'Sarah Johnson', role: 'IC → Team Lead', company: 'FinTech Inc', increase: '+40% salary' },
    { name: 'Marcus Williams', role: 'Founded Startup', company: 'Series A Funded', increase: '$5M raised' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-8 h-8" />
              <span className="text-green-200 font-medium">ATHENA Growth Programs</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Accelerate Your Career Growth
            </h1>
            <p className="text-xl text-green-100 mb-8">
              Structured programs designed to help you reach the next level in your career, whether that&apos;s leadership, entrepreneurship, or specialized expertise.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="#programs"
                className="px-6 py-3 bg-white text-green-700 font-semibold rounded-lg hover:bg-gray-100 transition"
              >
                Explore Programs
              </Link>
              <Link
                href="/contact-sales"
                className="px-6 py-3 bg-green-700 text-white font-semibold rounded-lg hover:bg-green-800 transition"
              >
                Talk to an Advisor
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="container mx-auto px-4 -mt-8 relative z-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg text-center">
              <div className="text-3xl font-bold text-green-600">{stat.value}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Programs */}
      <section id="programs" className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
          Growth Programs
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {programs.map((program) => (
            <div key={program.title} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col">
              <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-4">
                <program.icon className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{program.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{program.description}</p>
              <ul className="space-y-2 mb-6 flex-1">
                {program.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{program.duration}</div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{program.price}</div>
                </div>
                <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
                  Enroll
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white dark:bg-gray-800 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-12 text-center">
            How It Works
          </h2>
          <div className="max-w-4xl mx-auto grid md:grid-cols-4 gap-8">
            {[
              { icon: Target, title: 'Assessment', description: 'Take our career assessment to identify growth areas' },
              { icon: Calendar, title: 'Match', description: 'Get matched with the right program and coach' },
              { icon: BarChart, title: 'Learn & Apply', description: 'Complete modules and apply skills in real projects' },
              { icon: Award, title: 'Achieve', description: 'Earn certification and advance your career' },
            ].map((step, i) => (
              <div key={step.title} className="text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4 relative">
                  <step.icon className="w-6 h-6 text-green-600" />
                  <span className="absolute -top-2 -right-2 w-6 h-6 bg-green-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{step.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Success Stories */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
          Success Stories
        </h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {successStories.map((story) => (
            <div key={story.name} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-center">{story.name}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-2">{story.role}</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 text-center mb-3">{story.company}</p>
              <div className="text-center">
                <span className="inline-block px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
                  {story.increase}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-3xl p-8 md:p-12 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Grow?</h2>
          <p className="text-green-100 mb-8 max-w-2xl mx-auto">
            Take the first step toward your career goals. Schedule a free consultation with our growth advisors.
          </p>
          <Link
            href="/contact-sales"
            className="inline-flex items-center gap-2 px-8 py-3 bg-white text-green-700 font-semibold rounded-lg hover:bg-gray-100 transition"
          >
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
