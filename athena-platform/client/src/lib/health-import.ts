/**
 * Readers for the files a phone can export: Apple Health's export.xml,
 * Google Fit's Takeout (the daily summaries CSV and the session JSON
 * files), and the CSV this app writes from the insights page. Each turns a
 * file into the entries the trackers already understand, and marks them
 * with a source so importing the same file twice leaves one copy.
 *
 * Everything here runs in the browser. The file itself never leaves the
 * device; only the summarised entries the member approves are sent.
 *
 * Apple's export is large (hundreds of megabytes is normal) and one record
 * per line, so the Apple reader takes lines one at a time and keeps only
 * daily totals. Two sources often record the same thing (a phone and a
 * watch both count steps), so a day's steps are the largest single source,
 * not the sum, and overlapping sleep intervals are merged before they are
 * added up.
 */

export type ImportKind = 'CHECKIN' | 'SLEEP' | 'ACTIVITY' | 'HYDRATION' | 'PERIOD' | 'NUTRITION' | 'SYMPTOM';
export type ImportSource = 'apple-health' | 'google-fit' | 'athena-csv';
export type ImportFormat = 'apple-health' | 'google-fit-daily' | 'google-fit-session' | 'athena-csv';

export interface ImportEntry {
  kind: ImportKind;
  day: string;
  at?: string;
  payload: Record<string, unknown>;
}

export interface ImportResult {
  source: ImportSource;
  entries: ImportEntry[];
  skipped: number;
  notes: string[];
}

export const KIND_LABELS: Record<ImportKind, string> = {
  CHECKIN: 'Check-ins',
  SLEEP: 'Nights of sleep',
  ACTIVITY: 'Movement and steps',
  HYDRATION: 'Water',
  PERIOD: 'Period days',
  NUTRITION: 'Meals',
  SYMPTOM: 'Symptoms',
};

// ------------------------------------------------------------------ helpers

/** What kind of file this is, from its name and its first few kilobytes. */
export function detectFormat(name: string, head: string): ImportFormat | null {
  const h = head.slice(0, 6000);
  if (/<HealthData\b|<Record\s+type="HK|<Workout\s/.test(h)) return 'apple-health';
  if (/"fitnessActivity"\s*:/.test(h)) return 'google-fit-session';
  const firstLine = (h.split(/\r?\n/)[0] ?? '').trim();
  if (/^kind,day,at,field,value/i.test(firstLine)) return 'athena-csv';
  if (/\bdate\b/i.test(firstLine) && /step count|move minutes|heart points|heart minutes/i.test(firstLine)) return 'google-fit-daily';
  if (/\.xml$/i.test(name) && /<\?xml/.test(h)) return 'apple-health';
  if (/\.json$/i.test(name) && /^\s*\{/.test(h)) return 'google-fit-session';
  return null;
}

export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; } else if (ch === '"') quoted = false; else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** "2024-01-01 22:00:00 +1000" as Apple writes it: the local day, and the instant. */
export function appleDate(s: string | undefined): { day: string; ms: number } | null {
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2}):?(\d{2})$/);
  if (!m) return null;
  const ms = Date.parse(`${m[1]}T${m[2]}${m[3]}:${m[4]}`);
  return Number.isFinite(ms) ? { day: m[1], ms } : null;
}

function attrs(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of line.matchAll(/([A-Za-z_:][\w:.-]*)="([^"]*)"/g)) out[m[1]] = m[2].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  return out;
}

/** Overlapping intervals merged, then added up, in hours. */
export function mergedHours(intervals: Array<[number, number]>): number {
  const sorted = intervals.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const [a, b] of sorted) {
    if (cur && a <= cur[1]) cur[1] = Math.max(cur[1], b);
    else { if (cur) total += cur[1] - cur[0]; cur = [a, b]; }
  }
  if (cur) total += cur[1] - cur[0];
  return round2(total / 3600000);
}

