'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building,
  CheckCircle,
  ArrowRight,
  Shield,
  Clock,
  Zap,
  GraduationCap,
  Users,
  Compass,
  Heart,
  Landmark,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

type Slide = {
  brand: string;
  wordmark: string;
  tagline: string;
  headline: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  badge: string;
  gradient: string;
  accent: string;
  metrics: { label: string; value: string }[];
};

const sponsorSlides: Slide[] = [
  {
    brand: 'Westpac',
    wordmark: 'westpac',
    tagline: 'Banking partner',
    headline: 'Financial confidence for women in motion.',
    description:
      'Westpac\u2019s Ruby Connection learning lane on ATHENA \u2014 salary literacy, super, and capital pathways for early-career women across Australia.',
    ctaLabel: 'Open Ruby Connection lane',
    ctaHref: '/contact-sales?intent=partnership&sponsor=westpac',
    badge: 'Sponsored',
    gradient: 'from-red-700 via-red-600 to-rose-500',
    accent: 'text-red-100',
    metrics: [
      { label: 'Reach', value: '120k AU women' },
      { label: 'Cohort', value: '8-week track' },
      { label: 'Outcome', value: 'Salary uplift +14%' },
    ],
  },
  {
    brand: 'BHP',
    wordmark: 'BHP',
    tagline: 'Resources partner',
    headline: 'Women into trades, mining & operations.',
    description:
      'BHP\u2019s FutureFit pathway on ATHENA highlights apprenticeships, traineeships, and operator roles across WA, QLD, SA, and NT.',
    ctaLabel: 'Explore FutureFit pathway',
    ctaHref: '/contact-sales?intent=partnership&sponsor=bhp',
    badge: 'Sponsored',
    gradient: 'from-orange-600 via-amber-500 to-yellow-500',
    accent: 'text-amber-50',
    metrics: [
      { label: 'Sites', value: 'WA \u00b7 QLD \u00b7 SA \u00b7 NT' },
      { label: 'Pipeline', value: '280 verified leads' },
      { label: 'Format', value: 'Apprenticeship sprint' },
    ],
  },
  {
    brand: 'Google',
    wordmark: 'Google',
    tagline: 'Digital skills partner',
    headline: 'AI-ready careers with Google Career Certificates.',
    description:
      'Google co-funds AI, data, UX, and cyber learning paths on ATHENA \u2014 free for eligible women, with placement into hiring partners.',
    ctaLabel: 'View Google certificates',
    ctaHref: '/contact-sales?intent=partnership&sponsor=google',
    badge: 'Sponsored',
    gradient: 'from-blue-600 via-emerald-500 to-amber-400',
    accent: 'text-white',
    metrics: [
      { label: 'Tracks', value: 'AI \u00b7 Data \u00b7 UX \u00b7 Cyber' },
      { label: 'Cost', value: 'Free for eligible' },
      { label: 'Placement', value: '60+ hiring partners' },
    ],
  },
];

