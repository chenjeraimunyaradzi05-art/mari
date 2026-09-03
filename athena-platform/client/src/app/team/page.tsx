'use client';

import Link from 'next/link';
import { Briefcase, Award, ArrowRight, Globe, Heart, Zap } from 'lucide-react';

export default function TeamPage() {
  const values = [
    { icon: Heart, title: 'People First', description: 'We believe in the potential of every individual to achieve their career dreams.' },
    { icon: Zap, title: 'Innovation', description: 'We push boundaries with AI and technology to create better career outcomes.' },
    { icon: Globe, title: 'Inclusion', description: 'We build for everyone, ensuring equal access to opportunities worldwide.' },
    { icon: Award, title: 'Excellence', description: 'We hold ourselves to the highest standards in everything we do.' },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-white">
      {/* Hero */}
      <section className="relative bg-[linear-gradient(135deg,#f43f5e_0%,#a855f7_55%,#f59e0b_100%)] text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">The Team Behind ATHENA</h1>
            <p className="text-xl text-white/90 mb-8">
              ATHENA is built by a small founding team, in the open, with a single mission: widen access to economic opportunity for women.
            </p>
            <Link
              href="/careers"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-rose-600 font-semibold rounded-lg hover:bg-slate-100 transition"
            >
              <Briefcase className="w-5 h-5" />
              Careers at ATHENA
            </Link>
          </div>
        </div>
      </section>

      {/* Who builds ATHENA */}
      <section className="container mx-auto px-4 pb-16 -mt-8 relative z-20">
        <div className="mx-auto max-w-3xl rounded-xl bg-white p-8 shadow-lg dark:bg-slate-800">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Who builds ATHENA</h2>
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            ATHENA is a founder-led product in staged rollout. Everything you see, from the feed
            and the job matching to the safety tooling, is designed and shipped by a small team
            working directly with the women who use it.
          </p>
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            We are not going to fill this page with executive headshots we do not have. As the
            team grows, the people building ATHENA will be introduced here by name.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="bg-white dark:bg-slate-800 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 text-center">Our Values</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {values.map((value) => (
              <div key={value.title} className="text-center">
                <div className="w-16 h-16 bg-rose-50 dark:bg-rose-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <value.icon className="w-8 h-8 text-rose-600 dark:text-rose-400" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{value.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-[linear-gradient(135deg,#f43f5e_0%,#a855f7_55%,#f59e0b_100%)] rounded-3xl p-8 md:p-12 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Want to Build This With Us?</h2>
          <p className="text-white/90 mb-8 max-w-2xl mx-auto">
            We do not have open roles posted right now. When we do, they go on the careers page, and we read every message that comes in before then.
          </p>
          <Link
            href="/careers"
            className="inline-flex items-center gap-2 px-8 py-3 bg-white text-rose-600 font-semibold rounded-lg hover:bg-slate-100 transition"
          >
            See the Careers Page <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
