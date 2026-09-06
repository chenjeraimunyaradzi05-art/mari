'use client';

/**
 * What is coming up: the next few events from the platform's own list, as
 * cards with the date as a calendar leaf, where it is (or that it is online),
 * and what it costs. Renders nothing when nothing is listed.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarDays, MapPin, Users, Video } from 'lucide-react';
import { eventsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Rail, SkeletonTiles, StaggerItem, StaggerList, TILE_GRADIENTS } from './RailShell';

type Event = {
  id: string;
  title: string;
  type?: string | null;
  format?: string | null;
  date: string;
  startTime?: string | null;
  location?: string | null;
  attendees?: number | null;
  price?: number | null;
  host?: { name?: string | null } | null;
};

const monthFormat = new Intl.DateTimeFormat('en-AU', { month: 'short' });
const weekdayFormat = new Intl.DateTimeFormat('en-AU', { weekday: 'short' });

function leaf(value: string): { day: string; month: string; weekday: string } | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return { day: String(d.getDate()), month: monthFormat.format(d), weekday: weekdayFormat.format(d) };
}

const sentence = (v?: string | null) => (v ? v.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : null);

export function EventsRail() {
  const [events, setEvents] = useState<Event[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    eventsApi
      .list()
      .then((r) => {
        if (cancelled) return;
        const data = r.data?.data;
        const list: Event[] = Array.isArray(data) ? data : [];
        const now = Date.now() - 24 * 3600 * 1000;
        const upcoming = list.filter((e) => new Date(e.date).getTime() >= now).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setEvents((upcoming.length > 0 ? upcoming : list).slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (events !== null && events.length === 0) return null;

  return (
    <Rail icon={CalendarDays} tone="sky" kicker="Events" title="Coming up" titleId="home-events-title" description="Meetups, workshops and online sessions, soonest first." cta={{ href: '/events', label: 'All events' }}>
      <StaggerList className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {events === null ? (
          <SkeletonTiles count={3} height="h-36" />
        ) : (
          events.map((event, index) => {
            const when = leaf(event.date);
            const online = /virtual|online/i.test(event.format ?? '');
            return (
              <StaggerItem key={event.id}>
                <Link href="/events" className="tile-glass group flex h-full gap-3 p-4">
                  <span className={cn('flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br text-white', TILE_GRADIENTS[(index + 4) % TILE_GRADIENTS.length])}>
                    {when ? (
                      <>
                        <span className="text-[10px] font-semibold uppercase leading-none opacity-90">{when.month}</span>
                        <span className="mt-0.5 text-xl font-bold leading-none tabular-nums">{when.day}</span>
                        <span className="mt-0.5 text-[10px] leading-none opacity-90">{when.weekday}</span>
                      </>
                    ) : (
                      <CalendarDays className="h-5 w-5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900 dark:text-white">{event.title}</span>
                    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {event.startTime && <span>{event.startTime}</span>}
                      <span className="inline-flex items-center gap-1">
                        {online ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                        {online ? 'Online' : event.location || sentence(event.format) || 'Venue to come'}
                      </span>
                    </span>
                    <span className="mt-2 flex items-center gap-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', event.price === 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200')}>
                        {event.price === 0 ? 'Free' : typeof event.price === 'number' ? `$${event.price}` : sentence(event.type) || 'Event'}
                      </span>
                      {typeof event.attendees === 'number' && event.attendees > 1 && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <Users className="h-3 w-3" /> {event.attendees} going
                        </span>
                      )}
                      <ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-sky-500 dark:text-slate-600" />
                    </span>
                  </span>
                </Link>
              </StaggerItem>
            );
          })
        )}
      </StaggerList>
    </Rail>
  );
}
