/**
 * Calendar files for the wellness pages: an appointment as a single event,
 * a circle as a weekly series. Plain iCalendar text (RFC 5545) that Apple
 * Calendar, Google Calendar and Outlook all import, so "add to calendar"
 * needs no integration and no account on either side.
 *
 * An appointment is an instant, written in UTC. A circle's meeting time is
 * the wall-clock time the group agreed, written as a floating time so it
 * lands at 19:00 wherever each member's calendar happens to be.
 */

import { addDays, isoDay, weekdayOf } from './wellness-dates';

export interface IcsEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  /** An instant, or a floating wall-clock time on a day. */
  start: Date | { day: string; time: string };
  durationMinutes: number;
  /** A recurrence rule without the RRULE: prefix, for example FREQ=WEEKLY;COUNT=8. */
  rrule?: string;
}

export function icsEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** 2026-09-15T09:00:00.000Z as 20260915T090000Z. */
export function icsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** A floating time: the day and the HH:MM with no zone. */
export function icsFloating(day: string, time: string): string {
  return `${isoDay(day).replace(/-/g, '')}T${time.replace(':', '')}00`;
}

/** Lines longer than 75 octets are folded with a leading space, as the standard asks. */
export function foldLine(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest, 'utf8') > 75) {
    let cut = 75;
    while (cut > 0 && Buffer.byteLength(rest.slice(0, cut), 'utf8') > 75) cut -= 1;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join('\r\n');
}

export function buildIcs(events: IcsEvent[], calendarName = 'ATHENA wellness'): string {
  const stamp = icsUtc(new Date());
  const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ATHENA//Wellness//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${icsEscape(calendarName)}`];
  for (const e of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    if (e.start instanceof Date) lines.push(`DTSTART:${icsUtc(e.start)}`);
    else lines.push(`DTSTART:${icsFloating(e.start.day, e.start.time)}`);
    lines.push(`DURATION:PT${Math.max(1, Math.round(e.durationMinutes))}M`);
    if (e.rrule) lines.push(`RRULE:${e.rrule}`);
    lines.push(`SUMMARY:${icsEscape(e.summary)}`);
    if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`);
    if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

export interface BookingForIcs {
  id: string;
  scheduledAt: Date | string;
  durationMinutes: number;
  mode: string;
  practitionerName: string;
  kindLabel?: string;
  meetingLink?: string | null;
  location?: string | null;
  appUrl?: string;
}

export function buildBookingIcs(b: BookingForIcs): string {
  const telehealth = b.mode === 'TELEHEALTH';
  return buildIcs([{
    uid: `booking-${b.id}@athena.wellness`,
    summary: `${b.practitionerName}${b.kindLabel ? ` (${b.kindLabel})` : ''}`,
    description: [telehealth ? 'Telehealth appointment.' : 'In-person appointment.', b.meetingLink ? `Join: ${b.meetingLink}` : '', 'Booked through ATHENA. Your notes and follow-up are on the appointments page.'].filter(Boolean).join('\n'),
    location: telehealth ? (b.meetingLink ?? 'Telehealth') : (b.location ?? undefined),
    url: b.meetingLink ?? b.appUrl,
    start: new Date(b.scheduledAt),
    durationMinutes: b.durationMinutes,
  }], 'ATHENA appointment');
}

export interface CircleForIcs {
  id: string;
  name: string;
  topic: string;
  startsOn: string;
  weeks: number;
  meetingDay: number;
  meetingTime: string;
  format: string;
  meetingLink?: string | null;
  location?: string | null;
  appUrl?: string;
}

/** The first meeting is the meeting day in the week the circle starts. */
export function firstMeetingDay(startsOn: string, meetingDay: number): string {
  const start = isoDay(startsOn);
  const offset = (meetingDay - weekdayOf(start) + 7) % 7;
  return addDays(start, offset);
}

export function buildCircleIcs(c: CircleForIcs): string {
  const online = c.format === 'VIDEO';
  return buildIcs([{
    uid: `circle-${c.id}@athena.wellness`,
    summary: `${c.name} (support circle)`,
    description: [`A ${c.topic.replace(/-/g, ' ')} circle, ${c.weeks} weeks. Check in before you meet: a win, a blocker, the next step.`, online && c.meetingLink ? `Join: ${c.meetingLink}` : '', c.appUrl ? `The circle page: ${c.appUrl}` : ''].filter(Boolean).join('\n'),
    location: online ? (c.meetingLink ?? 'Video call') : c.format === 'ASYNC' ? 'Written, in your own time' : (c.location ?? undefined),
    url: c.appUrl,
    start: { day: firstMeetingDay(c.startsOn, c.meetingDay), time: c.meetingTime },
    durationMinutes: 45,
    rrule: `FREQ=WEEKLY;COUNT=${Math.max(1, c.weeks)}`,
  }], `ATHENA circle: ${c.name}`);
}
