'use client';

import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock,
  MapPin,
  Search,
  Users,
  Video,
} from 'lucide-react';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { eventsApi } from '@/lib/api';
import {
  EmptyState,
  FilterPill,
  PageHero,
  PageShell,
  Section,
  TileSkeleton,
} from '@/components/layout/PageShell';

const EVENT_TYPES = [
  { value: 'all', label: 'All events' },
  { value: 'conference', label: 'Conferences' },
  { value: 'workshop', label: 'Workshops' },
  { value: 'networking', label: 'Networking' },
  { value: 'webinar', label: 'Webinars' },
  { value: 'meetup', label: 'Meetups' },
];

type PublicEvent = {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  format: 'virtual' | 'in-person' | 'hybrid';
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  /** The organiser's own listing. Absent for events with nowhere to send you. */
  link?: string | null;
  host?: {
    name?: string | null;
    title?: string | null;
  };
  attendees?: number;
  maxAttendees?: number | null;
  price?: number | null;
  tags?: string[];
};

/* ---------------------------------------------------------------- formatting */

// Australian audience, Australian dates: "Thu 17 Sep 2026", never "9/17/2026".
const dayFormat = new Intl.DateTimeFormat('en-AU', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatEventDate(value: string): string | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : dayFormat.format(parsed);
}

function sentenceCase(value: string): string {
  const words = value.replace(/[-_]/g, ' ').trim().toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : words;
}

/**
 * Only send someone off-site to a real http(s) address. Anything else — a blank
 * string, a half-saved listing — falls back to the internal calendar rather than
 * rendering an action that goes nowhere.
 */
function externalLink(link?: string | null): string | null {
  if (!link) return null;
  try {
    const url = new URL(link);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'the organiser';
  }
}

function readError(err: unknown): string {
  const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return typeof message === 'string' && message.length > 0
    ? message
    : 'We could not load events just now. Try again in a moment.';
}

/* --------------------------------------------------------------------- card */

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
      {children}
    </span>
  );
}

function EventCard({ event }: { event: PublicEvent }) {
  const href = externalLink(event.link);
  const date = formatEventDate(event.date);
  const time = [event.startTime, event.endTime].filter(Boolean).join(' – ');
  const place = event.location || sentenceCase(event.format);
  const tags = (event.tags ?? []).slice(0, 3);
  const going = event.attendees ?? 0;
  const tile = 'tile-soft focusable flex h-full flex-col p-4';

  const body = (
    <>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        {date && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {date}
          </span>
        )}
        {time && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {time}
          </span>
        )}
      </span>

      <span className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white">
        {event.title}
      </span>

      <span className="mt-1 flex items-start gap-1 text-xs text-slate-500 dark:text-slate-400">
        {event.format === 'virtual' ? (
          <Video className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className="line-clamp-1">{place}</span>
      </span>

      {event.description && (
        <span className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
          {event.description}
        </span>
      )}

      <span className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
          {sentenceCase(event.type)}
        </span>
        {/* A null price means the organiser has not published one. Calling that
            "Free" would assert something untrue of a ticketed conference. */}
        <Badge>
          {event.price == null
            ? 'Price with organiser'
            : event.price === 0
              ? 'Free'
              : `$${event.price}`}
        </Badge>
        {going > 0 && (
          <Badge>
            <Users className="h-2.5 w-2.5" aria-hidden="true" />
            {going} going{event.maxAttendees ? ` of ${event.maxAttendees}` : ''}
          </Badge>
        )}
        {tags.map((tag) => (
          <Badge key={tag}>{tag.replace(/-/g, ' ')}</Badge>
        ))}
      </span>

      <span className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
        {event.host?.name ? (
          <span className="truncate text-xs text-slate-500 dark:text-slate-400">
            Hosted by {event.host.name}
          </span>
        ) : (
          <span />
        )}
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
          {href ? (
            <>
              Book on {hostname(href)}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </>
          ) : (
            <>
              Open in your calendar
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </>
          )}
        </span>
      </span>
    </>
  );

  return (
    <li>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={tile}
          aria-label={`${event.title} — opens on ${hostname(href)} in a new tab`}
        >
          {body}
        </a>
      ) : (
        <Link href="/dashboard/events" className={tile}>
          {body}
        </Link>
      )}
    </li>
  );
}