const maxOverSources = (m: Map<string, number> | undefined): number => (m ? Math.max(0, ...Array.from(m.values())) : 0);
const bump = (map: Map<string, Map<string, number>>, day: string, source: string, value: number) => {
  const inner = map.get(day) ?? new Map<string, number>();
  inner.set(source, (inner.get(source) ?? 0) + value);
  map.set(day, inner);
};

const FLOW_RANK: Record<string, number> = { spotting: 1, light: 2, medium: 3, heavy: 4 };

export const APPLE_WORKOUT_TYPES: Record<string, string> = {
  Walking: 'walk', Hiking: 'walk', Running: 'run', Cycling: 'cycle', Swimming: 'swim', Yoga: 'yoga', MindAndBody: 'yoga', Pilates: 'pilates',
  TraditionalStrengthTraining: 'strength', FunctionalStrengthTraining: 'strength', CoreTraining: 'strength', Dance: 'dance', SocialDance: 'dance', CardioDance: 'dance',
  Flexibility: 'stretch', Cooldown: 'stretch', Soccer: 'sport', Tennis: 'sport', Basketball: 'sport', Volleyball: 'sport', Golf: 'sport', Badminton: 'sport', TableTennis: 'sport',
};

// -------------------------------------------------------------- Apple Health

interface AppleState {
  sleep: Map<string, { asleep: Array<[number, number]>; inBed: Array<[number, number]> }>;
  steps: Map<string, Map<string, number>>;
  exercise: Map<string, Map<string, number>>;
  waterMl: Map<string, number>;
  flow: Map<string, string>;
  mindful: Map<string, number>;
  workouts: Array<{ day: string; type: string; minutes: number }>;
  records: number;
  skipped: number;
}

export interface LineParser {
  ingest(line: string): void;
  finish(): ImportResult;
}