function BrandWordmark({ brand }: { brand: Slide['wordmark'] }) {
  if (brand === 'Google') {
    const colors = ['#4285F4', '#EA4335', '#FBBC05', '#4285F4', '#34A853', '#EA4335'];
    return (
      <span className="inline-flex items-baseline rounded-lg bg-white px-3 py-1.5 font-semibold tracking-tight shadow-sm">
        {'Google'.split('').map((ch, i) => (
          <span key={i} style={{ color: colors[i] }} className="text-2xl leading-none">
            {ch}
          </span>
        ))}
      </span>
    );
  }
  if (brand === 'BHP') {
    return (
      <span className="inline-flex items-center rounded-lg bg-white/95 px-4 py-1.5 text-2xl font-black tracking-[0.2em] text-orange-600 shadow-sm">
        BHP
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-lg bg-white/95 px-4 py-1.5 font-serif text-2xl italic font-semibold text-red-700 shadow-sm">
      westpac
    </span>
  );
}

function SponsorSlider() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setActive((current) => (current + 1) % sponsorSlides.length);
    }, 6000);
    return () => clearInterval(id);
  }, [paused]);

  const go = (index: number) => setActive((index + sponsorSlides.length) % sponsorSlides.length);

  return (
    <section
      aria-label="Sponsored partners"
      className="container mx-auto px-4 py-12"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-emerald-300/70 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200">
            Sponsored
          </span>
          <span className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            Featured partners
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous sponsor"
            onClick={() => go(active - 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next sponsor"
            onClick={() => go(active + 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div
          className="flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${active * 100}%)` }}
        >
          {sponsorSlides.map((slide) => (
            <div
              key={slide.brand}
              className={`relative w-full flex-shrink-0 bg-gradient-to-br ${slide.gradient} text-white`}
              aria-hidden={sponsorSlides[active].brand !== slide.brand}
            >
              <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" aria-hidden="true" />
              <div className="relative grid gap-6 p-8 md:grid-cols-[1fr_auto] md:items-center md:p-10">
                <div>
                  <div className="flex items-center gap-3">
                    <BrandWordmark brand={slide.wordmark} />
                    <span className={`text-xs uppercase tracking-[0.22em] ${slide.accent}`}>{slide.tagline}</span>
                  </div>
                  <h3 className="mt-5 max-w-2xl text-2xl font-bold leading-tight md:text-3xl">{slide.headline}</h3>
                  <p className={`mt-3 max-w-2xl text-sm leading-6 ${slide.accent}`}>{slide.description}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {slide.metrics.map((metric) => (
                      <span
                        key={metric.label}
                        className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/15 px-3 py-1 text-[11px] font-semibold backdrop-blur"
                      >
                        <span className="uppercase tracking-[0.18em] opacity-80">{metric.label}</span>
                        <span>{metric.value}</span>
                      </span>
                    ))}
                  </div>
                  <div className="mt-6">
                    <Link
                      href={slide.ctaHref}
                      className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:bg-slate-100"
                    >
                      {slide.ctaLabel}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
                <div className="hidden md:block">
                  <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80">
                      {slide.badge}
                    </div>
                    <div className="mt-2 text-sm font-semibold">{slide.brand} × ATHENA</div>
                    <div className={`mt-1 text-xs ${slide.accent}`}>Native partnership format</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
          {sponsorSlides.map((slide, index) => (
            <button
              key={slide.brand}
              type="button"
              aria-label={`Show ${slide.brand}`}
              onClick={() => go(index)}
              className={`h-1.5 rounded-full transition-all ${
                index === active ? 'w-8 bg-white' : 'w-3 bg-white/50'
              }`}
            />
          ))}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
        Sponsored placements run alongside ATHENA editorial — always disclosed, never disruptive.
      </p>
    </section>
  );
}

export default function BusinessPage() {
  const services = [
    {
      title: 'Workforce participation programs',
      description: 'Co-deliver state and federal workforce strategies that lift women into work, training, and leadership.',
      icon: Users,
      features: [
        'Women in STEM, trades & resources cohorts',
        'Return-to-work and parental transition tracks',
        'Regional and remote talent pipelines',
        'Outcome dashboards aligned to JSA & DEWR KPIs',
      ],
      price: 'Co-funded engagements',
    },
    {
      title: 'Skills, VET & higher-ed partnerships',
      description: 'Plug ATHENA learning rails into TAFE, university, and Skills Insight pathways with verified completions.',
      icon: GraduationCap,
      features: [
        'Mapped to AQF & Australian Skills Classification',
        'Micro-credentials and recognition of prior learning',
        'Apprenticeship and traineeship promotion',
        'Integrations with USI, TCSI, and provider LMS',
      ],
      price: 'Co-branded delivery',
    },
    {
      title: 'Gender equality & reporting',
      description: 'Tools and audiences that support WGEA reporting, equality strategies, and procurement diversity targets.',
      icon: Shield,
      features: [
        'WGEA-aligned reach and engagement reporting',
        'Indigenous Procurement Policy (IPP) supplier sprints',
        'Pay equity and leadership pipeline tracking',
        'Privacy aligned to the Australian Privacy Principles',
      ],
      price: 'Annual partnership',
    },
  ];

  const jurisdictions = [
    { name: 'Federal (Australian Government)', code: 'CTH', focus: 'JSA, DEWR, DSS, DISR, Office for Women', time: 'Panel & WoAG procurement', popular: true },
    { name: 'New South Wales', code: 'NSW', focus: 'Training Services NSW · Women NSW', time: 'buy.nsw onboarded', popular: true },
    { name: 'Victoria', code: 'VIC', focus: 'Jobs Victoria · Skills Authority', time: 'Buying for Victoria', popular: true },
    { name: 'Queensland', code: 'QLD', focus: 'Jobs Queensland · DESBT', time: 'QTenders ready', popular: false },
    { name: 'Western Australia', code: 'WA', focus: 'DTWD · Women’s Interests', time: 'Tenders WA aligned', popular: false },
    { name: 'South Australia', code: 'SA', focus: 'DSD · Office for Women', time: 'SA Tenders & Contracts', popular: false },
    { name: 'Tasmania', code: 'TAS', focus: 'Skills Tasmania · Women Tas', time: 'Tasmanian Tenders', popular: false },
    { name: 'Australian Capital Territory', code: 'ACT', focus: 'CMTEDD · Office for Women', time: 'ACT Government tenders', popular: false },
    { name: 'Northern Territory', code: 'NT', focus: 'DTBI · Office of Gender Equity', time: 'NT Tenders Online', popular: false },
  ];

  const steps = [
    {
      title: 'Discovery & alignment',
      description: 'Map your portfolio outcomes to ATHENA cohorts, sectors, and regions across Australia.',
    },
    {
      title: 'Probity & compliance',
      description: 'Australian-hosted data, APP-aligned privacy, ISO-style controls, and panel/procurement readiness.',
    },
    {
      title: 'Statement of work',
      description: 'Co-design KPIs, milestones, reporting cadence, and co-funding model with your team.',
    },
    {
      title: 'Activation',
      description: 'Launch sponsored cohorts, hiring sprints, and creator drops across federal and state audiences.',
    },
    {
      title: 'Reporting & uplift',
      description: 'Quarterly impact reports aligned to WGEA, IPP, and your agency outcome framework.',
    },
  ];

  const programs = [
    {
      title: 'Women in trades & resources',
      description: 'Build mining, construction, and energy pipelines with sponsored apprenticeships and mentor circles.',
      icon: Compass,
      gradient: 'from-amber-500 to-orange-500',
    },
    {
      title: 'Digital, AI & cyber uplift',
      description: 'Co-fund AI-ready learning paths, cyber awareness, and gov-tech career transitions.',
      icon: Zap,
      gradient: 'from-indigo-500 to-blue-500',
    },
    {
      title: 'Care economy & wellbeing',
      description: 'Healthcare, aged care, disability, and education workforce growth with safety-first delivery.',
      icon: Heart,
      gradient: 'from-rose-500 to-pink-500',
    },
    {
      title: 'Regional & First Nations programs',
      description: 'Targeted support for regional, rural, remote, and Aboriginal & Torres Strait Islander women.',
      icon: Landmark,
      gradient: 'from-emerald-500 to-teal-500',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <Landmark className="w-8 h-8" />
              <span className="text-blue-200 font-medium uppercase tracking-[0.2em] text-xs">
                ATHENA · Australian Government Partnerships
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Configured for Australia’s federal, state, and territory partners.
            </h1>
            <p className="text-xl text-blue-100 mb-8">
              Workforce participation, skills uplift, gender equality, and regional development — delivered with verified women-led audiences across every Australian jurisdiction.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/contact-sales?intent=partnership&audience=government&country=AU"
                className="px-6 py-3 bg-white text-blue-700 font-semibold rounded-lg hover:bg-slate-100 transition flex items-center gap-2"
              >
                <Zap className="w-5 h-5" />
                Brief our gov team
              </Link>
              <Link
                href="/contact-sales?intent=panel&country=AU"
                className="px-6 py-3 bg-blue-900/70 text-white font-semibold rounded-lg hover:bg-blue-900 transition border border-white/20"
              >
                Procurement & panel info
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-2 text-xs text-blue-100/90">
              {['ABN holder', 'Australian-hosted data', 'APP-aligned privacy', 'WGEA-aware reporting', 'IPP-ready supplier'].map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1">
                  <CheckCircle className="w-3 h-3" /> {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="container mx-auto px-4 -mt-8 relative z-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { value: '8 + 1', label: 'States, territories & federal' },
            { value: 'AU-hosted', label: 'Member data residency' },
            { value: 'WGEA', label: 'Aligned reporting' },
            { value: 'IPP', label: 'Indigenous procurement ready' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg text-center">
              <div className="text-2xl md:text-3xl font-bold text-blue-600">{stat.value}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Sponsor slider */}
      <SponsorSlider />

      {/* Services */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
            Government partnership services
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Build co-funded, outcomes-based programs with ATHENA across the Commonwealth, states, and territories.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {services.map((service) => (
            <div key={service.title} className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-4">
                <service.icon className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">{service.title}</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">{service.description}</p>
              <ul className="space-y-2 mb-6">
                {service.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <CheckCircle className="w-4 h-4 text-blue-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <span className="text-lg font-bold text-slate-900 dark:text-white">{service.price}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Programs */}
      <section className="bg-white dark:bg-slate-800 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
              Priority program areas
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              Aligned to national priorities under Working for Women, Closing the Gap, and the Australian Skills Guarantee.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {programs.map((program) => (
              <div
                key={program.title}
                className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-5"
              >
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${program.gradient} text-white shadow-md`}>
                  <program.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">{program.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{program.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Jurisdictions */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
            Federal, state & territory coverage
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            One partner across every Australian jurisdiction. Tagged for procurement panels and aligned to portfolio outcomes.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
          {jurisdictions.map((state) => (
            <Link
              key={state.code}
              href={`/contact-sales?intent=partnership&audience=government&country=AU&jurisdiction=${state.code}`}
              className={`group block p-5 rounded-2xl border transition hover:-translate-y-0.5 hover:shadow-md ${
                state.popular
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-bold">
                    {state.code}
                  </span>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{state.name}</h3>
                </span>
                {state.popular && (
                  <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
                    Priority
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">{state.focus}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {state.time}
                </span>
                <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-300 font-semibold">
                  Engage <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Process */}
      <section className="bg-slate-100 dark:bg-slate-900/50 py-16">
        <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-12 text-center">
          From discovery to outcomes
        </h2>
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-blue-200 dark:bg-blue-800 hidden md:block"></div>
            <div className="space-y-8">
              {steps.map((step, i) => (
                <div key={step.title} className="flex gap-6 items-start">
                  <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 text-xl font-bold relative z-10">
                    {i + 1}
                  </div>
                  <div className="pt-4">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{step.title}</h3>
                    <p className="text-slate-600 dark:text-slate-400">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-3xl p-8 md:p-12 text-white">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-blue-200">
                <Building className="w-4 h-4" /> For procurement & policy teams
              </div>
              <h2 className="text-3xl font-bold mt-3 mb-3">Build the next workforce program with ATHENA.</h2>
              <p className="text-blue-100 max-w-2xl">
                Brief us on your portfolio outcomes — from JSA workforce participation to state women&rsquo;s strategies and First Nations programs. We will return a tailored statement of work, KPIs, and probity pack.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link
                href="/contact-sales?intent=partnership&audience=government&country=AU"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-700 font-semibold rounded-lg hover:bg-slate-100 transition"
              >
                Brief our gov team <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/contact-sales?intent=panel&country=AU"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/15 transition border border-white/20"
              >
                Procurement pack
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
