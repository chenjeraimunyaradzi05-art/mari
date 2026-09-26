/**
 * Superseded by /dashboard/ai/resume.
 *
 * Two pages rendered the same analysis from the same hook, reached from
 * different places — this one from the public directory, the other from the AI
 * hub, the dashboard quick actions and onboarding — and they had drifted: one
 * drew a percentage and said so when no score came back, this one drew a
 * letter grade and showed nothing at all when the score was null. A member
 * could get two different readings of one résumé depending on which link she
 * followed. There is one page now, and old links land on it.
 */
import { redirect } from 'next/navigation';

export default function ResumeOptimizerPage() {
  redirect('/dashboard/ai/resume');
}