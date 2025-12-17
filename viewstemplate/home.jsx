import React from 'react';
import AppLayout from './components/layouts/AppLayout';
import PillarHero from './components/dashboard/PillarHero';

export default function Home() {
  return (
    <AppLayout title="Welcome to Athena">
      <PillarHero
        title="Discover opportunities, grow your career"
        subtitle="Connect with mentors, find jobs, and explore learning paths"
        ctaText="Get started"
        ctaHref="/welcome"
      />
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="bg-white rounded p-4 shadow">Feature card 1</div>
        <div className="bg-white rounded p-4 shadow">Feature card 2</div>
        <div className="bg-white rounded p-4 shadow">Feature card 3</div>
      </section>
    </AppLayout>
  );
}