export function createAppleHealthParser(): LineParser {
  const s: AppleState = { sleep: new Map(), steps: new Map(), exercise: new Map(), waterMl: new Map(), flow: new Map(), mindful: new Map(), workouts: [], records: 0, skipped: 0 };

  const ingest = (line: string) => {
    const t = line.trimStart();
    if (t.startsWith('<Record ')) {
      const a = attrs(t);
      const type = a.type ?? '';
      const start = appleDate(a.startDate);
      const end = appleDate(a.endDate);
      const source = a.sourceName || 'unknown';
      const value = Number(a.value);
      s.records += 1;
      if (type === 'HKCategoryTypeIdentifierSleepAnalysis') {
        if (!start || !end) { s.skipped += 1; return; }
        const v = a.value ?? '';
        const night = s.sleep.get(end.day) ?? { asleep: [], inBed: [] };
        if (/Asleep/.test(v)) night.asleep.push([start.ms, end.ms]);
        else if (/InBed/.test(v)) night.inBed.push([start.ms, end.ms]);
        else return;
        s.sleep.set(end.day, night);
      } else if (type === 'HKQuantityTypeIdentifierStepCount') {
        if (!start || !Number.isFinite(value)) { s.skipped += 1; return; }
        bump(s.steps, start.day, source, value);
      } else if (type === 'HKQuantityTypeIdentifierAppleExerciseTime') {
        if (!start || !Number.isFinite(value)) { s.skipped += 1; return; }
        bump(s.exercise, start.day, source, value);
      } else if (type === 'HKQuantityTypeIdentifierDietaryWater') {
        if (!start || !Number.isFinite(value)) { s.skipped += 1; return; }
        const unit = (a.unit ?? 'mL').toLowerCase();
        const ml = unit === 'l' ? value * 1000 : unit.startsWith('fl_oz') ? value * 29.5735 : value;
        s.waterMl.set(start.day, (s.waterMl.get(start.day) ?? 0) + ml);
      } else if (type === 'HKCategoryTypeIdentifierMenstrualFlow') {
        if (!start) { s.skipped += 1; return; }
        const v = a.value ?? '';
        const flow = /Heavy/.test(v) ? 'heavy' : /Medium/.test(v) ? 'medium' : /Light/.test(v) ? 'light' : /Unspecified/.test(v) ? 'medium' : null;
        if (!flow) return;
        const prev = s.flow.get(start.day);
        if (!prev || (FLOW_RANK[flow] ?? 0) > (FLOW_RANK[prev] ?? 0)) s.flow.set(start.day, flow);
      } else if (type === 'HKCategoryTypeIdentifierMindfulSession') {
        if (!start || !end) { s.skipped += 1; return; }
        s.mindful.set(start.day, (s.mindful.get(start.day) ?? 0) + (end.ms - start.ms) / 60000);
      }
    } else if (t.startsWith('<Workout ')) {
      const a = attrs(t);
      const start = appleDate(a.startDate);
      const end = appleDate(a.endDate);
      if (!start) { s.skipped += 1; return; }
      const raw = (a.workoutActivityType ?? '').replace(/^HKWorkoutActivityType/, '');
      const unit = (a.durationUnit ?? 'min').toLowerCase();
      let minutes = Number(a.duration);
      if (!Number.isFinite(minutes) && end) minutes = (end.ms - start.ms) / 60000;
      else if (unit.startsWith('s')) minutes /= 60;
      else if (unit.startsWith('h')) minutes *= 60;
      if (!Number.isFinite(minutes) || minutes < 1) { s.skipped += 1; return; }
      s.workouts.push({ day: start.day, type: APPLE_WORKOUT_TYPES[raw] ?? 'other', minutes: Math.round(minutes) });
    }
  };

  const finish = (): ImportResult => {
    const entries: ImportEntry[] = [];
    const source = 'apple-health';
    for (const [day, night] of s.sleep) {
      const hours = night.asleep.length ? mergedHours(night.asleep) : mergedHours(night.inBed);
      if (hours > 0 && hours <= 24) entries.push({ kind: 'SLEEP', day, payload: { hours, source } });
    }
    const workoutMinutes = new Map<string, number>();
    for (const w of s.workouts) {
      workoutMinutes.set(w.day, (workoutMinutes.get(w.day) ?? 0) + w.minutes);
      entries.push({ kind: 'ACTIVITY', day: w.day, payload: { type: w.type, minutes: w.minutes, note: 'Apple Health workout', source } });
    }
    for (const [day, minutes] of s.mindful) {
      if (minutes >= 1) entries.push({ kind: 'ACTIVITY', day, payload: { type: 'meditation', minutes: Math.round(minutes), note: 'Apple Health mindful minutes', source } });
    }
    const days = new Set([...s.steps.keys(), ...s.exercise.keys()]);
    for (const day of days) {
      const steps = Math.round(maxOverSources(s.steps.get(day)));
      const exercise = maxOverSources(s.exercise.get(day));
      const residual = Math.max(0, Math.round(exercise - (workoutMinutes.get(day) ?? 0)));
      if (steps >= 1 || residual >= 1) entries.push({ kind: 'ACTIVITY', day, payload: { type: 'other', minutes: Math.min(600, residual), steps: Math.min(100000, steps), note: 'Apple Health, the day', source } });
    }
    for (const [day, ml] of s.waterMl) {
      const glasses = Math.min(30, Math.round((ml / 250) * 2) / 2);
      if (glasses > 0) entries.push({ kind: 'HYDRATION', day, payload: { glasses, source } });
    }
    for (const [day, flow] of s.flow) entries.push({ kind: 'PERIOD', day, payload: { flow, source } });
    entries.sort((a, b) => a.day.localeCompare(b.day));
    const notes = [`${s.records.toLocaleString()} records read.`];
    if (s.workouts.length) notes.push(`${s.workouts.length} workouts.`);
    notes.push('Steps and exercise minutes take the largest single source for a day, not the sum, because a phone and a watch both count.');
    return { source, entries, skipped: s.skipped, notes };
  };

  return { ingest, finish };
}

