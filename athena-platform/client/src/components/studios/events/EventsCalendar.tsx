'use client';

/**
 * Events Calendar
 * Phase 4: Web Client - Persona Studios
 * Step 77: Events discovery and calendar view
 * 
 * Features:
 * - Calendar view (month/week/day)
 * - Event discovery feed
 * - Event details modal
 * - RSVP management
 * - Event filtering
 * - Create event
 */

import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Calendar,
  CalendarDays,
  List,
  Grid3X3,
  MapPin,
  Video,
  Users,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
  Check,
  X,
  Share2,
  Bookmark,
  BookmarkCheck,
  Globe,
  Lock,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useEvents, useRegisterEvent, useSaveEvent, useUnregisterEvent, useUnsaveEvent } from '@/lib/hooks';

// ============================================
// TYPES
// ============================================

type EventType = 'webinar' | 'meetup' | 'workshop' | 'conference' | 'networking';
type RSVPStatus = 'going' | null;
type EventFormat = 'virtual' | 'in-person' | 'hybrid';

interface Event {
  id: string;
  title: string;
  description: string;
  type: EventType;
  date: Date;
  endDate: Date;
  location: string;
  isOnline: boolean;
  meetingUrl?: string;
  organizer: {
    id: string;
    name: string;
    avatar?: string;
    type: 'user' | 'organization';
  };
  attendees: number;
  maxAttendees?: number;
  isPublic: boolean;
  tags: string[];
  coverImage?: string;
  rsvpStatus?: RSVPStatus;
  isSaved: boolean;
}

