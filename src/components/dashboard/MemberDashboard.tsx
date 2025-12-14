'use client';

import React from 'react';
import Link from 'next/link';

// Mock Data based on Blade template usage
const mockData = {
  welcome: {
    is_first_login: false,
    greeting: 'Welcome back, Sarah (Member)',
    focus: {
      label: 'Athena focus',
      summary: 'Your current focus is on improving your financial wellness score.',
      stat: '85%',
      cta: {
        label: 'View Details',
        url: '/dashboard/focus'
      }
    }
  },
  impactStats: {
    milestones_completed: 12,
    pathways_active: 3,
    grants_submitted: 5,
    impact_score: 780
  },
  quickActions: [
    { label: 'Update Profile', icon: 'user-circle', url: '/profile' },
    { label: 'Financials', icon: 'currency-dollar', url: '/finance' },
    { label: 'Find Jobs', icon: 'map', url: '/jobs' },
    { label: 'Wellness', icon: 'heart', url: '/wellness' }
  ],
  radarEntries: [
    {
      id: 1,
      title: 'Senior Developer Role',
      subtitle: 'Tech Corp Inc.',
      summary: 'A great opportunity for a senior developer with React experience.',
      score: 95,
      urgency_level: 80,
      fit_reasons: ['Matches your skills', 'High salary potential'],
      action_url: '/jobs/1'
    },
    {
      id: 2,
      title: 'Financial Grant 2025',
      subtitle: 'Women in Tech Foundation',
      summary: 'Grant for women pursuing careers in technology.',
      score: 88,
      urgency_level: 40,
      fit_reasons: ['Eligible demographic', 'Deadline approaching'],
      action_url: '/grants/2'
    },
    {
      id: 3,
      title: 'Leadership Workshop',
      subtitle: 'Athena Academy',
      summary: 'Workshop to enhance your leadership skills.',
      score: 82,
      urgency_level: 60,
      fit_reasons: ['Career growth', 'Networking'],
      action_url: '/events/3'
    }
  ],
  activePathways: [
    {
      id: 1,
      goal_title: 'Become a Senior Developer',
      goal_description: 'Master React, Node.js and System Design',
      status: 'in_progress',
      progress_percentage: 65,
      next_actions: [
        { title: 'Complete Advanced React Course' },
        { title: 'Build a full-stack project' }
      ]
    }
  ],
  grantCards: [],
  highlightCards: [],
  charterHighlights: [
    { title: 'Respectful AI', copy: 'We use AI to empower, not replace.' },
    { title: 'Community First', copy: 'We build for the community, with the community.' },
    { title: 'Data Privacy', copy: 'Your data is yours. We protect it.' }
  ],
  referralLink: 'https://athena.com/invite/sarah123',
  grantsUrl: '/grants',
  wishlistUrl: '/workspace'
};

