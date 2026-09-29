/**
 * The wellness API, as the phone uses it: the reference (the K10 questions
 * and the crisis lines), the day's summary, a check-in, and the K10 score.
 *
 * Paths and bodies are server/src/routes/wellness.routes.ts, and
 * server/scripts/check-api-contract.js walks this file. Every call that
 * depends on "today" sends the phone's own day, so a check-in at ten to
 * midnight in Brisbane is filed on the day she meant rather than the day it
 * already is in UTC.
 */
import { api } from './api';
import { localDay } from '../utils/format';

export interface CrisisLine {
  key: string;
  name: string;
  phone: string;
  url: string;
  when: string;
  who: string;
}

export interface WellnessReference {
  asAt: string;
  crisisLines: CrisisLine[];
  k10: { questions: Array<{ id: number; text: string }>; options: Array<{ value: number; label: string }> };
}

export type EntryKind = 'CHECKIN' | 'SLEEP' | 'HYDRATION' | 'PERIOD' | 'ACTIVITY' | 'NUTRITION' | 'SYMPTOM' | 'MEDICATION_DOSE';

export interface HealthEntry {
  id: string;
  kind: EntryKind;
  day: string;
  at: string;
  refId: string | null;
  payload: Record<string, unknown> | null;
}

export interface CheckInPayload {
  mood: number;
  stress: number;
  anxiety: number;
  energy: number;
  note?: string;
}

export interface Streak {
  current: number;
  longest: number;
  doneToday: boolean;
  lastDone: string | null;
  totalDone: number;
}

export interface Insight {
  key: string;
  kind: 'pattern' | 'trend' | 'risk' | 'recommendation';
  title: string;
  body: string;
  crisis?: boolean;
}

/** GET /wellness/today, the parts the phone reads. */
export interface WellnessToday {
  today: string;
  settings: { trackers: Record<string, boolean> };
  todays: Partial<Record<'CHECKIN' | 'SLEEP' | 'HYDRATION' | 'PERIOD', HealthEntry | null>>;
  checkinStreak: Streak;
  cycle: { phase: string; dayOfCycle: number | null; nextPeriod: string | null; daysUntilNextPeriod: number | null; confidence: string; hasData: boolean };
  medications: Array<{ id: string; name?: string; dose?: string; times: Array<{ time: string; status: string | null }> }>;
  nextBooking: { id: string; scheduledAt: string; practitioner?: { name: string } | null } | null;
  headline: Insight | null;
}

export interface K10Result {
  score: number;
  band: 'low' | 'mild' | 'moderate' | 'severe';
  label: string;
  meaning: string;
  nextStep: string;
  crisisLines: CrisisLine[];
}

const today = () => ({ today: localDay() });

export const wellnessApi = {
  reference: () => api.get('/wellness/reference'),
  today: () => api.get('/wellness/today', { params: today() }),
  // One check-in, one night's sleep and one water count a day: saving again
  // replaces the day's row. `add` makes a water entry add to the count
  // instead of replacing it.
  addEntry: (data: { kind: EntryKind; payload: Record<string, unknown>; add?: boolean }) =>
    api.post('/wellness/entries', data, { params: today() }),
  // Scored on the server and stored nowhere.
  k10: (answers: number[]) => api.post('/wellness/k10', { answers }),
};

/** Whether a tracker is on. Every tracker is on until she switches it off, so a missing key is on. */
export function trackerOn(settings: { trackers?: Record<string, boolean> } | null | undefined, key: string): boolean {
  return settings?.trackers?.[key] !== false;
}

/** The words for each step of the check-in scales, the same words the web shows. */
export const SCALE_WORDS: Record<'mood' | 'stress' | 'anxiety' | 'energy' | 'quality', string[]> = {
  mood: ['Very low', 'Low', 'Okay', 'Good', 'Great'],
  stress: ['None', 'A little', 'Some', 'A lot', 'Overwhelming'],
  anxiety: ['Calm', 'A little', 'Some', 'A lot', 'Panicky'],
  energy: ['Drained', 'Low', 'Okay', 'Good', 'Full'],
  quality: ['Awful', 'Poor', 'Okay', 'Good', 'Great'],
};

/** The disclaimer the web carries on every wellness page. */
export const HEALTH_DISCLAIMER =
  'General information from your own records and published Australian sources. It is not medical advice and not a diagnosis; a GP, psychologist or other registered practitioner can give that.';