export function parseAppleHealthText(text: string): ImportResult {
  const p = createAppleHealthParser();
  for (const line of text.split(/\r?\n/)) p.ingest(line);
  return p.finish();
}

// ---------------------------------------------------------------- Google Fit

const GOOGLE_ACTIVITIES: Record<string, string> = {
  walking: 'walk', running: 'run', jogging: 'run', biking: 'cycle', cycling: 'cycle', swimming: 'swim', yoga: 'yoga', pilates: 'pilates', meditation: 'meditation',
  strength_training: 'strength', weightlifting: 'strength', calisthenics: 'strength', dancing: 'dance', stretching: 'stretch', hiking: 'walk', aerobics: 'other',
  tennis: 'sport', soccer: 'sport', basketball: 'sport', volleyball: 'sport', badminton: 'sport', golf: 'sport',
};

/** Takeout's "Daily activity metrics/Daily Summaries.csv". */
export function parseGoogleFitDailyCsv(text: string): ImportResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  const source = 'google-fit';
  if (lines.length === 0) return { source, entries: [], skipped: 0, notes: ['The file is empty.'] };
  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  const col = (re: RegExp) => header.findIndex((h) => re.test(h));
  const iDate = col(/^date$/i);
  const iSteps = col(/step count/i);
  const iMove = col(/move minutes/i);
  const iDur = header.map((h, i) => (/duration \(ms\)/i.test(h) ? i : -1)).filter((i) => i >= 0);
  if (iDate < 0 || (iSteps < 0 && iMove < 0)) {
    return { source, entries: [], skipped: lines.length - 1, notes: [/start time/i.test(lines[0]) ? 'This is a per-quarter-hour file. Use "Daily Summaries.csv" from the same folder.' : 'No Date, Step count or Move Minutes columns were found.'] };
  }
  const entries: ImportEntry[] = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const day = (cells[iDate] ?? '').trim().slice(0, 10);
    if (!isDay(day)) { skipped += 1; continue; }
    const steps = iSteps >= 0 ? Math.round(Number(cells[iSteps]) || 0) : 0;
    let minutes = iMove >= 0 ? Math.round(Number(cells[iMove]) || 0) : 0;
    if (!minutes && iDur.length) minutes = Math.round(iDur.reduce((a, i) => a + (Number(cells[i]) || 0), 0) / 60000);
    if (steps < 1 && minutes < 1) { skipped += 1; continue; }
    entries.push({ kind: 'ACTIVITY', day, payload: { type: 'other', minutes: Math.min(600, minutes), steps: Math.min(100000, steps), note: 'Google Fit, the day', source } });
  }
  entries.sort((a, b) => a.day.localeCompare(b.day));
  return { source, entries, skipped, notes: [`${entries.length} days with steps or move minutes.`] };
}

