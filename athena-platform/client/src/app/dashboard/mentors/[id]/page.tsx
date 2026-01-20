'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Star,
  Clock,
  Calendar,
  MapPin,
  Briefcase,
  MessageSquare,
  Video,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Users,
  Award,
  Globe,
  Linkedin,
  Twitter,
  ExternalLink,
} from 'lucide-react';
import { useMentor, useBookMentor } from '@/lib/hooks';
import { cn, formatCurrency } from '@/lib/utils';

interface TimeSlot {
  time: string;
  available: boolean;
}

export default function MentorDetailPage() {
  const params = useParams();
  const mentorId = params.id as string;
  const { data: mentor, isLoading } = useMentor(mentorId);
  const { mutate: bookSession, isPending: isBooking } = useBookMentor();

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [sessionType, setSessionType] = useState<'30' | '60'>('30');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [bookingStep, setBookingStep] = useState<'select' | 'confirm' | 'success'>('select');

  // Mock mentor data
  const mockMentor = {
    id: mentorId,
    name: 'Emily Rodriguez',
    title: 'VP of Product at InnovateTech',
    avatar: null,
    location: 'Sydney, Australia',
    timezone: 'AEST (UTC+10)',
    rating: 4.9,
    reviewCount: 127,
    sessionsCompleted: 342,
    responseTime: '< 2 hours',
    languages: ['English', 'Spanish'],
    specializations: ['Product Strategy', 'Career Transitions', 'Leadership', 'Startup Mentoring'],
    bio: `Hi! I'm Emily, a product leader with 12+ years of experience in tech. I've led product teams at Google, Canva, and now InnovateTech. I'm passionate about helping women break into and advance in product management.

I specialize in helping professionals:
• Transition into product management
• Navigate career growth and promotions
• Build leadership skills
• Launch successful products

I believe in practical, actionable advice backed by real-world experience. My mentees have gone on to roles at top companies including Meta, Stripe, and Atlassian.`,
    experience: [
      { role: 'VP of Product', company: 'InnovateTech', years: '2021 - Present' },
      { role: 'Senior Director of Product', company: 'Canva', years: '2018 - 2021' },
      { role: 'Product Manager', company: 'Google', years: '2014 - 2018' },
    ],
    pricing: {
      thirtyMin: 120,
      sixtyMin: 200,
    },
    availability: {
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
      slots: ['9:00 AM', '10:00 AM', '2:00 PM', '3:00 PM', '4:00 PM'],
    },
    reviews: [
      {
        id: '1',
        author: 'Sarah M.',
        rating: 5,
        date: '2 weeks ago',
        text: 'Emily is an incredible mentor! Her advice on preparing for product interviews was invaluable. I landed my dream job at a FAANG company!',
      },
      {
        id: '2',
        author: 'Jessica L.',
        rating: 5,
        date: '1 month ago',
        text: 'Very insightful session. Emily helped me clarify my career goals and gave me a concrete action plan.',
      },
    ],
  };

  const displayMentor = mentor || mockMentor;

  // Generate calendar days
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];

    // Add empty slots for days before the first day
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    // Add all days in the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const isDateAvailable = (date: Date) => {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    return displayMentor.availability?.days.includes(dayName) && date >= new Date();
  };

  const handleBookSession = () => {
    if (!selectedDate || !selectedTime) return;

    bookSession(
      {
        mentorId,
        date: selectedDate.toISOString(),
        time: selectedTime,
        duration: parseInt(sessionType),
      },
      {
        onSuccess: () => {
          setBookingStep('success');
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-96 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Back Button */}
      <Link
        href="/dashboard/mentors"
        className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Mentors
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Header */}
          <div className="card">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-32 h-32 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-4xl font-bold text-primary-600 flex-shrink-0">
                {displayMentor.name.charAt(0)}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {displayMentor.name}
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {displayMentor.title}
                </p>

                <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-gray-500 dark:text-gray-400">
                  <span className="flex items-center">
                    <Star className="w-4 h-4 text-yellow-500 mr-1" />
                    {displayMentor.rating} ({displayMentor.reviewCount} reviews)
                  </span>
                  <span className="flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {displayMentor.sessionsCompleted} sessions
                  </span>
                  <span className="flex items-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    {displayMentor.location}
                  </span>
                  <span className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    Responds {displayMentor.responseTime}
                  </span>
                </div>

                {/* Specializations */}
                <div className="flex flex-wrap gap-2 mt-4">
                  {displayMentor.specializations?.map((spec: string, i: number) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full text-sm"
                    >
                      {spec}
                    </span>
                  ))}
                </div>

                {/* Social Links */}
                <div className="flex items-center space-x-3 mt-4">
                  <button className="p-2 text-gray-400 hover:text-blue-500 transition">
                    <Linkedin className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-blue-400 transition">
                    <Twitter className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* About */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              About
            </h2>
            <div className="text-gray-600 dark:text-gray-300 whitespace-pre-line">
              {displayMentor.bio}
            </div>
          </div>

          {/* Experience */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Experience
            </h2>
            <div className="space-y-4">
              {displayMentor.experience?.map((exp: any, i: number) => (
                <div key={i} className="flex items-start space-x-4">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {exp.role}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {exp.company} • {exp.years}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reviews */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Reviews
              </h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {displayMentor.reviewCount} reviews
              </span>
            </div>
            <div className="space-y-4">
              {displayMentor.reviews?.map((review: any) => (
                <div
                  key={review.id}
                  className="border-t border-gray-100 dark:border-gray-700 pt-4 first:border-0 first:pt-0"
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-medium">
                      {review.author.charAt(0)}
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {review.author}
                    </span>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={cn(
                            'w-4 h-4',
                            star <= review.rating
                              ? 'text-yellow-500 fill-current'
                              : 'text-gray-300'
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {review.date}
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300">{review.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Booking Sidebar */}
        <div className="lg:col-span-1">
          <div className="card sticky top-6">
            {bookingStep === 'success' ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Session Booked!
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  You'll receive a confirmation email with the meeting details.
                </p>
                <button
                  onClick={() => setBookingStep('select')}
                  className="btn-outline w-full"
                >
                  Book Another Session
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Book a Session
                </h3>

                {/* Session Type */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Session Duration
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setSessionType('30')}
                      className={cn(
                        'p-3 rounded-lg border-2 text-center transition',
                        sessionType === '30'
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-700'
                      )}
                    >
                      <span className="block font-medium text-gray-900 dark:text-white">
                        30 min
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formatCurrency(displayMentor.pricing?.thirtyMin || 120)}
                      </span>
                    </button>
                    <button
                      onClick={() => setSessionType('60')}
                      className={cn(
                        'p-3 rounded-lg border-2 text-center transition',
                        sessionType === '60'
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-700'
                      )}
                    >
                      <span className="block font-medium text-gray-900 dark:text-white">
                        60 min
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formatCurrency(displayMentor.pricing?.sixtyMin || 200)}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Calendar */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Date
                  </label>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    {/* Month Navigation */}
                    <div className="flex items-center justify-between mb-3">
                      <button
                        onClick={() =>
                          setCurrentMonth(
                            new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
                          )
                        }
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {currentMonth.toLocaleDateString('en-US', {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                      <button
                        onClick={() =>
                          setCurrentMonth(
                            new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
                          )
                        }
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Day Headers */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                        <div
                          key={day}
                          className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1"
                        >
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 gap-1">
                      {getDaysInMonth(currentMonth).map((date, i) => {
                        if (!date) {
                          return <div key={i} className="p-2" />;
                        }
                        const available = isDateAvailable(date);
                        const isSelected =
                          selectedDate?.toDateString() === date.toDateString();

                        return (
                          <button
                            key={i}
                            onClick={() => available && setSelectedDate(date)}
                            disabled={!available}
                            className={cn(
                              'p-2 text-sm rounded-lg transition',
                              isSelected
                                ? 'bg-primary-500 text-white'
                                : available
                                ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                                : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                            )}
                          >
                            {date.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Time Slots */}
                {selectedDate && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Time ({displayMentor.timezone})
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {displayMentor.availability?.slots.map((slot: string) => (
                        <button
                          key={slot}
                          onClick={() => setSelectedTime(slot)}
                          className={cn(
                            'py-2 px-3 text-sm rounded-lg border transition',
                            selectedTime === slot
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          )}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Book Button */}
                <button
                  onClick={handleBookSession}
                  disabled={!selectedDate || !selectedTime || isBooking}
                  className="w-full btn-primary py-3 flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <Video className="w-5 h-5" />
                  <span>
                    {isBooking
                      ? 'Booking...'
                      : `Book ${sessionType} min - ${formatCurrency(
                          sessionType === '30'
                            ? displayMentor.pricing?.thirtyMin || 120
                            : displayMentor.pricing?.sixtyMin || 200
                        )}`}
                  </span>
                </button>

                {/* Alternative Contact */}
                <div className="mt-4 text-center">
                  <button className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center justify-center space-x-1">
                    <MessageSquare className="w-4 h-4" />
                    <span>Send a message first</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
