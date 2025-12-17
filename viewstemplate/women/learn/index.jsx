import React from 'react';

// Example data for dashboardStats (replace with real data or props)
const dashboardStats = [
  { value: 120, suffix: 'Women', label: 'Active Learners' },
  { value: 8, suffix: 'Cohorts', label: 'Current Cohorts' },
  { value: 97, suffix: '%', label: 'Completion Rate' },
];

export default function WomenLearnPage() {
  return (
    <div className="learning-page relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900/95 to-indigo-950 text-slate-100">
      <section className="mx-auto flex min-h-[24rem] w-full max-w-7xl flex-col gap-8 px-4 py-20 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="space-y-6 lg:w-3/5">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-500/30 px-6 py-2.5 text-sm font-semibold uppercase tracking-[0.24em] text-indigo-100">WomenRise Learning</span>
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
            Real estate pathways that honour women-led momentum
          </h1>
          <p className="max-w-3xl text-xl text-slate-200 lg:text-2xl">
            Curated cohorts, lender clinics, and wraparound financial intelligence designed for women moving through the real estate journey. Enrol once and we will surface AI-assisted check-ins, accountability prompts, and peer sessions.
          </p>
          <div className="flex flex-wrap gap-3 text-base text-indigo-100">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 font-semibold shadow-sm">
              {/* Checkmark Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Cohort-based accountability
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 font-semibold shadow-sm">
              {/* Clock Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6v6l4 2" />
              </svg>
              AI nudges & workshops
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 font-semibold shadow-sm">
              {/* Path Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 12.414A2 2 0 0113 11.172V7a1 1 0 10-2 0v4.172a2 2 0 01-.586 1.414l-4.243 4.243" />
              </svg>
              Designed for Australian markets
            </span>
          </div>
        </div>
        <div className="relative flex w-full max-w-sm flex-col gap-5 rounded-3xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-fuchsia-500 p-10 text-white shadow-2xl lg:w-2/5">
          <div className="text-sm uppercase tracking-[0.3em] text-white/70">How it works</div>
          <p className="text-xl font-semibold leading-relaxed text-white/90">
            Pick a path, commit to weekly actions, and our mortgage and partnership engines will adapt around your progress. Drop out anytime—no stigma, just pace resetting.
          </p>
          <p className="text-base text-white/80">
            Already enrolled paths appear below with progress meters. Your mentor circle receives an update every Friday.
          </p>
        </div>
      </section>

      <section id="learning-momentum-dashboard" className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="space-y-10">
          <div className="learning-metrics__grid grid grid-cols-1 md:grid-cols-3 gap-6">
            {dashboardStats.map((stat, idx) => (
              <div key={idx} className="bg-indigo-800/40 rounded-2xl p-6 flex flex-col items-center">
                <div className="text-4xl font-bold text-white">{stat.value}{stat.suffix && <span className="text-lg font-normal ml-1">{stat.suffix}</span>}</div>
                <div className="text-lg text-indigo-100 mt-2">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
