/**
 * The wellness API: trackers, cycle, insights and the doctor's report,
 * medications and notes, share links, the mental load tracker, forums,
 * circles, the practitioner directory and bookings, habits, challenges
 * and goals. The reference, the library, the K10 and a share link by
 * token are open; everything else is the member's own and needs a session.
 *
 * Every call that depends on "today" sends the member's local day, so a
 * check-in at 23:50 in Brisbane lands on the day she meant.
 */

import { api } from './api';

type Body = Record<string, unknown>;

/** Today as the browser sees it, YYYY-MM-DD. */
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const t = () => ({ today: localDay() });

export const wellnessApi = {
  reference: () => api.get('/wellness/reference'),
  library: () => api.get('/wellness/library'),
  k10: (answers: number[]) => api.post('/wellness/k10', { answers }),

  settings: () => api.get('/wellness/settings'),
  saveSettings: (data: Body) => api.put('/wellness/settings', data),
  deleteData: () => api.delete('/wellness/data'),

  today: () => api.get('/wellness/today', { params: t() }),
  entries: (params: Body) => api.get('/wellness/entries', { params: { ...t(), ...params } }),
  addEntry: (data: Body) => api.post('/wellness/entries', data, { params: t() }),
  importEntries: (entries: Body[]) => api.post('/wellness/entries/import', { entries }, { params: t() }),
  updateEntry: (id: string, payload: Body) => api.patch(`/wellness/entries/${id}`, { payload }),
  deleteEntry: (id: string) => api.delete(`/wellness/entries/${id}`),

  cycle: () => api.get('/wellness/cycle', { params: t() }),
  insights: (days?: number) => api.get('/wellness/insights', { params: { ...t(), days } }),
  report: (days?: number) => api.get('/wellness/report', { params: { ...t(), days } }),
  reportCsv: (days?: number) => api.get('/wellness/report.csv', { params: { ...t(), days }, responseType: 'text' }),

  shares: () => api.get('/wellness/shares'),
  createShare: (data: Body) => api.post('/wellness/shares', data),
  revokeShare: (id: string) => api.delete(`/wellness/shares/${id}`),
  share: (token: string) => api.get(`/wellness/share/${token}`),

  medications: () => api.get('/wellness/medications', { params: t() }),
  addMedication: (data: Body) => api.post('/wellness/medications', data, { params: t() }),
  updateMedication: (id: string, data: Body) => api.patch(`/wellness/medications/${id}`, data),
  deleteMedication: (id: string) => api.delete(`/wellness/medications/${id}`),
  logDose: (id: string, data: Body) => api.post(`/wellness/medications/${id}/doses`, data, { params: t() }),
  adherence: (days?: number) => api.get('/wellness/medications/adherence', { params: { ...t(), days } }),

  notes: (bookingId?: string) => api.get('/wellness/notes', { params: bookingId ? { bookingId } : {} }),
  addNote: (data: Body) => api.post('/wellness/notes', data),
  updateNote: (id: string, data: Body) => api.patch(`/wellness/notes/${id}`, data),
  deleteNote: (id: string) => api.delete(`/wellness/notes/${id}`),

  mentalLoad: (weeks?: number) => api.get('/wellness/mental-load', { params: { ...t(), weeks } }),
  addLoad: (data: Body) => api.post('/wellness/mental-load', data, { params: t() }),
  deleteLoad: (id: string) => api.delete(`/wellness/mental-load/${id}`),

  forums: () => api.get('/wellness/forums'),
  forum: (slug: string, page = 1) => api.get(`/wellness/forums/${slug}`, { params: { page } }),
  createPost: (slug: string, data: Body) => api.post(`/wellness/forums/${slug}/posts`, data),
  post: (id: string) => api.get(`/wellness/forum-posts/${id}`),
  reply: (id: string, data: Body) => api.post(`/wellness/forum-posts/${id}/replies`, data),
  support: (id: string) => api.post(`/wellness/forum-posts/${id}/support`),
  reportPost: (id: string, data: Body) => api.post(`/wellness/forum-posts/${id}/report`, data),
  updatePost: (id: string, data: Body) => api.patch(`/wellness/forum-posts/${id}`, data),
  deletePost: (id: string) => api.delete(`/wellness/forum-posts/${id}`),
  updateReply: (id: string, data: Body) => api.patch(`/wellness/forum-replies/${id}`, data),
  deleteReply: (id: string) => api.delete(`/wellness/forum-replies/${id}`),

  circles: (params?: Body) => api.get('/wellness/circles', { params: { ...t(), ...(params ?? {}) } }),
  createCircle: (data: Body) => api.post('/wellness/circles', data, { params: t() }),
  circle: (id: string) => api.get(`/wellness/circles/${id}`, { params: t() }),
  joinCircle: (id: string) => api.post(`/wellness/circles/${id}/join`, {}, { params: t() }),
  leaveCircle: (id: string) => api.post(`/wellness/circles/${id}/leave`),
  circleCheckIn: (id: string, data: Body) => api.post(`/wellness/circles/${id}/check-ins`, data, { params: t() }),
  continueCircle: (id: string) => api.post(`/wellness/circles/${id}/continue`),
  updateCircle: (id: string, data: Body) => api.patch(`/wellness/circles/${id}`, data, { params: t() }),

  practitioners: (params?: Body) => api.get('/wellness/practitioners', { params }),
  practitioner: (slug: string) => api.get(`/wellness/practitioners/${slug}`, { params: t() }),
  slots: (id: string, day: string) => api.get(`/wellness/practitioners/${id}/slots`, { params: { day } }),
  practitionerReviews: (id: string, page = 1) => api.get(`/wellness/practitioners/${id}/reviews`, { params: { page } }),
  book: (id: string, data: Body) => api.post(`/wellness/practitioners/${id}/bookings`, data),
  verifyPractitioner: (id: string, isVerified: boolean) => api.patch(`/wellness/practitioners/${id}/verify`, { isVerified }),

  practice: () => api.get('/wellness/practice'),
  savePractice: (data: Body) => api.put('/wellness/practice', data),
  practiceBookings: () => api.get('/wellness/practice/bookings'),
  updatePracticeBooking: (id: string, data: Body) => api.patch(`/wellness/practice/bookings/${id}`, data),

  bookings: () => api.get('/wellness/bookings'),
  cancelBooking: (id: string) => api.patch(`/wellness/bookings/${id}`, { status: 'CANCELLED' }),
  reviewBooking: (id: string, data: Body) => api.post(`/wellness/bookings/${id}/review`, data),
  followUp: (id: string, data: Body) => api.post(`/wellness/bookings/${id}/follow-up`, data),

  habits: () => api.get('/wellness/habits', { params: t() }),
  addHabit: (data: Body) => api.post('/wellness/habits', data, { params: t() }),
  updateHabit: (id: string, data: Body) => api.patch(`/wellness/habits/${id}`, data, { params: t() }),
  deleteHabit: (id: string) => api.delete(`/wellness/habits/${id}`),
  logHabit: (id: string, data: Body) => api.post(`/wellness/habits/${id}/log`, data, { params: t() }),

  challenges: () => api.get('/wellness/challenges', { params: t() }),
  createChallenge: (data: Body) => api.post('/wellness/challenges', data, { params: t() }),
  challenge: (id: string) => api.get(`/wellness/challenges/${id}`, { params: t() }),
  joinChallenge: (id: string, data?: Body) => api.post(`/wellness/challenges/${id}/join`, data ?? {}, { params: t() }),

  goals: () => api.get('/wellness/goals', { params: t() }),
  addGoal: (data: Body) => api.post('/wellness/goals', data, { params: t() }),
  updateGoal: (id: string, data: Body) => api.patch(`/wellness/goals/${id}`, data, { params: t() }),
  deleteGoal: (id: string) => api.delete(`/wellness/goals/${id}`),
  reviewGoal: (id: string, data: Body) => api.post(`/wellness/goals/${id}/review`, data, { params: t() }),
};

/** The message an API error carries, or a fallback. */
export function wellnessError(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string; error?: string } } };
  return e?.response?.data?.message || e?.response?.data?.error || fallback;
}

export type CrisisLine = { key: string; name: string; phone: string; url: string; when: string; who: string };
export type Insight = { key: string; kind: 'pattern' | 'trend' | 'risk' | 'recommendation'; title: string; body: string; strength?: string; source?: { name: string; url: string }; action?: { label: string; href: string }; crisis?: boolean };
export type Entry = { id: string; kind: string; day: string; at: string; refId: string | null; payload: Record<string, unknown> | null };
export type Author = { id: string | null; name: string; avatar: string | null; isAnonymous: boolean; isYou: boolean; isModerator: boolean };