/* --------------------------------------------------------------------- page */

export default function EventsPage() {
  const [selectedType, setSelectedType] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // One request per pause in typing, rather than one per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    const loadEvents = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await eventsApi.list({
          type: selectedType,
          q: searchQuery || undefined,
        });
        if (!cancelled) {
          const data = response.data?.data;
          setEvents(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setEvents([]);
          setError(readError(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, [searchQuery, selectedType]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return events.filter((event) => {
      const at = new Date(event.date).getTime();
      // An unparseable date is still a real listing; better to show it than to
      // silently drop it.
      return Number.isNaN(at) || at >= now;
    });
  }, [events]);

  const isFiltered = selectedType !== 'all' || searchQuery.length > 0;

  const clearFilters = useCallback(() => {
    setSelectedType('all');
    setSearchInput('');
    setSearchQuery('');
  }, []);

  return (
    <PageShell>
      <div className="space-y-6">
        <PageHero
          kicker="Events"
          title="Come and meet people working on the same things you are"
          description="Conferences, workshops and meetups from organisers around Australia, listed with the dates, venues and booking links they published themselves."
          primaryAction={{ label: 'Your event calendar', href: '/dashboard/events' }}
        />

        <div className="surface p-4">
          <label htmlFor="event-search" className="kicker">
            Find an event
          </label>
          <div className="relative mt-2">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="event-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by title, topic or city"
              className="focusable w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {EVENT_TYPES.map((type) => (
              <FilterPill
                key={type.value}
                active={selectedType === type.value}
                onClick={() => setSelectedType(type.value)}
              >
                {type.label}
              </FilterPill>
            ))}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
          >
            {error}
          </div>
        )}

        {loading ? (
          <Section
            icon={CalendarDays}
            title="Upcoming events"
            description="Loading what is coming up."
          >
            <ul className="grid gap-3 sm:grid-cols-2">
              <TileSkeleton count={4} className="h-44" />
            </ul>
          </Section>
        ) : upcomingEvents.length > 0 ? (
          <Section
            icon={CalendarDays}
            title="Upcoming events"
            description="Times, venues and prices are exactly as the organiser published them."
          >
            <ul className="grid gap-3 sm:grid-cols-2">
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </ul>
          </Section>
        ) : /* A failed request is not an empty catalogue. When the load errored the
              banner above is the whole story — saying "no events listed yet" would
              assert something we do not know. */
        error ? null : isFiltered ? (
          <EmptyState
            icon={CalendarDays}
            reason="filtered"
            title="Nothing coming up matches that"
            description="No upcoming event fits the type or the words you searched for. Clearing the filters will show everything that is listed."
            onClear={clearFilters}
          />
        ) : events.length > 0 ? (
          <EmptyState
            icon={CalendarDays}
            reason="empty"
            title="Every listed event has already run"
            description="Nothing is coming up right now. New events appear here as soon as an organiser publishes one."
            primaryAction={{ label: 'Your event calendar', href: '/dashboard/events' }}
          />
        ) : (
          <EmptyState
            icon={CalendarDays}
            reason="empty"
            title="No events listed yet"
            description="Nobody has published an event here yet. If you are running one, or you know of one worth sharing, tell us and we will look at listing it."
            primaryAction={{ label: 'Tell us about an event', href: '/contact' }}
            secondaryAction={{ label: 'Your event calendar', href: '/dashboard/events' }}
          />
        )}

        <Section
          icon={Users}
          title="Other ways to meet people"
          description="If nothing above suits, these are the quieter options."
        >
          <ul className="grid gap-3 sm:grid-cols-2">
            <li>
              <Link href="/dashboard/events" className="tile-soft focusable flex h-full flex-col p-4">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  Your event calendar
                </span>
                <span className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  Everything you have registered for or saved, in one place.
                </span>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  Open calendar <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </Link>
            </li>
            <li>
              <Link href="/dashboard/mentors" className="tile-soft focusable flex h-full flex-col p-4">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  Mentor sessions
                </span>
                <span className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  Book time one to one with someone who has done it before.
                </span>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  Browse mentors <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </Link>
            </li>
          </ul>
        </Section>
      </div>
    </PageShell>
  );
}
