import Link from 'next/link';

export default function EventsPage() {
  return (
    <div className="aura-container py-8">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Upcoming Events</h1>
          <p className="text-slate-600">Join workshops, webinars, and meetups.</p>
        </div>
        <div className="hidden md:block">
          <button className="aura-btn aura-btn-outline">View Calendar</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Featured Event */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-lg relative group">
            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-lg text-sm font-bold text-indigo-600 z-10">
              Featured
            </div>
            <div className="h-64 bg-slate-200 relative">
               {/* Placeholder for event image */}
               <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-purple-900 flex items-center justify-center text-white/20 text-6xl font-bold">
                  EVENT
               </div>
            </div>
            <div className="p-8">
              <div className="flex gap-4 text-sm text-slate-500 mb-3">
                <span className="flex items-center gap-1">📅 Dec 15, 2025</span>
                <span className="flex items-center gap-1">⏰ 2:00 PM EST</span>
                <span className="flex items-center gap-1">📍 Virtual</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3 group-hover:text-indigo-600 transition-colors">
                Women in Tech Summit 2025
              </h2>
              <p className="text-slate-600 mb-6">
                Join over 500 women in technology for a day of inspiring talks, networking, and workshops. Keynote speakers include industry leaders from top tech companies.
              </p>
              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full bg-slate-300 border-2 border-white"></div>
                  <div className="w-8 h-8 rounded-full bg-slate-400 border-2 border-white"></div>
                  <div className="w-8 h-8 rounded-full bg-slate-500 border-2 border-white"></div>
                  <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-xs font-bold text-slate-600">+120</div>
                </div>
                <button className="aura-btn aura-btn-primary">Register Now</button>
              </div>
            </div>
          </div>
        </div>

        {/* Side List */}
        <div className="space-y-6">
          <h3 className="font-bold text-lg text-slate-900">This Week</h3>
          
          {/* Event Item */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-colors cursor-pointer">
            <div className="flex gap-4">
              <div className="w-16 h-16 rounded-xl bg-indigo-50 flex flex-col items-center justify-center text-indigo-600 shrink-0">
                <span className="text-xs font-bold uppercase">Dec</span>
                <span className="text-xl font-bold">12</span>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 mb-1">Founder's Coffee Chat</h4>
                <p className="text-xs text-slate-500 mb-2">10:00 AM • Virtual</p>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md">Networking</span>
              </div>
            </div>
          </div>

          {/* Event Item */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-colors cursor-pointer">
            <div className="flex gap-4">
              <div className="w-16 h-16 rounded-xl bg-pink-50 flex flex-col items-center justify-center text-pink-600 shrink-0">
                <span className="text-xs font-bold uppercase">Dec</span>
                <span className="text-xl font-bold">14</span>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 mb-1">Funding Your Startup</h4>
                <p className="text-xs text-slate-500 mb-2">1:00 PM • Workshop</p>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md">Finance</span>
              </div>
            </div>
          </div>

           {/* Event Item */}
           <div className="bg-white p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-colors cursor-pointer">
            <div className="flex gap-4">
              <div className="w-16 h-16 rounded-xl bg-green-50 flex flex-col items-center justify-center text-green-600 shrink-0">
                <span className="text-xs font-bold uppercase">Dec</span>
                <span className="text-xl font-bold">18</span>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 mb-1">Wellness for Leaders</h4>
                <p className="text-xs text-slate-500 mb-2">4:00 PM • Webinar</p>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md">Health</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
