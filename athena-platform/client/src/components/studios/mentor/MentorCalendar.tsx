'use client';

/**
 * Mentor Dashboard Calendar
 * Phase 4: Web Client - Persona Studios
 * Step 64: Comprehensive calendar view for mentors
 * 
 * Features:
 * - Monthly/Weekly/Daily views
 * - Availability management
 * - Session booking display
 * - Drag-and-drop rescheduling
 * - Time zone support
 */

import React, { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Video,
  Phone,
  MessageSquare,
  User,
  DollarSign,
  Settings,
  Filter,
  MoreHorizontal,
  Check,
  X,
  MapPin,
  Globe,
  Repeat,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

// ============================================
// TYPES
// ============================================

type ViewMode = 'month' | 'week' | 'day';
type SessionType = 'video' | 'audio' | 'chat';
type SessionStatus = 'confirmed' | 'pending' | 'completed' | 'cancelled';

interface Session {
  id: string;
  menteeId: string;
  menteeName: string;
  menteeAvatar?: string;
  date: Date;
  startTime: string;
  endTime: string;
  duration: number; // minutes
  type: SessionType;
  status: SessionStatus;
  topic: string;
  price: number;
  notes?: string;
  recurring?: boolean;
}

interface AvailabilitySlot {
  id: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface MentorCalendarProps {
  className?: string;
}

// ============================================
// HELPERS
// ============================================

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SESSION_TYPE_CONFIG: Record<SessionType, { icon: React.ElementType; color: string }> = {
  video: { icon: Video, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  audio: { icon: Phone, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  chat: { icon: MessageSquare, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
};

const STATUS_CONFIG: Record<SessionStatus, { label: string; color: string }> = {
  confirmed: { label: 'Confirmed', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  completed: { label: 'Completed', color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDay = firstDay.getDay();

  const days: (Date | null)[] = [];
  
  // Previous month days
  for (let i = 0; i < startingDay; i++) {
    days.push(null);
  }
  
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }

  // Next month days to fill grid
  while (days.length < 42) {
    days.push(null);
  }

  return days;
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function getWeekDays(date: Date): Date[] {
  const days: Date[] = [];
  const day = date.getDay();
  const diff = date.getDate() - day;
  
  for (let i = 0; i < 7; i++) {
    days.push(new Date(date.getFullYear(), date.getMonth(), diff + i));
  }
  
  return days;
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_SESSIONS: Session[] = [
  {
    id: '1',
    menteeId: 'u1',
    menteeName: 'Alex Thompson',
    menteeAvatar: '/avatars/alex.jpg',
    date: new Date(2026, 0, 20),
    startTime: '09:00',
    endTime: '10:00',
    duration: 60,
    type: 'video',
    status: 'confirmed',
    topic: 'Career Transition Strategy',
    price: 150,
  },
  {
    id: '2',
    menteeId: 'u2',
    menteeName: 'Jordan Lee',
    menteeAvatar: '/avatars/jordan.jpg',
    date: new Date(2026, 0, 20),
    startTime: '14:00',
    endTime: '14:30',
    duration: 30,
    type: 'audio',
    status: 'pending',
    topic: 'Resume Review',
    price: 75,
  },
  {
    id: '3',
    menteeId: 'u3',
    menteeName: 'Sam Rivera',
    date: new Date(2026, 0, 21),
    startTime: '11:00',
    endTime: '12:00',
    duration: 60,
    type: 'video',
    status: 'confirmed',
    topic: 'Technical Interview Prep',
    price: 150,
    recurring: true,
  },
  {
    id: '4',
    menteeId: 'u4',
    menteeName: 'Casey Morgan',
    date: new Date(2026, 0, 22),
    startTime: '16:00',
    endTime: '16:30',
    duration: 30,
    type: 'chat',
    status: 'confirmed',
    topic: 'Quick Q&A',
    price: 50,
  },
];

const MOCK_AVAILABILITY: AvailabilitySlot[] = [
  { id: '1', dayOfWeek: 1, startTime: '09:00', endTime: '12:00', isActive: true },
  { id: '2', dayOfWeek: 1, startTime: '14:00', endTime: '18:00', isActive: true },
  { id: '3', dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isActive: true },
  { id: '4', dayOfWeek: 3, startTime: '09:00', endTime: '12:00', isActive: true },
  { id: '5', dayOfWeek: 4, startTime: '14:00', endTime: '18:00', isActive: true },
  { id: '6', dayOfWeek: 5, startTime: '09:00', endTime: '12:00', isActive: true },
];

const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, '0');
  return `${hour}:00`;
});

// ============================================
// COMPONENTS
// ============================================

function SessionCard({ session, compact = false }: { session: Session; compact?: boolean }) {
  const typeConfig = SESSION_TYPE_CONFIG[session.type];
  const statusConfig = STATUS_CONFIG[session.status];
  const TypeIcon = typeConfig.icon;

  if (compact) {
    return (
      <div className={cn(
        'px-2 py-1 rounded text-xs truncate cursor-pointer hover:opacity-80',
        typeConfig.color
      )}>
        <span className="font-medium">{formatTime(session.startTime)}</span>
        {' '}{session.menteeName.split(' ')[0]}
      </div>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className={cn(
          'p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow',
          'bg-card'
        )}>
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={cn('p-1.5 rounded', typeConfig.color)}>
                <TypeIcon className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-sm">{session.topic}</p>
                <p className="text-xs text-muted-foreground">
                  {formatTime(session.startTime)} - {formatTime(session.endTime)}
                </p>
              </div>
            </div>
            <Badge className={cn('text-xs', statusConfig.color)}>
              {statusConfig.label}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={session.menteeAvatar} alt={session.menteeName} />
              <AvatarFallback className="text-xs">
                {session.menteeName.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm">{session.menteeName}</span>
            {session.recurring && (
              <Repeat className="h-3 w-3 text-muted-foreground ml-auto" />
            )}
          </div>
        </div>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{session.topic}</DialogTitle>
          <DialogDescription>
            {session.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={session.menteeAvatar} alt={session.menteeName} />
              <AvatarFallback>{session.menteeName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{session.menteeName}</p>
              <p className="text-sm text-muted-foreground">Mentee</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{formatTime(session.startTime)} - {formatTime(session.endTime)}</span>
            </div>
            <div className="flex items-center gap-2">
              <TypeIcon className="h-4 w-4 text-muted-foreground" />
              <span className="capitalize">{session.type} Call</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span>${session.price}</span>
            </div>
            <div>
              <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
            </div>
          </div>

          {session.recurring && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Repeat className="h-4 w-4" />
              <span>This is a recurring session</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {session.status === 'pending' && (
            <>
              <Button variant="outline">
                <X className="h-4 w-4 mr-2" />
                Decline
              </Button>
              <Button>
                <Check className="h-4 w-4 mr-2" />
                Accept
              </Button>
            </>
          )}
          {session.status === 'confirmed' && (
            <>
              <Button variant="outline">Reschedule</Button>
              <Button>
                <Video className="h-4 w-4 mr-2" />
                Start Session
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MonthView({
  currentDate,
  sessions,
}: {
  currentDate: Date;
  sessions: Session[];
}) {
  const calendarDays = useMemo(
    () => getCalendarDays(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate]
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getSessionsForDate = (date: Date | null) => {
    if (!date) return [];
    return sessions.filter(
      (s) => s.date.toDateString() === date.toDateString()
    );
  };

  return (
    <div className="grid grid-cols-7 gap-px bg-zinc-200 dark:bg-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      {DAYS_SHORT.map((day) => (
        <div
          key={day}
          className="bg-zinc-100 dark:bg-zinc-900 p-2 text-center text-sm font-medium"
        >
          {day}
        </div>
      ))}

      {/* Days */}
      {calendarDays.map((date, i) => {
        const daySessions = getSessionsForDate(date);
        const isToday = date && date.toDateString() === today.toDateString();
        const isCurrentMonth = date && date.getMonth() === currentDate.getMonth();

        return (
          <div
            key={i}
            className={cn(
              'bg-white dark:bg-zinc-950 min-h-[100px] p-2',
              !isCurrentMonth && 'opacity-50'
            )}
          >
            {date && (
              <>
                <div className={cn(
                  'text-sm mb-1',
                  isToday && 'font-bold text-emerald-600 dark:text-emerald-400'
                )}>
                  {date.getDate()}
                </div>
                <div className="space-y-1">
                  {daySessions.slice(0, 2).map((session) => (
                    <SessionCard key={session.id} session={session} compact />
                  ))}
                  {daySessions.length > 2 && (
                    <p className="text-xs text-muted-foreground">
                      +{daySessions.length - 2} more
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WeekView({
  currentDate,
  sessions,
}: {
  currentDate: Date;
  sessions: Session[];
}) {
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getSessionsForDate = (date: Date) => {
    return sessions.filter(
      (s) => s.date.toDateString() === date.toDateString()
    );
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Header */}
        <div className="grid grid-cols-8 border-b">
          <div className="p-2" /> {/* Time column */}
          {weekDays.map((date) => {
            const isToday = date.toDateString() === today.toDateString();
            return (
              <div
                key={date.toISOString()}
                className={cn(
                  'p-2 text-center border-l',
                  isToday && 'bg-emerald-50 dark:bg-emerald-950'
                )}
              >
                <p className="text-sm text-muted-foreground">{DAYS_SHORT[date.getDay()]}</p>
                <p className={cn(
                  'text-lg font-semibold',
                  isToday && 'text-emerald-600 dark:text-emerald-400'
                )}>
                  {date.getDate()}
                </p>
              </div>
            );
          })}
        </div>

        {/* Time slots */}
        <div className="relative">
          {TIME_SLOTS.filter((_, i) => i >= 8 && i <= 20).map((time) => (
            <div key={time} className="grid grid-cols-8 h-16 border-b">
              <div className="p-2 text-xs text-muted-foreground">
                {formatTime(time)}
              </div>
              {weekDays.map((date) => {
                const daySessions = getSessionsForDate(date).filter(
                  (s) => s.startTime.startsWith(time.split(':')[0])
                );
                return (
                  <div key={date.toISOString()} className="border-l p-1">
                    {daySessions.map((session) => (
                      <SessionCard key={session.id} session={session} compact />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DayView({
  currentDate,
  sessions,
}: {
  currentDate: Date;
  sessions: Session[];
}) {
  const daySessions = sessions.filter(
    (s) => s.date.toDateString() === currentDate.toDateString()
  );

  return (
    <div className="space-y-4">
      <div className="text-center py-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
        <p className="text-lg font-semibold">
          {currentDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
        <p className="text-sm text-muted-foreground">
          {daySessions.length} session{daySessions.length !== 1 ? 's' : ''} scheduled
        </p>
      </div>

      {daySessions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No sessions scheduled for this day</p>
        </div>
      ) : (
        <div className="space-y-3">
          {daySessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}

function AvailabilitySettings({
  availability,
  onUpdate,
}: {
  availability: AvailabilitySlot[];
  onUpdate: (slots: AvailabilitySlot[]) => void;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Settings className="h-4 w-4 mr-2" />
          Availability
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Manage Availability</SheetTitle>
          <SheetDescription>
            Set your weekly availability for mentorship sessions
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {DAYS.map((day, dayIndex) => {
            const slots = availability.filter((s) => s.dayOfWeek === dayIndex);
            
            return (
              <div key={day} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">{day}</Label>
                  <Switch
                    checked={slots.some((s) => s.isActive)}
                    onCheckedChange={(checked) => {
                      // Toggle all slots for this day
                    }}
                  />
                </div>
                
                {slots.filter(s => s.isActive).map((slot) => (
                  <div key={slot.id} className="flex items-center gap-2 pl-4">
                    <Select value={slot.startTime}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_SLOTS.map((time) => (
                          <SelectItem key={time} value={time}>
                            {formatTime(time)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span>to</span>
                    <Select value={slot.endTime}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_SLOTS.map((time) => (
                          <SelectItem key={time} value={time}>
                            {formatTime(time)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {slots.some(s => s.isActive) && (
                  <Button variant="ghost" size="sm" className="ml-4">
                    <Plus className="h-3 w-3 mr-1" />
                    Add slot
                  </Button>
                )}
              </div>
            );
          })}

          <Separator />

          <div className="space-y-3">
            <Label>Timezone</Label>
            <Select defaultValue="america/los_angeles">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="america/los_angeles">Pacific Time (PT)</SelectItem>
                <SelectItem value="america/denver">Mountain Time (MT)</SelectItem>
                <SelectItem value="america/chicago">Central Time (CT)</SelectItem>
                <SelectItem value="america/new_york">Eastern Time (ET)</SelectItem>
                <SelectItem value="europe/london">London (GMT)</SelectItem>
                <SelectItem value="asia/tokyo">Tokyo (JST)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full">Save Availability</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function MentorCalendar({ className }: MentorCalendarProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 19)); // Jan 19, 2026
  const [sessions] = useState<Session[]>(MOCK_SESSIONS);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>(MOCK_AVAILABILITY);

  const navigateDate = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (viewMode === 'month') {
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
      } else if (viewMode === 'week') {
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
      } else {
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getHeaderTitle = () => {
    if (viewMode === 'month') {
      return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    } else if (viewMode === 'week') {
      const weekDays = getWeekDays(currentDate);
      const start = weekDays[0];
      const end = weekDays[6];
      if (start.getMonth() === end.getMonth()) {
        return `${MONTHS[start.getMonth()]} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
      }
      return `${MONTHS[start.getMonth()]} ${start.getDate()} - ${MONTHS[end.getMonth()]} ${end.getDate()}, ${start.getFullYear()}`;
    }
    return currentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const upcomingSessions = sessions.filter(
    (s) => s.date >= new Date() && s.status !== 'cancelled'
  ).slice(0, 5);

  const pendingCount = sessions.filter((s) => s.status === 'pending').length;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="text-muted-foreground">Manage your mentorship schedule</p>
        </div>
        <div className="flex items-center gap-2">
          <AvailabilitySettings
            availability={availability}
            onUpdate={setAvailability}
          />
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Block Time
          </Button>
        </div>
      </div>

      {/* Stats */}
      {pendingCount > 0 && (
        <Card className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900">
              <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-yellow-900 dark:text-yellow-100">
                {pendingCount} Pending Request{pendingCount !== 1 ? 's' : ''}
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Review and respond to booking requests
              </p>
            </div>
            <Button variant="outline" size="sm">
              View Requests
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Main Calendar */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => navigateDate('prev')}>
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <h2 className="text-lg font-semibold min-w-[200px] text-center">
                      {getHeaderTitle()}
                    </h2>
                    <Button variant="ghost" size="icon" onClick={() => navigateDate('next')}>
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" onClick={goToToday}>
                    Today
                  </Button>
                </div>

                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                  <TabsList>
                    <TabsTrigger value="month">Month</TabsTrigger>
                    <TabsTrigger value="week">Week</TabsTrigger>
                    <TabsTrigger value="day">Day</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {viewMode === 'month' && (
                <MonthView currentDate={currentDate} sessions={sessions} />
              )}
              {viewMode === 'week' && (
                <WeekView currentDate={currentDate} sessions={sessions} />
              )}
              {viewMode === 'day' && (
                <DayView currentDate={currentDate} sessions={sessions} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upcoming Sessions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upcoming Sessions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No upcoming sessions
                </p>
              ) : (
                upcomingSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 cursor-pointer"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={session.menteeAvatar} alt={session.menteeName} />
                      <AvatarFallback className="text-xs">
                        {session.menteeName.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{session.menteeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {session.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {' • '}
                        {formatTime(session.startTime)}
                      </p>
                    </div>
                    <Badge className={cn('text-xs', STATUS_CONFIG[session.status].color)}>
                      {STATUS_CONFIG[session.status].label}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">This Month</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Sessions</span>
                <span className="font-semibold">{sessions.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Hours</span>
                <span className="font-semibold">
                  {sessions.reduce((sum, s) => sum + s.duration, 0) / 60}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Revenue</span>
                <span className="font-semibold text-emerald-600">
                  ${sessions.reduce((sum, s) => sum + s.price, 0)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Timezone */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Globe className="h-4 w-4" />
                <span>Pacific Time (PT) UTC-8</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default MentorCalendar;