const EVENT_TYPE_CONFIG: Record<EventType, { label: string; color: string }> = {
  webinar: { label: 'Webinar', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  meetup: { label: 'Meetup', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  workshop: { label: 'Workshop', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  conference: { label: 'Conference', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  networking: { label: 'Networking', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
};

// ============================================
// HELPERS
// ============================================

const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year: number, month: number) => {
  return new Date(year, month, 1).getDay();
};

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
};

const formatDateRange = (start: Date, end: Date) => {
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    return `${start.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })} • ${formatTime(start)} - ${formatTime(end)}`;
  }
  return `${start.toLocaleDateString('en', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}`;
};

function combineDateAndTime(dateValue: string | Date, timeValue?: string | null): Date {
  const date = new Date(dateValue);
  if (!timeValue) {
    return date;
  }

  const [hours, minutes] = timeValue.split(':').map((part) => Number(part));
  if (Number.isFinite(hours)) {
    date.setHours(hours, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  }
  return date;
}

function addHours(date: Date, hours: number): Date {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}

function normalizeEventType(type?: string): EventType {
  const normalized = type?.toLowerCase();
  if (
    normalized === 'meetup' ||
    normalized === 'workshop' ||
    normalized === 'conference' ||
    normalized === 'networking'
  ) {
    return normalized;
  }
  return 'webinar';
}

function normalizeEvent(raw: any): Event {
  const type = normalizeEventType(raw.type);
  const format = String(raw.format || 'virtual').toLowerCase() as EventFormat;
  const date = combineDateAndTime(raw.date ?? new Date(), raw.startTime);
  const endDate = raw.endTime ? combineDateAndTime(raw.date ?? date, raw.endTime) : addHours(date, 1);
  const host = raw.host ?? {};

  return {
    id: String(raw.id),
    title: raw.title || 'Untitled event',
    description: raw.description || '',
    type,
    date,
    endDate,
    location: raw.location || (format === 'virtual' ? 'Online' : 'Location to be announced'),
    isOnline: format !== 'in-person',
    meetingUrl: raw.link,
    organizer: {
      id: String(raw.hostId || raw.organizationId || raw.id),
      name: host.name || raw.hostName || 'ATHENA community',
      avatar: host.avatar,
      type: raw.organizationId ? 'organization' : 'user',
    },
    attendees: Number(raw.attendees ?? 0),
    maxAttendees: typeof raw.maxAttendees === 'number' ? raw.maxAttendees : undefined,
    isPublic: !raw.isPrivate,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    coverImage: raw.image,
    rsvpStatus: raw.isRegistered ? 'going' : null,
    isSaved: Boolean(raw.isSaved),
  };
}

// ============================================
// COMPONENTS
// ============================================

function EventCard({
  event,
  onClick,
  onSaveToggle,
  compact = false,
}: {
  event: Event;
  onClick: () => void;
  onSaveToggle: (event: Event) => void;
  compact?: boolean;
}) {
  const typeConfig = EVENT_TYPE_CONFIG[event.type];

  if (compact) {
    return (
      <div
        className="p-3 border rounded-lg hover:bg-muted cursor-pointer"
        onClick={onClick}
      >
        <div className="flex items-center gap-2 mb-1">
          <Badge className={cn('text-xs', typeConfig.color)}>
            {typeConfig.label}
          </Badge>
          {event.isOnline ? (
            <Video className="h-3 w-3 text-muted-foreground" />
          ) : (
            <MapPin className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
        <h4 className="font-medium text-sm line-clamp-1">{event.title}</h4>
        <p className="text-xs text-muted-foreground mt-1">
          {formatTime(event.date)}
        </p>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      {/* Cover Image */}
      <div className="h-32 bg-gradient-to-r from-blue-500 to-purple-500 relative">
        {event.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.coverImage} alt="" className="h-full w-full object-cover" />
        )}
        <Badge className={cn('absolute top-3 left-3', typeConfig.color)}>
          {typeConfig.label}
        </Badge>
      </div>

      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold line-clamp-2">{event.title}</h3>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onSaveToggle(event);
            }}
          >
            {event.isSaved ? (
              <BookmarkCheck className="h-4 w-4 text-primary" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="space-y-2 mt-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>{event.date.toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
            <span>•</span>
            <span>{formatTime(event.date)}</span>
          </div>
          <div className="flex items-center gap-2">
            {event.isOnline ? (
              <Video className="h-4 w-4" />
            ) : (
              <MapPin className="h-4 w-4" />
            )}
            <span className="truncate">{event.location}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>
              {event.attendees} attending
              {event.maxAttendees && ` / ${event.maxAttendees} spots`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 pt-4 border-t">
          <Avatar className="h-6 w-6">
            <AvatarImage src={event.organizer.avatar} />
            <AvatarFallback className="text-xs">
              {event.organizer.type === 'organization' ? (
                <Building2 className="h-3 w-3" />
              ) : (
                event.organizer.name.split(' ').map(n => n[0]).join('')
              )}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground truncate">
            By {event.organizer.name}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function CalendarView({
  events,
  onEventClick,
}: {
  events: Event[];
  onEventClick: (event: Event) => void;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const getEventsForDay = (day: number) => {
    return events.filter(e => {
      const eventDate = new Date(e.date);
      return eventDate.getDate() === day &&
        eventDate.getMonth() === month &&
        eventDate.getFullYear() === year;
    });
  };

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {currentDate.toLocaleDateString('en', { month: 'long', year: 'numeric' })}
          </CardTitle>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
          {days.map((day, i) => {
            const dayEvents = day ? getEventsForDay(day) : [];
            const isToday = day === new Date().getDate() &&
              month === new Date().getMonth() &&
              year === new Date().getFullYear();

            return (
              <div
                key={i}
                className={cn(
                  'min-h-[80px] p-1 border rounded-lg',
                  day ? 'hover:bg-muted' : 'bg-muted/30',
                  isToday && 'border-primary'
                )}
              >
                {day && (
                  <>
                    <div className={cn(
                      'text-sm text-center mb-1',
                      isToday && 'font-bold text-primary'
                    )}>
                      {day}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 2).map(event => (
                        <div
                          key={event.id}
                          className={cn(
                            'text-xs p-1 rounded truncate cursor-pointer',
                            EVENT_TYPE_CONFIG[event.type].color
                          )}
                          onClick={() => onEventClick(event)}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-xs text-muted-foreground text-center">
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function EventDetailDialog({
  event,
  open,
  onClose,
  onRSVPChange,
  onSaveToggle,
}: {
  event: Event | null;
  open: boolean;
  onClose: () => void;
  onRSVPChange: (eventId: string, status: RSVPStatus) => void;
  onSaveToggle: (event: Event) => void;
}) {
  if (!event) return null;

  const typeConfig = EVENT_TYPE_CONFIG[event.type];
  const spotsLeft = event.maxAttendees ? event.maxAttendees - event.attendees : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        {/* Cover */}
        <div className="h-40 -mx-6 -mt-6 bg-gradient-to-r from-blue-500 to-purple-500 relative rounded-t-lg">
          <Badge className={cn('absolute top-4 left-4', typeConfig.color)}>
            {typeConfig.label}
          </Badge>
          {event.isPublic ? (
            <Badge variant="secondary" className="absolute top-4 right-4">
              <Globe className="h-3 w-3 mr-1" />
              Public
            </Badge>
          ) : (
            <Badge variant="secondary" className="absolute top-4 right-4">
              <Lock className="h-3 w-3 mr-1" />
              Private
            </Badge>
          )}
        </div>

        <DialogHeader className="pt-4">
          <DialogTitle className="text-xl">{event.title}</DialogTitle>
          <DialogDescription>{formatDateRange(event.date, event.endDate)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quick Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              {event.isOnline ? (
                <Video className="h-5 w-5 text-muted-foreground" />
              ) : (
                <MapPin className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">{event.isOnline ? 'Online Event' : event.location}</p>
                {event.meetingUrl && (
                  <a href={event.meetingUrl} className="text-sm text-primary hover:underline">
                    Join meeting
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{event.attendees} attending</p>
                {spotsLeft !== null && (
                  <p className="text-sm text-muted-foreground">
                    {spotsLeft} spots left
                  </p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Description */}
          <div>
            <h4 className="font-medium mb-2">About this event</h4>
            <p className="text-muted-foreground whitespace-pre-line">{event.description}</p>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {event.tags.map(tag => (
              <Badge key={tag} variant="secondary">{tag}</Badge>
            ))}
          </div>

          <Separator />

          {/* Organizer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={event.organizer.avatar} />
                <AvatarFallback>
                  {event.organizer.type === 'organization' ? (
                    <Building2 className="h-4 w-4" />
                  ) : (
                    event.organizer.name.split(' ').map(n => n[0]).join('')
                  )}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{event.organizer.name}</p>
                <p className="text-sm text-muted-foreground">Organizer</p>
              </div>
            </div>
            <Button variant="outline" size="sm">Follow</Button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <div className="flex gap-2 mr-auto">
            <Button variant="outline" size="icon">
              <Share2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => onSaveToggle(event)}>
              {event.isSaved ? (
                <BookmarkCheck className="h-4 w-4 text-primary" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex gap-2">
            {event.rsvpStatus === 'going' ? (
              <Button
                variant="outline"
                onClick={() => onRSVPChange(event.id, null)}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel RSVP
              </Button>
            ) : (
              <>
                <Button onClick={() => onRSVPChange(event.id, 'going')}>
                  <Check className="h-4 w-4 mr-2" />
                  I'm Going
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UpcomingEventsSidebar({
  events,
  onEventClick,
  onSaveToggle,
}: {
  events: Event[];
  onEventClick: (event: Event) => void;
  onSaveToggle: (event: Event) => void;
}) {
  const myEvents = events.filter(e => e.rsvpStatus === 'going');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">My Upcoming Events</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {myEvents.length > 0 ? (
          myEvents.slice(0, 3).map(event => (
            <EventCard
              key={event.id}
              event={event}
              onClick={() => onEventClick(event)}
              onSaveToggle={onSaveToggle}
              compact
            />
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No upcoming events. Browse events to find something interesting!
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function EventsCalendar({ className }: { className?: string }) {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'calendar' | 'list'>('grid');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const {
    data: rawEvents = [],
    isLoading,
    error,
  } = useEvents({
    type: typeFilter,
    q: searchQuery || undefined,
  });
  const registerEvent = useRegisterEvent();
  const unregisterEvent = useUnregisterEvent();
  const saveEvent = useSaveEvent();
  const unsaveEvent = useUnsaveEvent();

  const events = useMemo(
    () => (Array.isArray(rawEvents) ? rawEvents.map(normalizeEvent) : []),
    [rawEvents]
  );

  useEffect(() => {
    if (!selectedEvent) return;
    const freshEvent = events.find((event) => event.id === selectedEvent.id);
    if (freshEvent) {
      setSelectedEvent(freshEvent);
    }
  }, [events, selectedEvent?.id]);

  const filteredEvents = events.filter(event => {
    const matchesType = typeFilter === 'all' || event.type === typeFilter;
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setDialogOpen(true);
  };

  const handleRSVPChange = (eventId: string, status: RSVPStatus) => {
    if (status === 'going') {
      registerEvent.mutate(eventId);
    } else {
      unregisterEvent.mutate(eventId);
    }
  };

  const handleSaveToggle = (event: Event) => {
    if (event.isSaved) {
      unsaveEvent.mutate(event.id);
    } else {
      saveEvent.mutate(event.id);
    }
  };

  return (
    <div className={cn('container mx-auto py-8 space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-muted-foreground">Discover and attend events in your community</p>
        </div>
        <Button disabled title="Event creation is not connected yet">
          <Plus className="h-4 w-4 mr-2" />
          Create Event
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Event Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="webinar">Webinars</SelectItem>
            <SelectItem value="meetup">Meetups</SelectItem>
            <SelectItem value="workshop">Workshops</SelectItem>
            <SelectItem value="conference">Conferences</SelectItem>
            <SelectItem value="networking">Networking</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex border rounded-lg">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('calendar')}
          >
            <CalendarDays className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          {error && (
            <Card className="mb-6 border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30">
              <CardContent className="p-4 text-sm text-red-700 dark:text-red-300">
                Events could not be loaded. Please try again shortly.
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Loading events...
              </CardContent>
            </Card>
          ) : viewMode === 'grid' && filteredEvents.length > 0 && (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredEvents.map(event => (
                <EventCard
                  key={event.id}
                  event={event}
                  onClick={() => handleEventClick(event)}
                  onSaveToggle={handleSaveToggle}
                />
              ))}
            </div>
          )}

          {!isLoading && viewMode === 'calendar' && (
            <CalendarView
              events={filteredEvents}
              onEventClick={handleEventClick}
            />
          )}

          {!isLoading && viewMode === 'list' && filteredEvents.length > 0 && (
            <Card>
              <CardContent className="divide-y p-0">
                {filteredEvents.map(event => (
                  <div
                    key={event.id}
                    className="flex items-center gap-4 p-4 hover:bg-muted cursor-pointer"
                    onClick={() => handleEventClick(event)}
                  >
                    <div className="text-center p-3 bg-primary/10 rounded-lg min-w-[60px]">
                      <p className="text-xs font-medium text-primary">
                        {event.date.toLocaleDateString('en', { month: 'short' })}
                      </p>
                      <p className="text-xl font-bold">
                        {event.date.getDate()}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate">{event.title}</h4>
                        <Badge className={cn('text-xs shrink-0', EVENT_TYPE_CONFIG[event.type].color)}>
                          {EVENT_TYPE_CONFIG[event.type].label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(event.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          {event.isOnline ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                          {event.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {event.attendees}
                        </span>
                      </div>
                    </div>
                    {event.rsvpStatus === 'going' && (
                      <Badge variant="secondary">
                        <Check className="h-3 w-3 mr-1" />
                        Going
                      </Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {!isLoading && filteredEvents.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium">No events found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting your filters or search query
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <UpcomingEventsSidebar
            events={events}
            onEventClick={handleEventClick}
            onSaveToggle={handleSaveToggle}
          />
        </div>
      </div>

      {/* Event Detail Dialog */}
      <EventDetailDialog
        event={selectedEvent}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onRSVPChange={handleRSVPChange}
        onSaveToggle={handleSaveToggle}
      />
    </div>
  );
}

export default EventsCalendar;
