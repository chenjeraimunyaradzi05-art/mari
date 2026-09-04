'use client';

import { useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Video,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Heart,
  Share2,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, Badge } from '@/components/ui';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import toast from 'react-hot-toast';
import { useEvents, useRegisterEvent, useSaveEvent, useUnsaveEvent } from '@/lib/hooks';
import { HostEventDialog } from '@/components/events/HostEventDialog';

// The system share sheet where there is one; a copied link everywhere else.
async function shareEvent(event: { id: string; title: string; description: string }) {
  const url = `${window.location.origin}/events?event=${event.id}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: event.title, text: event.description.slice(0, 140), url });
      return;
    } catch {
      // Cancelled: fall through to copying.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Link copied');
  } catch {
    toast.error('Could not copy the link');
  }
}

interface Event {
  id: string;
  title: string;
  description: string;
  type: 'webinar' | 'workshop' | 'networking' | 'conference' | 'meetup';
  format: 'virtual' | 'in-person' | 'hybrid';
  date: Date;
  startTime: string;
  endTime: string;
  location?: string;
  link?: string;
  image: string;
  host: {
    name: string;
    title: string;
    avatar: string;
  };
  attendees: number;
  maxAttendees?: number;
  price: number;
  isRegistered: boolean;
  isSaved: boolean;
  tags: string[];
}

const eventTypes = [
  { value: 'all', label: 'All Events' },
  { value: 'webinar', label: 'Webinars' },
  { value: 'workshop', label: 'Workshops' },
  { value: 'networking', label: 'Networking' },
  { value: 'conference', label: 'Conferences' },
  { value: 'meetup', label: 'Meetups' },
];

export default function EventsPage() {
  const [selectedType, setSelectedType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [hosting, setHosting] = useState(false);

  useEffect(() => {
    const now = new Date();
    setCurrentWeekStart(startOfWeek(now));
    setIsHydrated(true);
  }, []);

  const { data: rawEvents = [] } = useEvents({
    type: selectedType === 'all' ? 'all' : selectedType,
    q: searchQuery || undefined,
  });

  const registerEvent = useRegisterEvent();
  const saveEvent = useSaveEvent();
  const unsaveEvent = useUnsaveEvent();

  const events: Event[] = rawEvents.map((e: any) => ({
    ...e,
    date: new Date(e.date),
  }));

  const filteredEvents = events
    .filter((event) => !selectedDate || isSameDay(event.date, selectedDate));

  const effectiveWeekStart = currentWeekStart;
  const weekDays = effectiveWeekStart
    ? Array.from({ length: 7 }, (_, i) => addDays(effectiveWeekStart, i))
    : [];

  const getEventCountForDay = (date: Date) => {
    return events.filter((event) => isSameDay(event.date, date)).length;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Events
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Discover webinars, workshops, and networking opportunities
          </p>
        </div>
        <button type="button" onClick={() => setHosting(true)} className="btn-primary flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>Host Event</span>
        </button>
      </div>

      <HostEventDialog open={hosting} onClose={() => setHosting(false)} />

      {/* Calendar Strip */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => effectiveWeekStart && setCurrentWeekStart(addDays(effectiveWeekStart, -7))}
            disabled={!effectiveWeekStart}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="font-medium text-slate-900 dark:text-white">
            {effectiveWeekStart ? format(effectiveWeekStart, 'MMMM yyyy') : 'Loading calendar'}
          </h3>
          <button
            onClick={() => effectiveWeekStart && setCurrentWeekStart(addDays(effectiveWeekStart, 7))}
            disabled={!effectiveWeekStart}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        {!effectiveWeekStart ? (
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const eventCount = getEventCountForDay(day);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isToday = isHydrated && isSameDay(day, new Date());

              return (
                <button
                  key={day.toISOString()}
                  onClick={() =>
                    setSelectedDate(isSelected ? null : day)
                  }
                  className={cn(
                    'flex flex-col items-center p-3 rounded-lg transition',
                    isSelected
                      ? 'bg-primary-500 text-white'
                      : isToday
                      ? 'bg-primary-100 dark:bg-primary-900/30'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                  )}
                >
                  <span
                    className={cn(
                      'text-xs',
                      isSelected
                        ? 'text-white/80'
                        : 'text-slate-500 dark:text-slate-400'
                    )}
                  >
                    {format(day, 'EEE')}
                  </span>
                  <span
                    className={cn(
                      'text-lg font-semibold',
                      isSelected ? 'text-white' : 'text-slate-900 dark:text-white'
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  {eventCount > 0 && (
                    <span
                      className={cn(
                        'w-1.5 h-1.5 rounded-full mt-1',
                        isSelected ? 'bg-white' : 'bg-primary-500'
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {eventTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => setSelectedType(type.value)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition',
                selectedType === type.value
                  ? 'bg-primary-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              )}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm w-full sm:w-64"
          />
        </div>
      </div>

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <div className="card text-center py-16">
          <Calendar className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            No events found
          </h3>
          <p className="text-slate-500 dark:text-slate-400">
            {selectedDate
              ? `No events on ${format(selectedDate, 'MMMM d, yyyy')}`
              : 'Try adjusting your filters'}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {filteredEvents.map((event) => (
            <div key={event.id} className="card-hover overflow-hidden">
              {/* Image */}
              <div className="relative h-48 -mx-6 -mt-6 mb-4">
                <img
                  src={event.image}
                  alt={event.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-4 left-4 flex items-center space-x-2">
                  <Badge
                    variant={event.format === 'virtual' ? 'default' : 'secondary'}
                    className="backdrop-blur-sm"
                  >
                    {event.format === 'virtual' ? (
                      <Video className="w-3 h-3 mr-1" />
                    ) : (
                      <MapPin className="w-3 h-3 mr-1" />
                    )}
                    {event.format}
                  </Badge>
                  {event.price === 0 && (
                    <Badge variant="default" className="bg-green-500 backdrop-blur-sm">
                      Free
                    </Badge>
                  )}
                </div>
                {event.isRegistered && (
                  <div className="absolute top-4 right-4">
                    <Badge variant="default" className="bg-primary-500">
                      Registered
                    </Badge>
                  </div>
                )}
              </div>

              {/* Content */}
              <div>
                <div className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400 mb-2">
                  <Calendar className="w-4 h-4" />
                  <span>{format(event.date, 'EEEE, MMMM d, yyyy')}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400 mb-3">
                  <Clock className="w-4 h-4" />
                  <span>
                    {event.startTime} - {event.endTime}
                  </span>
                  {event.location && (
                    <>
                      <span>•</span>
                      <MapPin className="w-4 h-4" />
                      <span>{event.location}</span>
                    </>
                  )}
                </div>

                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                  {event.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 line-clamp-2">
                  {event.description}
                </p>

                {/* Host */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <Avatar
                      src={event.host.avatar}
                      alt={event.host.name}
                      size="sm"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {event.host.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {event.host.title}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center text-sm text-slate-500 dark:text-slate-400">
                    <Users className="w-4 h-4 mr-1" />
                    {event.attendees}
                    {event.maxAttendees && ` / ${event.maxAttendees}`}
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {event.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => (event.isSaved ? unsaveEvent.mutate(event.id) : saveEvent.mutate(event.id))}
                      disabled={saveEvent.isPending || unsaveEvent.isPending}
                      className={cn(
                        'p-2 rounded-lg transition',
                        event.isSaved
                          ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                          : 'text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                      )}
                    >
                      <Heart
                        className={cn('w-5 h-5', event.isSaved && 'fill-current')}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => void shareEvent(event)}
                      aria-label={`Share ${event.title}`}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>
                  {event.isRegistered ? (
                    <button
                      className="btn-outline flex items-center space-x-2"
                      onClick={() => {
                        if (event.link) window.open(event.link, '_blank', 'noopener,noreferrer');
                      }}
                      disabled={!event.link}
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Join Event</span>
                    </button>
                  ) : (
                    <button
                      className="btn-primary"
                      onClick={() => registerEvent.mutate(event.id)}
                      disabled={registerEvent.isPending}
                    >
                      {event.price > 0 ? `Register - $${event.price}` : 'Register Free'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
