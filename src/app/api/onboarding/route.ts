// Next.js API route for onboarding GET/POST
import { NextResponse, NextRequest } from 'next/server';

// Dummy in-memory data for demonstration
let onboardingData = {
  user: {
    name: 'Demo User',
    preferred_name: 'Demo',
    pronouns: 'they/them',
    timezone: 'UTC',
    persona_flags: [],
    onboarding_step: 'profile',
  },
  persona_options: [
    { value: 'student', label: 'Student', icon: '🎓', tagline: 'Learning journey', description: 'Access student resources.' },
    { value: 'jobseeker', label: 'Job Seeker', icon: '💼', tagline: 'Career growth', description: 'Find jobs and mentors.' },
    { value: 'parent', label: 'Parent', icon: '👩‍👧', tagline: 'Family support', description: 'Balance work and family.' }
  ],
  persona_guidance: [],
  checklist: {
    items: [
      { id: 'profile', label: 'Complete your profile', description: 'Add your details.', completed: false },
      { id: 'personas', label: 'Choose personas', description: 'Pick your journeys.', completed: false },
      { id: 'finish', label: 'Finish onboarding', description: 'Unlock recommendations.', completed: false }
    ],
    completed: 0,
    total: 3,
    progress: 0
  },
  recommendations: { supports: [] }
};

export async function GET() {
  return NextResponse.json(onboardingData);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  // Update dummy data for demonstration
  onboardingData = { ...onboardingData, ...body };
  return NextResponse.json(onboardingData);
}
