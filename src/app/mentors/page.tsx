import Link from 'next/link';
import Image from 'next/image';

export default function MentorsPage() {
  return (
    <div className="aura-container py-8">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <span className="text-indigo-600 font-semibold tracking-wider text-sm uppercase mb-2 block">Connect & Grow</span>
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Find Your Perfect Mentor</h1>
        <p className="text-slate-600 text-lg">
          Connect with experienced leaders who can guide you through your career and business journey.
        </p>
      </div>

      {/* Search/Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-lg mb-12 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1 w-full">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input type="text" placeholder="Search by name, industry, or skill..." className="w-full pl-10 pr-4 py-3 rounded-xl border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
        </div>
        <div className="w-full md:w-auto flex gap-2">
          <select className="px-4 py-3 rounded-xl border-slate-200 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-indigo-500 cursor-pointer">
            <option>All Industries</option>
            <option>Technology</option>
            <option>Finance</option>
            <option>Marketing</option>
          </select>
          <button className="aura-btn aura-btn-primary whitespace-nowrap">
            Find Mentors
          </button>
        </div>
      </div>

      {/* Mentors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Mentor Card 1 */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-xl transition-all duration-300 group">
          <div className="h-24 bg-gradient-to-r from-indigo-500 to-purple-500 relative">
            <div className="absolute -bottom-10 left-6">
              <div className="w-20 h-20 rounded-2xl border-4 border-white bg-slate-200 overflow-hidden">
                 {/* Placeholder for avatar */}
                 <div className="w-full h-full bg-slate-300 flex items-center justify-center text-2xl">👩‍💼</div>
              </div>
            </div>
          </div>
          <div className="pt-12 p-6">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-xl text-slate-900">Sarah Jenkins</h3>
                <p className="text-indigo-600 font-medium text-sm">CTO at TechFlow</p>
              </div>
              <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">Available</span>
            </div>
            <p className="text-slate-600 text-sm mb-4 line-clamp-2">
              Passionate about helping women break into tech leadership roles. 15+ years of experience in software engineering.
            </p>
            <div className="flex flex-wrap gap-2 mb-6">
              <span className="px-2 py-1 bg-slate-50 text-slate-600 text-xs rounded-md border border-slate-100">Leadership</span>
              <span className="px-2 py-1 bg-slate-50 text-slate-600 text-xs rounded-md border border-slate-100">Engineering</span>
              <span className="px-2 py-1 bg-slate-50 text-slate-600 text-xs rounded-md border border-slate-100">Scaling</span>
            </div>
            <div className="flex gap-3">
              <button className="flex-1 aura-btn aura-btn-outline text-sm py-2">View Profile</button>
              <button className="flex-1 aura-btn aura-btn-primary text-sm py-2">Connect</button>
            </div>
          </div>
        </div>

        {/* Mentor Card 2 */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-xl transition-all duration-300 group">
          <div className="h-24 bg-gradient-to-r from-pink-500 to-rose-500 relative">
            <div className="absolute -bottom-10 left-6">
              <div className="w-20 h-20 rounded-2xl border-4 border-white bg-slate-200 overflow-hidden">
                 <div className="w-full h-full bg-slate-300 flex items-center justify-center text-2xl">👩‍🎨</div>
              </div>
            </div>
          </div>
          <div className="pt-12 p-6">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-xl text-slate-900">Elena Rodriguez</h3>
                <p className="text-pink-600 font-medium text-sm">Founder at Creative Studio</p>
              </div>
              <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">Available</span>
            </div>
            <p className="text-slate-600 text-sm mb-4 line-clamp-2">
              I help creative entrepreneurs build sustainable businesses. Expert in branding and design strategy.
            </p>
            <div className="flex flex-wrap gap-2 mb-6">
              <span className="px-2 py-1 bg-slate-50 text-slate-600 text-xs rounded-md border border-slate-100">Branding</span>
              <span className="px-2 py-1 bg-slate-50 text-slate-600 text-xs rounded-md border border-slate-100">Design</span>
              <span className="px-2 py-1 bg-slate-50 text-slate-600 text-xs rounded-md border border-slate-100">Entrepreneurship</span>
            </div>
            <div className="flex gap-3">
              <button className="flex-1 aura-btn aura-btn-outline text-sm py-2">View Profile</button>
              <button className="flex-1 aura-btn aura-btn-primary text-sm py-2">Connect</button>
            </div>
          </div>
        </div>

        {/* Mentor Card 3 */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-xl transition-all duration-300 group">
          <div className="h-24 bg-gradient-to-r from-blue-500 to-cyan-500 relative">
            <div className="absolute -bottom-10 left-6">
              <div className="w-20 h-20 rounded-2xl border-4 border-white bg-slate-200 overflow-hidden">
                 <div className="w-full h-full bg-slate-300 flex items-center justify-center text-2xl">👩‍🔬</div>
              </div>
            </div>
          </div>
          <div className="pt-12 p-6">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-xl text-slate-900">Dr. Emily Chen</h3>
                <p className="text-blue-600 font-medium text-sm">Data Scientist at GlobalData</p>
              </div>
              <span className="bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-1 rounded-full">Busy</span>
            </div>
            <p className="text-slate-600 text-sm mb-4 line-clamp-2">
              Specializing in AI and Machine Learning. Happy to mentor students and career switchers.
            </p>
            <div className="flex flex-wrap gap-2 mb-6">
              <span className="px-2 py-1 bg-slate-50 text-slate-600 text-xs rounded-md border border-slate-100">Data Science</span>
              <span className="px-2 py-1 bg-slate-50 text-slate-600 text-xs rounded-md border border-slate-100">AI</span>
              <span className="px-2 py-1 bg-slate-50 text-slate-600 text-xs rounded-md border border-slate-100">Career Advice</span>
            </div>
            <div className="flex gap-3">
              <button className="flex-1 aura-btn aura-btn-outline text-sm py-2">View Profile</button>
              <button className="flex-1 aura-btn aura-btn-primary text-sm py-2" disabled>Connect</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
