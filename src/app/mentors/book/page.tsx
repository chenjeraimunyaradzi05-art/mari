'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function MentorBookingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const mentor = {
    name: "Jessica Williams",
    role: "CEO at Athena",
    avatar: "bg-purple-200 text-purple-700",
    rate: "$150/session"
  };

  const availableDates = [
    { day: "Mon", date: "12", full: "2025-12-12" },
    { day: "Tue", date: "13", full: "2025-12-13" },
    { day: "Wed", date: "14", full: "2025-12-14" },
    { day: "Thu", date: "15", full: "2025-12-15" },
    { day: "Fri", date: "16", full: "2025-12-16" },
  ];

  const availableTimes = [
    "09:00 AM", "10:00 AM", "02:00 PM", "03:30 PM", "05:00 PM"
  ];

  const handleBooking = () => {
    // Logic to submit booking
    alert("Booking confirmed!");
    router.push('/dashboard');
  };

  return (
    <div className="aura-container py-12">
      <div className="max-w-2xl mx-auto">
        <Link href="/mentors" className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-indigo-600 mb-8">
          ← Back to Mentors
        </Link>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-slate-900 p-8 text-white">
            <div className="flex items-center gap-6">
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold ${mentor.avatar}`}>
                {mentor.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-2xl font-bold mb-1">Book a Session with {mentor.name}</h1>
                <p className="text-indigo-200">{mentor.role}</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            {/* Progress Steps */}
            <div className="flex items-center justify-between mb-10 relative">
              <div className="absolute left-0 top-1/2 w-full h-1 bg-slate-100 -z-10"></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>1</div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>2</div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 3 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>3</div>
            </div>

            {step === 1 && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-4">Select a Date</h2>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {availableDates.map((d) => (
                      <button
                        key={d.full}
                        onClick={() => setSelectedDate(d.full)}
                        className={`flex-shrink-0 w-20 h-24 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${selectedDate === d.full ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 hover:border-indigo-200 text-slate-600'}`}
                      >
                        <span className="text-xs font-bold uppercase">{d.day}</span>
                        <span className="text-2xl font-bold">{d.date}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedDate && (
                  <div className="animate-fade-in">
                    <h2 className="text-xl font-bold text-slate-900 mb-4">Select a Time</h2>
                    <div className="grid grid-cols-3 gap-3">
                      {availableTimes.map((time) => (
                        <button
                          key={time}
                          onClick={() => setSelectedTime(time)}
                          className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${selectedTime === time ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-100 hover:border-indigo-200 text-slate-600'}`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-6 flex justify-end">
                  <button 
                    onClick={() => setStep(2)} 
                    disabled={!selectedDate || !selectedTime}
                    className="aura-btn aura-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-slate-900">Session Details</h2>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Topic of Discussion</label>
                  <select className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500">
                    <option>Career Guidance</option>
                    <option>Technical Interview Prep</option>
                    <option>Leadership Advice</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Message to Mentor (Optional)</label>
                  <textarea rows={4} className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500" placeholder="Share any specific questions or context..."></textarea>
                </div>
                <div className="pt-6 flex justify-between">
                  <button onClick={() => setStep(1)} className="text-slate-500 font-bold hover:text-slate-800">Back</button>
                  <button onClick={() => setStep(3)} className="aura-btn aura-btn-primary">Review Booking</button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-slate-900">Confirm Booking</h2>
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mentor</span>
                    <span className="font-bold text-slate-900">{mentor.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Date & Time</span>
                    <span className="font-bold text-slate-900">{selectedDate}, {selectedTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Session Type</span>
                    <span className="font-bold text-slate-900">Video Call (45 mins)</span>
                  </div>
                  <div className="border-t border-slate-200 pt-4 flex justify-between items-center">
                    <span className="text-slate-900 font-bold">Total</span>
                    <span className="text-2xl font-bold text-indigo-600">{mentor.rate}</span>
                  </div>
                </div>
                <div className="pt-6 flex justify-between">
                  <button onClick={() => setStep(2)} className="text-slate-500 font-bold hover:text-slate-800">Back</button>
                  <button onClick={handleBooking} className="aura-btn aura-btn-primary w-full ml-4">Confirm & Pay</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