export default function MemberDashboard() {
  const { welcome, impactStats, quickActions, radarEntries, wishlistUrl, activePathways, grantCards, highlightCards, charterHighlights, referralLink, grantsUrl } = mockData;
  const focus = welcome.focus;
  const cta = focus.cta;

  return (
    <div className='min-h-screen bg-gradient-to-br from-primary-soft via-background to-secondary-soft'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {/* Header */}
        <header className='mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6'>
          <div>
            <p className='text-sm font-bold text-secondary uppercase tracking-wider mb-1'>Dream pathways</p>
            <h1 className='text-4xl font-extrabold text-primary-dark tracking-tight'>Member dashboard</h1>
            <p className='mt-2 text-text-muted font-medium'>Welcome back to your personal growth hub.</p>
          </div>
          <Link href={wishlistUrl} className='group inline-flex items-center px-6 py-3 border-2 border-secondary/20 text-sm font-bold rounded-full shadow-md text-secondary bg-surface hover:bg-secondary-soft hover:border-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary transition-all duration-200 transform hover:scale-105'>
            <span>Open Dream Pathways workspace</span>
            <svg className='ml-2 -mr-1 h-5 w-5 text-secondary group-hover:translate-x-1 transition-transform' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M14 5l7 7m0 0l-7 7m7-7H3' /></svg>
          </Link>
        </header>

        {/* Welcome Section */}
        {welcome && (
          <section className='relative bg-surface rounded-3xl shadow-xl shadow-primary/10 border border-primary-soft overflow-hidden mb-10 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/20' aria-labelledby='dashboard-welcome-heading'>
            <div className='absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-accent-teal'></div>
            <div className='p-8 flex flex-col md:flex-row gap-10'>
              <div className='flex-1'>
                <div className='flex items-center gap-3 mb-4'>
                  <span className='relative flex h-3 w-3'>
                    <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-teal opacity-75'></span>
                    <span className='relative inline-flex rounded-full h-3 w-3 bg-accent-teal'></span>
                  </span>
                  <p className='text-sm font-bold text-secondary uppercase tracking-wide'>
                    {welcome.is_first_login ? 'Welcome aboard' : 'Personalised check-in'}
                  </p>
                </div>
                <h2 className='text-3xl font-bold text-primary-dark mb-6' id='dashboard-welcome-heading'>
                  {welcome.greeting.replace(/\s*\(.*?\)/, '')}
                </h2>

                {/* User Photo Slider (Resized) */}
                <div className='relative w-full aspect-3/4 rounded-4xl overflow-hidden border-4 border-surface shadow-xl ring-1 ring-primary-soft mt-6' id='dashboard-user-slider'>
                  <div className="w-full h-full bg-primary-soft flex items-center justify-center">
                    <svg className="w-32 h-32 text-primary/40" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  </div>
                  <div className='absolute inset-0 bg-linear-to-t from-primary-dark/20 to-transparent pointer-events-none z-10'></div>
                </div>
              </div>
              
              <div className='md:w-1/3 bg-gradient-to-br from-primary-soft to-secondary-soft rounded-2xl p-6 border border-primary-soft shadow-inner'>
                <p className='text-xs font-bold text-primary uppercase tracking-wider mb-3'>Focus area spotlight</p>
                <h3 className='text-xl font-bold text-primary-dark mb-2'>{focus?.label ?? 'Athena focus'}</h3>
                {focus?.summary && (
                  <p className='text-sm text-text-strong mb-6'>{focus.summary}</p>
                )}

                <div className='flex items-center justify-between mt-auto pt-4 border-t border-primary/10'>
                  {focus?.stat && (
                    <span className='text-3xl font-extrabold text-primary'>{focus.stat}</span>
                  )}

                  {cta && (
                    <Link className='inline-flex items-center px-4 py-2 border border-transparent text-xs font-bold rounded-lg text-primary-dark bg-white/60 hover:bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors' href={cta.url}>
                      {cta.label}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Impact Stats & Quick Actions Grid */}
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12'>
          {/* Impact Stats */}
          <div className='lg:col-span-2'>
            <h3 className='text-xl font-bold text-primary-dark mb-6 flex items-center gap-2'>
              <div className='p-2 bg-secondary-soft rounded-lg'>
                <svg className='w-5 h-5 text-secondary' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' /></svg>
              </div>
              Your Impact
            </h3>
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-6'>
              {/* Milestones */}
              <div className='group perspective-container'>
                <div className='bg-surface/80 backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-primary-soft hover:shadow-xl hover:border-secondary transition-all duration-300 h-full flex flex-col items-center text-center relative overflow-hidden'>
                  <div className='absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500'></div>
                  <div className='icon-3d-wrapper w-12 h-12 mb-3 relative'>
                    <div className='icon-3d-inner w-full h-full bg-primary-soft rounded-xl flex items-center justify-center text-primary'>
                      <svg className='w-6 h-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' /></svg>
                    </div>
                    <div className='icon-3d-back bg-primary rounded-xl text-white'>
                      <svg className='w-6 h-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M5 13l4 4L19 7' /></svg>
                    </div>
                  </div>
                  <p className='text-xs font-bold text-primary uppercase tracking-wider mb-1'>Milestones</p>
                  <p className='text-3xl font-extrabold text-primary-dark group-hover:scale-110 transition-transform duration-300'>{impactStats.milestones_completed}</p>
                </div>
              </div>

              {/* Active Pathways */}
              <div className='group perspective-container'>
                <div className='bg-surface/80 backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-primary-soft hover:shadow-xl hover:border-secondary transition-all duration-300 h-full flex flex-col items-center text-center relative overflow-hidden'>
                  <div className='absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-secondary to-accent-teal transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500'></div>
                  <div className='icon-3d-wrapper w-12 h-12 mb-3 relative'>
                    <div className='icon-3d-inner w-full h-full bg-secondary-soft rounded-xl flex items-center justify-center text-secondary'>
                      <svg className='w-6 h-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' /></svg>
                    </div>
                    <div className='icon-3d-back bg-secondary rounded-xl text-white'>
                      <svg className='w-6 h-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' /></svg>
                    </div>
                  </div>
                  <p className='text-xs font-bold text-secondary uppercase tracking-wider mb-1'>Active Pathways</p>
                  <p className='text-3xl font-extrabold text-primary-dark group-hover:scale-110 transition-transform duration-300'>{impactStats.pathways_active}</p>
                </div>
              </div>

              {/* Grants Submitted */}
              <div className='group perspective-container'>
                <div className='bg-surface/80 backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-primary-soft hover:shadow-xl hover:border-secondary transition-all duration-300 h-full flex flex-col items-center text-center relative overflow-hidden'>
                  <div className='absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-gold to-warning transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500'></div>
                  <div className='icon-3d-wrapper w-12 h-12 mb-3 relative'>
                    <div className='icon-3d-inner w-full h-full bg-warning-soft rounded-xl flex items-center justify-center text-warning'>
                      <svg className='w-6 h-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' /></svg>
                    </div>
                    <div className='icon-3d-back bg-warning rounded-xl text-white'>
                      <svg className='w-6 h-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' /></svg>
                    </div>
                  </div>
                  <p className='text-xs font-bold text-warning uppercase tracking-wider mb-1'>Grants Submitted</p>
                  <p className='text-3xl font-extrabold text-primary-dark group-hover:scale-110 transition-transform duration-300'>{impactStats.grants_submitted}</p>
                </div>
              </div>

              {/* Impact Score */}
              <div className='group perspective-container'>
                <div className='bg-gradient-to-br from-accent-teal/10 to-success-soft p-6 rounded-2xl shadow-sm border border-primary-soft hover:shadow-xl hover:border-accent-teal transition-all duration-300 h-full flex flex-col items-center text-center relative overflow-hidden'>
                  <div className='absolute -top-10 -right-10 w-24 h-24 bg-white/30 rounded-full blur-xl animate-pulse'></div>
                  <div className='icon-3d-wrapper w-12 h-12 mb-3 relative animate-float'>
                    <div className='icon-3d-inner w-full h-full bg-white rounded-full flex items-center justify-center text-accent-teal shadow-md'>
                      <svg className='w-6 h-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M13 10V3L4 14h7v7l9-11h-7z' /></svg>
                    </div>
                    <div className='icon-3d-back bg-accent-teal rounded-full text-white shadow-md'>
                      <svg className='w-6 h-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M13 10V3L4 14h7v7l9-11h-7z' /></svg>
                    </div>
                  </div>
                  <p className='text-xs font-bold text-accent-teal uppercase tracking-wider mb-1'>Impact Score</p>
                  <p className='text-3xl font-extrabold text-primary-dark group-hover:scale-110 transition-transform duration-300'>{impactStats.impact_score}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className='text-xl font-bold text-primary-dark mb-6 flex items-center gap-2'>
              <div className='p-2 bg-secondary-soft rounded-lg'>
                <svg className='w-5 h-5 text-secondary' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M13 10V3L4 14h7v7l9-11h-7z' /></svg>
              </div>
              Quick Actions
            </h3>
            <div className='grid grid-cols-2 gap-4'>
              {quickActions.map((action, index) => (
                <Link key={index} href={action.url} className='group perspective-container block h-full'>
                  <div className='bg-surface p-5 rounded-2xl shadow-sm border border-primary-soft hover:border-secondary hover:shadow-lg transition-all duration-300 flex flex-col items-center text-center h-full relative overflow-hidden'>
                    <div className='absolute inset-0 bg-gradient-to-br from-primary-soft/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300'></div>

                    <div className='icon-3d-wrapper w-12 h-12 mb-3 relative z-10'>
                      <div className='icon-3d-inner w-full h-full bg-primary-soft rounded-2xl flex items-center justify-center text-primary shadow-sm group-hover:bg-surface'>
                        {action.icon === 'user-circle' && (
                          <svg className='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z' /></svg>
                        )}
                        {action.icon === 'currency-dollar' && (
                          <svg className='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' /></svg>
                        )}
                        {action.icon === 'map' && (
                          <svg className='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' /></svg>
                        )}
                        {action.icon === 'heart' && (
                          <svg className='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' /></svg>
                        )}
                      </div>
                      <div className='icon-3d-back bg-primary rounded-2xl text-white shadow-sm'>
                        <svg className='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' /></svg>
                      </div>
                    </div>
                    <span className='text-sm font-bold text-primary-dark group-hover:text-secondary transition-colors z-10'>{action.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Opportunity Radar */}
        {radarEntries && radarEntries.length > 0 && (
          <section className='mb-12'>
            <div className='flex items-center justify-between mb-8'>
              <div>
                <p className='text-sm font-bold text-secondary uppercase tracking-wide mb-1'>AI Intelligence</p>
                <h2 className='text-2xl font-bold text-primary-dark'>Opportunity Radar</h2>
                <p className='text-text-muted mt-1'>Top matches based on your profile and urgency.</p>
              </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'>
              {radarEntries.map((entry) => (
                <article key={entry.id} className='dashboard-card-hover bg-surface rounded-2xl shadow-sm border border-primary-soft overflow-hidden flex flex-col h-full transition-all duration-300'>
                  <div className='p-6 grow'>
                    <div className='flex justify-between items-start mb-4'>
                      <span className='inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-secondary-soft text-secondary border border-secondary/20'>
                        {entry.score}% Match
                      </span>
                      {entry.urgency_level > 50 && (
                        <span className='inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-warning-soft text-warning border border-warning/20 animate-pulse'>
                          Urgent
                        </span>
                      )}
                    </div>
                    <h3 className='text-xl font-bold text-primary-dark mb-2 leading-tight'>{entry.title}</h3>
                    <p className='text-sm font-medium text-text-muted mb-4'>{entry.subtitle}</p>
                    <p className='text-sm text-text-strong mb-6 line-clamp-3 leading-relaxed'>{entry.summary}</p>

                    {entry.fit_reasons && (
                      <div className='bg-primary-soft/50 rounded-xl p-4 border border-primary/10'>
                        <p className='text-xs font-bold text-primary uppercase tracking-wider mb-3'>Why it fits:</p>
                        <ul className='space-y-2'>
                          {entry.fit_reasons.slice(0, 2).map((reason, idx) => (
                            <li key={idx} className='flex items-start text-xs text-text-strong font-medium'>
                              <svg className='h-4 w-4 text-success mr-2 mt-0.5 shrink-0' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M5 13l4 4L19 7' /></svg>
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className='px-6 py-4 bg-surface border-t border-primary-soft'>
                    <Link href={entry.action_url} className='w-full inline-flex justify-center items-center px-4 py-2.5 border border-transparent text-sm font-bold rounded-xl text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors shadow-md shadow-primary/30'>
                      View Opportunity
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Active Pathways */}
        {activePathways && activePathways.length > 0 && (
          <section className='mb-12'>
            <div className='flex items-center justify-between mb-8'>
              <div>
                <p className='text-sm font-bold text-pink-700 uppercase tracking-wide mb-1'>My Journey</p>
                <h2 className='text-2xl font-bold text-rose-950'>Active Pathways</h2>
                <p className='text-rose-700 mt-1'>Track your progress towards your life goals.</p>
              </div>
              <Link className='text-sm font-bold text-pink-700 hover:text-pink-800 flex items-center gap-1 transition-colors' href='/pathways'>
                View all pathways <span aria-hidden='true'>&rarr;</span>
              </Link>
            </div>

            <div className='grid grid-cols-1 gap-6'>
              {activePathways.map((item) => (
                <article key={item.id} className='bg-surface rounded-2xl shadow-sm border border-primary-soft overflow-hidden hover:shadow-md transition-shadow'>
                  <div className='p-8'>
                    <div className='flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8'>
                      <div>
                        <h3 className='text-2xl font-bold text-primary-dark mb-2'>{item.goal_title}</h3>
                        <p className='text-text-muted'>{item.goal_description}</p>
                      </div>
                      <span className='inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold bg-secondary-soft text-secondary border border-secondary/20 self-start md:self-center'>
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </span>
                    </div>

                    <div className='mb-8'>
                      <div className='flex justify-between text-sm font-bold text-text-strong mb-2'>
                        <span>Progress</span>
                        <span>{item.progress_percentage}%</span>
                      </div>
                      <div className='w-full bg-primary-soft rounded-full h-3 overflow-hidden'>
                        <div className='bg-gradient-to-r from-secondary to-primary h-3 rounded-full transition-all duration-1000 ease-out shadow-sm' style={{ width: `${item.progress_percentage}%` }}></div>
                      </div>
                    </div>

                    {item.next_actions && item.next_actions.length > 0 && (
                      <div className='bg-primary-soft/50 rounded-xl p-6 border border-primary-soft'>
                        <p className='text-xs font-bold text-primary uppercase tracking-wider mb-4'>Next Actions</p>
                        <ul className='space-y-4'>
                          {item.next_actions.slice(0, 3).map((action, idx) => (
                            <li key={idx} className='flex items-start group'>
                              <div className='shrink-0 h-6 w-6 rounded-full border-2 border-primary flex items-center justify-center mr-4 mt-0.5 group-hover:border-secondary transition-colors'>
                                <span className='h-3 w-3 rounded-full bg-transparent group-hover:bg-secondary transition-colors'></span>
                              </div>
                              <span className='text-sm font-medium text-text-strong group-hover:text-primary-dark transition-colors'>{action.title}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className='px-8 py-5 bg-surface border-t border-primary-soft flex justify-end'>
                    <Link href={`/pathways/${item.id}`} className='text-sm font-bold text-secondary hover:text-secondary flex items-center gap-1 transition-colors'>Continue Journey <span aria-hidden='true'>&rarr;</span></Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Two Column Layout for Grants & Waitlists */}
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12'>
          {/* Grant Tracker */}
          <section className='flex flex-col h-full'>
            <div className='flex items-center justify-between mb-6'>
              <div>
                <p className='text-sm font-bold text-secondary uppercase tracking-wide mb-1'>Grant tracker</p>
                <h2 className='text-2xl font-bold text-primary-dark'>Workspaces</h2>
              </div>
              <Link className='text-sm font-bold text-secondary hover:text-secondary flex items-center gap-1 transition-colors' href={grantsUrl}>View all <span aria-hidden='true'>&rarr;</span></Link>
            </div>

            {grantCards.length === 0 ? (
              <div className='bg-surface/60 backdrop-blur-sm rounded-3xl shadow-sm border border-primary-soft p-10 text-center grow flex flex-col items-center justify-center relative overflow-hidden group'>
                <div className='absolute inset-0 bg-gradient-to-b from-transparent to-primary-soft/50'></div>

                <div className='perspective-container mb-6 relative z-10'>
                  <div className='icon-3d-wrapper w-20 h-20 animate-float'>
                    <div className='icon-3d-inner w-full h-full bg-primary-soft rounded-2xl flex items-center justify-center text-primary shadow-md border border-primary-soft'>
                      <svg className='h-10 w-10' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' /></svg>
                    </div>
                    <div className='icon-3d-back bg-primary rounded-2xl text-white shadow-md flex items-center justify-center'>
                      <span className='text-2xl font-bold'>+</span>
                    </div>
                  </div>
                </div>

                <h3 className='text-xl font-bold text-primary-dark mb-3 relative z-10'>No grant applications yet</h3>
                <p className='text-text-muted mb-8 max-w-xs mx-auto relative z-10'>Use the Grants & Rebates finder to launch your first Athena workspace and keep documents organised.</p>
                <Link className='relative z-10 inline-flex items-center px-6 py-3 border border-transparent text-sm font-bold rounded-xl text-white bg-primary hover:bg-primary-dark shadow-lg shadow-primary/30 transition-all transform hover:-translate-y-1' href={grantsUrl}>
                  Browse grants
                </Link>
              </div>
            ) : (
              <div className='space-y-5'>
                {/* Render grant cards here */}
              </div>
            )}
          </section>

          {/* Waitlists */}
          <section className='flex flex-col h-full'>
            <div className='flex items-center justify-between mb-6'>
              <div>
                <p className='text-sm font-bold text-secondary uppercase tracking-wide mb-1'>Waitlists</p>
                <h2 className='text-2xl font-bold text-primary-dark'>Opportunities</h2>
              </div>
              <Link className='text-sm font-bold text-secondary hover:text-secondary flex items-center gap-1 transition-colors' href={wishlistUrl}>Manage <span aria-hidden='true'>&rarr;</span></Link>
            </div>

            {highlightCards.length === 0 ? (
              <div className='bg-surface/60 backdrop-blur-sm rounded-3xl shadow-sm border border-primary-soft p-10 text-center grow flex flex-col items-center justify-center relative overflow-hidden group'>
                <div className='absolute inset-0 bg-gradient-to-b from-transparent to-secondary-soft/50'></div>

                <div className='perspective-container mb-6 relative z-10'>
                  <div className='icon-3d-wrapper w-20 h-20 animate-float' style={{ animationDelay: '1s' }}>
                    <div className='icon-3d-inner w-full h-full bg-secondary-soft rounded-full flex items-center justify-center text-secondary shadow-md border border-secondary/20'>
                      <svg className='h-10 w-10' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' /></svg>
                    </div>
                    <div className='icon-3d-back bg-secondary rounded-full text-white shadow-md flex items-center justify-center'>
                      <span className='text-2xl font-bold'>★</span>
                    </div>
                  </div>
                </div>

                <h3 className='text-xl font-bold text-primary-dark mb-3 relative z-10'>Your waitlist is calm</h3>
                <p className='text-text-muted mb-8 max-w-xs mx-auto relative z-10'>Add pathways for jobs, trades, or study and we will summarise them here.</p>
                <Link className='relative z-10 inline-flex items-center px-6 py-3 border border-transparent text-sm font-bold rounded-xl text-white bg-secondary hover:bg-secondary shadow-lg shadow-secondary/30 transition-all transform hover:-translate-y-1' href={wishlistUrl}>
                  Capture a new dream
                </Link>
              </div>
            ) : (
              <div className='space-y-5'>
                {/* Render highlight cards here */}
              </div>
            )}
          </section>
        </div>

        {/* Charter Section */}
        <section className='bg-surface rounded-3xl shadow-xl border border-primary-soft overflow-hidden mb-12 relative'>
          <div className='absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-secondary-soft rounded-full blur-3xl opacity-50'></div>
          <div className='absolute bottom-0 left-0 -mb-20 -ml-20 w-96 h-96 bg-primary-soft rounded-full blur-3xl opacity-50'></div>

          <div className='relative p-10 md:p-16'>
            <div className='max-w-3xl mx-auto text-center mb-16'>
              <h2 className='text-3xl md:text-4xl font-extrabold text-primary-dark mb-6 tracking-tight'>How Athena shows up for members</h2>
              <p className='text-text-muted text-lg md:text-xl max-w-2xl mx-auto'>Grounding principles straight from the community charter.</p>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-3 gap-12'>
              {charterHighlights.map((item, index) => (
                <article key={index} className='text-center group'>
                  <div className='h-16 w-16 mx-auto bg-primary-soft rounded-2xl flex items-center justify-center mb-6 text-secondary font-bold text-xl border border-primary-soft group-hover:border-secondary group-hover:bg-secondary-soft transition-all duration-300 shadow-sm'>
                    {index + 1}
                  </div>
                  <h3 className='text-xl font-bold mb-3 text-primary-dark group-hover:text-secondary transition-colors'>{item.title}</h3>
                  <p className='text-text-muted text-sm leading-relaxed'>{item.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Viral Loops */}
        <section className='relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-soft via-surface to-secondary-soft border border-secondary/20 shadow-lg p-8 md:p-10'>
          <div className='absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-gradient-to-br from-secondary to-primary rounded-full blur-3xl opacity-10 pointer-events-none'></div>
          <div className='absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-gradient-to-tr from-secondary to-primary rounded-full blur-3xl opacity-10 pointer-events-none'></div>

          <div className='relative flex flex-col md:flex-row items-center justify-between gap-10'>
            <div className='flex-1 text-center md:text-left'>
              <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-soft border border-secondary/20 text-secondary text-xs font-bold uppercase tracking-wider mb-4'>
                <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7' /></svg>
                Referral Rewards
              </div>
              <h2 className='text-3xl font-extrabold text-primary-dark mb-3'>Pass it on.</h2>
              <p className='text-lg text-text-muted mb-8 max-w-xl'>Know someone who needs clarity? Gift them an Athena invite and unlock exclusive community badges for yourself.</p>

              <div className='flex flex-wrap justify-center md:justify-start gap-3'>
                <a href={`mailto:?subject=Join me on Athena&body=I've been using Athena to plan my future. Check it out: ${referralLink}`} className='inline-flex items-center px-5 py-2.5 rounded-xl bg-surface border border-primary-soft text-text-muted hover:bg-primary-soft hover:border-primary transition-all shadow-sm text-sm font-bold group'>
                  <svg className='w-5 h-5 mr-2 text-primary group-hover:text-primary transition-colors' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' /></svg>
                  Send via Email
                </a>
                <a href={`https://wa.me/?text=Check%20out%20Athena:%20${encodeURIComponent(referralLink)}`} target='_blank' className='inline-flex items-center px-5 py-2.5 rounded-xl bg-surface border border-primary-soft text-text-muted hover:bg-primary-soft hover:border-primary transition-all shadow-sm text-sm font-bold group'>
                  <svg className='w-5 h-5 mr-2 text-success group-hover:text-success transition-colors' fill='currentColor' viewBox='0 0 24 24'><path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z'/></svg>
                  WhatsApp
                </a>
              </div>
            </div>

            <div className='w-full md:w-auto'>
              <div className='bg-surface p-1.5 rounded-2xl border-2 border-dashed border-primary-soft shadow-sm transform rotate-1 hover:rotate-0 transition-transform duration-300'>
                <div className='bg-primary-soft rounded-xl p-6 md:p-8 border border-primary-soft text-center min-w-[280px]'>
                  <div className='w-12 h-12 bg-surface rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-2xl'>🎁</div>
                  <p className='text-xs font-bold text-primary uppercase tracking-widest mb-4'>Your Unique Invite Link</p>

                  <div className='relative group cursor-pointer' onClick={() => { navigator.clipboard.writeText(referralLink); alert('Copied!'); }}>
                    <div className='bg-surface p-3 rounded-xl border border-primary-soft shadow-inner flex items-center justify-center gap-2 hover:border-secondary transition-colors'>
                      <code className='text-sm font-mono text-secondary font-bold truncate max-w-[200px]'>{referralLink}</code>
                      <svg className='w-4 h-4 text-primary' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z' /></svg>
                    </div>
                  </div>

                  <p className='text-xs text-primary mt-4'>Valid for unlimited invites</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