/** Takeout's "All Sessions" files: one JSON object per workout or night. */
export function parseGoogleFitSessions(files: Array<{ name: string; text: string }>): ImportResult {
  const source = 'google-fit';
  const entries: ImportEntry[] = [];
  let skipped = 0;
  for (const f of files) {
    let j: Record<string, unknown>;
    try { j = JSON.parse(f.text) as Record<string, unknown>; } catch { skipped += 1; continue; }
    const items = Array.isArray(j) ? (j as Record<string, unknown>[]) : [j];
    for (const item of items) {
      const activity = String(item.fitnessActivity ?? '').toLowerCase();
      const start = String(item.startTime ?? '');
      const end = String(item.endTime ?? '');
      const startMs = Date.parse(start);
      const endMs = Date.parse(end);
      if (!activity || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) { skipped += 1; continue; }
      const startDay = start.slice(0, 10);
      const endDay = end.slice(0, 10);
      const minutes = (endMs - startMs) / 60000;
      if (activity === 'sleep' || activity === 'sleeping') {
        const hours = round2(minutes / 60);
        if (hours > 0 && hours <= 24 && isDay(endDay)) entries.push({ kind: 'SLEEP', day: endDay, payload: { hours, source } });
        continue;
      }
      if (!isDay(startDay) || minutes < 1) { skipped += 1; continue; }
      const aggregate = Array.isArray(item.aggregate) ? (item.aggregate as Array<Record<string, unknown>>) : [];
      const stepsAgg = aggregate.find((a) => String(a.metricName ?? '').includes('step_count'));
      const steps = stepsAgg ? Math.round(Number(stepsAgg.intValue ?? stepsAgg.fpValue ?? 0)) : 0;
      entries.push({ kind: 'ACTIVITY', day: startDay, at: new Date(startMs).toISOString(), payload: { type: GOOGLE_ACTIVITIES[activity] ?? 'other', minutes: Math.min(600, Math.round(minutes)), ...(steps > 0 ? { steps: Math.min(100000, steps) } : {}), note: `Google Fit ${activity.replace(/_/g, ' ')}`, source } });
    }
  }
  entries.sort((a, b) => a.day.localeCompare(b.day));
  return { source, entries, skipped, notes: [`${files.length} session file${files.length === 1 ? '' : 's'} read.`] };
}

// ------------------------------------------------------------- ATHENA's CSV

const ARRAY_FIELDS = new Set(['symptoms', 'tags']);
const KINDS: ImportKind[] = ['CHECKIN', 'SLEEP', 'ACTIVITY', 'HYDRATION', 'PERIOD', 'NUTRITION', 'SYMPTOM'];

function parseValue(field: string, raw: string): unknown {
  if (ARRAY_FIELDS.has(field)) return raw ? raw.split(/;\s*/).filter(Boolean) : [];
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

/** The file the insights page writes: kind, day, at, field, value; one row per field. */
export function parseAthenaCsv(text: string): ImportResult {
  const source = 'athena-csv';
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  const header = lines[0] ? splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase()) : [];
  if (header.join(',') !== 'kind,day,at,field,value') return { source, entries: [], skipped: lines.length, notes: ['Not the CSV this app writes. It starts with "kind,day,at,field,value".'] };
  const groups = new Map<string, ImportEntry>();
  let skipped = 0;
  let doses = 0;
  for (const line of lines.slice(1)) {
    const [kind, day, at, field, value] = splitCsvLine(line);
    if (kind === 'MEDICATION_DOSE') { doses += 1; continue; }
    if (!KINDS.includes(kind as ImportKind) || !isDay(day ?? '')) { skipped += 1; continue; }
    const key = `${kind}|${day}|${at}`;
    const entry = groups.get(key) ?? { kind: kind as ImportKind, day, at: at && Number.isFinite(Date.parse(at)) ? at : undefined, payload: {} };
    if (field && field !== 'source') entry.payload[field] = parseValue(field, value ?? '');
    groups.set(key, entry);
  }
  const entries = Array.from(groups.values()).map((e) => (e.kind === 'ACTIVITY' || e.kind === 'NUTRITION' || e.kind === 'SYMPTOM' ? { ...e, payload: { ...e.payload, source } } : e));
  entries.sort((a, b) => a.day.localeCompare(b.day) || (a.at ?? '').localeCompare(b.at ?? ''));
  const notes = [`${entries.length} entries in the file.`];
  if (doses) notes.push(`${doses} dose logs were left out; they belong to medications that are set up separately.`);
  return { source, entries, skipped, notes };
}

// ------------------------------------------------------------------ summary

export function summarise(entries: ImportEntry[]): { byKind: Array<{ kind: ImportKind; count: number }>; from: string | null; to: string | null } {
  const counts = new Map<ImportKind, number>();
  for (const e of entries) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  const days = entries.map((e) => e.day).sort();
  return { byKind: KINDS.filter((k) => counts.has(k)).map((kind) => ({ kind, count: counts.get(kind)! })), from: days[0] ?? null, to: days[days.length - 1] ?? null };
}
