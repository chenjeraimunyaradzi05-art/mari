import React from 'react'
import Wizard from '../../components/onboarding/Wizard'

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-10">
      <div className="container mx-auto px-4">
        <Wizard />
      </div>
    </main>
  )
}
import OnboardingFlow from '@/components/onboarding/OnboardingFlow';

export const metadata = {
  title: 'Onboarding | Athena',
  description: 'Customize your Athena experience.',
};

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
