'use client';

import Link from 'next/link';
import { ArrowRight, Calendar, Clock, Loader2, MapPin, Search, Sparkles, Users, Video } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { eventsApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';

const eventTypes = [
  { value: 'all', label: 'All events' },
  { value: 'webinar', label: 'Webinars' },
  { value: 'workshop', label: 'Workshops' },
  { value: 'networking', label: 'Networking' },
  { value: 'conference', label: 'Conferences' },
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
  host?: {
    name?: string | null;
    title?: string | null;
  };
  attendees?: number;
  maxAttendees?: number | null;
  price?: number;
  tags?: string[];
};

function formatEventType(value: string) {
  return value.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function EventsPage() {
  const [selectedType, setSelectedType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadEvents = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await eventsApi.list({
          type: selectedType,
          q: searchQuery.trim() || undefined,
        });

        if (!cancelled) {
          setEvents(response.data?.data || []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setEvents([]);
          setError(err?.response?.data?.error || 'Unable to load events right now.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, [searchQuery, selectedType]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return events.filter((event) => new Date(event.date).getTime() >= now);
  }, [events]);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center gap-2 text-primary-600">
        <Calendar className="h-5 w-5" />
        <span className="text-sm font-semibold uppercase tracking-wider">Events</span>
      </div>
      <h1 className="mt-3 text-3xl font-bold">Upcoming events</h1>
      <p className="mt-2 text-muted-foreground">
        Meet mentors, learn from experts, and grow your network through published ATHENA events.
      </p>

      <div className="mt-8 flex flex-col gap-4 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search events..."
            className="w-full rounded-lg border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {eventTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => setSelectedType(type.value)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
                selectedType === type.value
                  ? 'bg-primary-600 text-white'
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading events...
        </div>
      ) : upcomingEvents.length === 0 ? (
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
          <Calendar className="mx-auto mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">No upcoming events published</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {searchQuery || selectedType !== 'all'
              ? 'Try adjusting your search or event type.'
              : 'Check back soon for new community sessions.'}
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4">
          {upcomingEvents.map((event) => (
            <div key={event.id} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(event.date)}
                    </span>
                    {(event.startTime || event.endTime) && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {[event.startTime, event.endTime].filter(Boolean).join(' - ')}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      {event.format === 'virtual' ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                      {event.location || formatEventType(event.format)}
                    </span>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{event.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {event.description || 'Event details are still being finalized.'}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-primary-50 px-2 py-1 font-semibold text-primary-700">
                      {formatEventType(event.type)}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {event.price ? `$${event.price}` : 'Free'}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      <Users className="h-3 w-3" />
                      {event.attendees ?? 0}
                      {event.maxAttendees ? ` / ${event.maxAttendees}` : ''}
                    </span>
                  </div>
                </div>
                <Link href="/dashboard/events" className="inline-flex items-center gap-2 text-sm font-medium text-primary-600">
                  View in dashboard <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link href="/dashboard/events" className="group rounded-xl border border-gray-200 bg-white p-5 transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <Sparkles className="h-4 w-4" /> Community calendar
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Open the full calendar and register for live sessions.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary-600">
            Explore calendar <ArrowRight className="h-4 w-4" />
          </span>
        </Link>

        <Link href="/dashboard/mentors" className="group rounded-xl border border-gray-200 bg-white p-5 transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <Users className="h-4 w-4" /> Mentor sessions
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Book one-on-one or group sessions with experts.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary-600">
            Browse mentors <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </div>
    </div>
  );
}
