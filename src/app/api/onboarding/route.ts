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

// Simple in-memory list of onboarding submissions for testing/demo purposes
const submissions: Array<{ id: number; payload: any; created_at: string }> = [];

function validatePayload(body: any) {
  const errors: Record<string, string> = {};
  if (!body || typeof body !== 'object') {
    errors.body = 'Invalid payload';
    return errors;
  }
  if (!body.name || String(body.name).trim().length < 2) errors.name = 'Name is required (min 2 chars)';
  const allowed = ['member', 'creator', 'business', 'student', 'jobseeker', 'parent'];
  if (!body.role || !allowed.includes(body.role)) errors.role = `Role must be one of: ${allowed.join(', ')}`;
  if (!body.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) errors.email = 'Valid email is required';
  return errors;
}

export async function GET() {
  return NextResponse.json(onboardingData);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const errors = validatePayload(body);
  if (Object.keys(errors).length) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  // Persist submission in-memory (demo)
  const id = submissions.length + 1;
  const record = { id, payload: body, created_at: new Date().toISOString() };
  submissions.push(record);

  // Optionally update onboardingData snapshot for preview endpoints
  onboardingData = { ...onboardingData, user: { ...onboardingData.user, ...body } };

  return NextResponse.json({ ok: true, id, onboarding: record }, { status: 201 });
}
