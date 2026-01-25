'use client';

import Link from 'next/link';
import { Award, BookOpen, CheckCircle, Clock, Star, TrendingUp, Users, Zap } from 'lucide-react';

const certificationCategories = [
  {
    name: 'Cloud Computing',
    icon: '☁️',
    certs: ['AWS Solutions Architect', 'Azure Administrator', 'Google Cloud Professional'],
    color: 'from-blue-500 to-cyan-500',
  },
  {
    name: 'Data & AI',
    icon: '🤖',
    certs: ['Data Science Professional', 'Machine Learning Engineer', 'AI Ethics'],
    color: 'from-purple-500 to-pink-500',
  },
  {
    name: 'Cybersecurity',
    icon: '🔒',
    certs: ['CISSP', 'CompTIA Security+', 'Ethical Hacking'],
    color: 'from-red-500 to-orange-500',
  },
  {
    name: 'Project Management',
    icon: '📊',
    certs: ['PMP', 'Agile Scrum Master', 'Product Management'],
    color: 'from-green-500 to-emerald-500',
  },
  {
    name: 'Development',
    icon: '💻',
    certs: ['Full-Stack Developer', 'React Certified', 'Node.js Expert'],
    color: 'from-yellow-500 to-amber-500',
  },
  {
    name: 'Business',
    icon: '💼',
    certs: ['Business Analysis', 'Financial Modeling', 'Digital Marketing'],
    color: 'from-indigo-500 to-violet-500',
  },
];

const featuredCertifications = [
  {
    title: 'ATHENA Professional Career Coach',
    provider: 'ATHENA Academy',
    duration: '6 weeks',
    level: 'Intermediate',
    enrolled: 12500,
    rating: 4.9,
    badge: '🏆',
  },
  {
    title: 'AI-Powered Job Search Specialist',
    provider: 'ATHENA Academy',
    duration: '4 weeks',
    level: 'Beginner',
    enrolled: 8300,
    rating: 4.8,
    badge: '🚀',
  },
  {
    title: 'Resume Optimization Expert',
    provider: 'ATHENA Academy',
    duration: '3 weeks',
    level: 'Beginner',
    enrolled: 15700,
    rating: 4.7,
    badge: '📝',
  },
];

export default function CertificationsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20"></div>
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-8 h-8" />
              <span className="text-primary-200 font-medium">ATHENA Certifications</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Earn Industry-Recognized Certifications
            </h1>
            <p className="text-xl text-primary-100 mb-8">
              Boost your career with professional certifications. Verify your skills, stand out to employers, and unlock new opportunities.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/dashboard/learn"
                className="px-6 py-3 bg-white text-primary-700 font-semibold rounded-lg hover:bg-gray-100 transition flex items-center gap-2"
              >
                <BookOpen className="w-5 h-5" />
                Start Learning
              </Link>
              <Link
                href="/skills-marketplace"
                className="px-6 py-3 bg-primary-700 text-white font-semibold rounded-lg hover:bg-primary-600 transition flex items-center gap-2"
              >
                <Zap className="w-5 h-5" />
                Browse Skills
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-4 -mt-8 relative z-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Active Learners', value: '500K+', icon: Users },
            { label: 'Certifications Earned', value: '150K+', icon: Award },
            { label: 'Course Hours', value: '10K+', icon: Clock },
            { label: 'Avg. Salary Increase', value: '+25%', icon: TrendingUp },
          ].map((stat) => (
            <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg text-center">
              <stat.icon className="w-8 h-8 mx-auto mb-2 text-primary-600" />
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Explore Certification Categories
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Choose from a wide range of professional certifications across various industries and skill levels.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {certificationCategories.map((category) => (
            <div
              key={category.name}
              className="group bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all cursor-pointer border border-gray-200 dark:border-gray-700"
            >
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${category.color} flex items-center justify-center text-3xl mb-4`}>
                {category.icon}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 group-hover:text-primary-600 transition">
                {category.name}
              </h3>
              <ul className="space-y-2">
                {category.certs.map((cert) => (
                  <li key={cert} className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    {cert}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Certifications */}
      <section className="bg-white dark:bg-gray-800 py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Featured Certifications
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Start with our most popular certifications designed to accelerate your career growth.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {featuredCertifications.map((cert) => (
              <div
                key={cert.title}
                className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 hover:border-primary-500 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <span className="text-4xl">{cert.badge}</span>
                  <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full text-sm font-medium">
                    {cert.level}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {cert.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  by {cert.provider}
                </p>
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {cert.duration}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {cert.enrolled.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500" />
                    {cert.rating}
                  </span>
                </div>
                <button className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium">
                  Enroll Now
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-3xl p-8 md:p-12 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Certified?</h2>
          <p className="text-primary-100 mb-8 max-w-2xl mx-auto">
            Join thousands of professionals who have advanced their careers through ATHENA certifications.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/dashboard/learn"
              className="px-8 py-3 bg-white text-primary-700 font-semibold rounded-lg hover:bg-gray-100 transition"
            >
              Browse All Courses
            </Link>
            <Link
              href="/pricing"
              className="px-8 py-3 bg-primary-700 text-white font-semibold rounded-lg hover:bg-primary-600 transition"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
