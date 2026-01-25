import Link from 'next/link';
import { ArrowRight, Calendar, Sparkles, Users } from 'lucide-react';

const upcomingEvents = [
  { title: 'Career Growth AMA', date: 'Feb 6, 2026', location: 'Virtual' },
  { title: 'Mentor Match Night', date: 'Feb 18, 2026', location: 'Virtual' },
  { title: 'Women in Tech Mixer', date: 'Mar 2, 2026', location: 'Sydney' },
];

export default function EventsPage() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center gap-2 text-primary-600">
        <Calendar className="h-5 w-5" />
        <span className="text-sm font-semibold uppercase tracking-wider">Events</span>
      </div>
      <h1 className="mt-3 text-3xl font-bold">Upcoming events</h1>
      <p className="mt-2 text-muted-foreground">
        Meet mentors, learn from experts, and grow your network.
      </p>

      <div className="mt-8 grid gap-4">
        {upcomingEvents.map((event) => (
          <div key={event.title} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm text-muted-foreground">{event.date} • {event.location}</p>
                <h3 className="text-lg font-semibold mt-1">{event.title}</h3>
              </div>
              <Link href="/community" className="inline-flex items-center gap-2 text-primary-600 text-sm font-medium">
                View details <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link href="/community" className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <Sparkles className="h-4 w-4" /> Community calendar
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Discover events hosted by the community.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-primary-600 text-sm font-medium">
            Explore calendar <ArrowRight className="h-4 w-4" />
          </span>
        </Link>

        <Link href="/mentors" className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
            <Users className="h-4 w-4" /> Mentor sessions
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Book one-on-one or group sessions with experts.</p>
          <span className="mt-3 inline-flex items-center gap-2 text-primary-600 text-sm font-medium">
            Browse mentors <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </div>
    </div>
  );
}
