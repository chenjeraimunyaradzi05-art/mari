import Link from 'next/link';
import { 
  Search, 
  Menu, 
  ChevronDown, 
  Sparkles, 
  Bot, 
  FileText, 
  TrendingUp, 
  Network, 
  Heart, 
  Coffee, 
  Users, 
  Award, 
  HelpCircle, 
  Grid, 
  Activity, 
  Briefcase, 
  Home, 
  Car, 
  Wallet, 
  Rocket, 
  GraduationCap, 
  BookOpen, 
  BarChart, 
  Newspaper, 
  Headphones, 
  Info, 
  Tag, 
  Mail, 
  ShieldCheck,
  LayoutDashboard,
  Building2,
  Landmark
} from 'lucide-react';
import { ModeToggle } from '@/components/ui/mode-toggle';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 flex flex-col backdrop-blur-xl border-b border-white/60 shadow-[0_4px_20px_rgba(168,85,247,0.08)] bg-linear-to-r from-rose-50/95 via-white/98 to-purple-50/95 dark:from-slate-900/95 dark:via-slate-900/98 dark:to-slate-900/95 dark:border-slate-800 font-sans">
      
      {/* Top Row: Logo, Search, Auth */}
      <div className="h-12 flex items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            {/* Logo placeholder */}
            <div className="w-9 h-9 bg-linear-to-br from-rose-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md group-hover:brightness-90 transition-all">
              A
            </div>
                        <span className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight group-hover:text-purple-900 dark:group-hover:text-purple-400 transition-colors">ATHENA</span>
          </Link>
          
          {/* Wallet Link */}
          <Link href="/social/wallet" className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium">
            <Wallet className="w-4 h-4 text-pink-600" />
            <span>Wallet</span>
          </Link>
        </div>

        {/* Search Bar */}
          <form className="hidden xl:flex relative group ml-4">
            <input 
              type="text" 
              placeholder="Search..." 
              className="w-48 pl-9 pr-3 py-1.5 text-xs font-medium text-slate-700 placeholder:text-slate-500 bg-white/50 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 focus:w-64 transition-all"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-purple-500 transition-colors" />
          </form>

        {/* Main Navigation */}
        <nav className="hidden lg:flex items-center gap-1 h-full mx-4">
          
          {/* Athena AI Dropdown */}
          <div className="relative group h-full flex items-center">
            <button className="flex items-center gap-1.5 h-8 px-2.5 text-xs font-bold text-purple-700 bg-purple-100 border border-purple-300 hover:bg-purple-200 rounded-lg transition-all">
              <Sparkles className="w-3.5 h-3.5" />
              Athena AI
              <ChevronDown className="w-3 h-3 opacity-50 group-hover:rotate-180 transition-transform duration-300" />
            </button>
            <div className="absolute top-[calc(100%-5px)] left-0 w-64 p-2 bg-white/95 backdrop-blur-xl border border-white/80 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 z-50">
              <div className="space-y-1">
                <Link href="/ai/concierge" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-purple-50 transition-colors group/item">
                  <Bot className="w-5 h-5 text-slate-400 group-hover/item:text-purple-600 transition-colors" />
                  <span className="font-semibold text-purple-700">AI Concierge</span>
                </Link>
                <Link href="/ai/resume-parser" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-purple-50 transition-colors group/item">
                  <FileText className="w-5 h-5 text-slate-400 group-hover/item:text-purple-600 transition-colors" />
                  <span className="font-semibold text-purple-700">Resume Parser</span>
                </Link>
                <Link href="/ai/career-insights" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-purple-50 transition-colors group/item">
                  <TrendingUp className="w-5 h-5 text-slate-400 group-hover/item:text-purple-600 transition-colors" />
                  <span className="font-semibold text-purple-700">Career Insights</span>
                </Link>
                <Link href="/ai/job-match" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-purple-50 transition-colors group/item">
                  <Network className="w-5 h-5 text-slate-400 group-hover/item:text-purple-600 transition-colors" />
                  <span className="font-semibold text-purple-700">Job Match</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Athena Social Dropdown */}
          <div className="relative group h-full flex items-center">
            <button className="flex items-center gap-1.5 h-8 px-2.5 text-xs font-bold text-purple-700 bg-purple-100 border border-purple-300 hover:bg-purple-200 rounded-lg transition-all">
              <Heart className="w-3.5 h-3.5" />
              Athena Social
              <ChevronDown className="w-3 h-3 opacity-50 group-hover:rotate-180 transition-transform duration-300" />
            </button>
            <div className="absolute top-[calc(100%-5px)] left-0 w-64 p-2 bg-white/95 backdrop-blur-xl border border-white/80 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 z-50">
              <div className="space-y-1">
                <Link href="/social/lounge" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-purple-50 transition-colors group/item">
                  <Coffee className="w-5 h-5 text-slate-400 group-hover/item:text-purple-600 transition-colors" />
                  <span className="font-semibold text-purple-600">Athena Lounge</span>
                </Link>
                <Link href="/social/feed" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-purple-50 transition-colors group/item">
                  <Users className="w-5 h-5 text-slate-400 group-hover/item:text-purple-600 transition-colors" />
                  <span className="font-semibold text-purple-600">Social Feed</span>
                </Link>
                <Link href="/social/groups" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-purple-50 transition-colors group/item">
                  <Users className="w-5 h-5 text-slate-400 group-hover/item:text-purple-600 transition-colors" />
                  <span className="font-semibold text-purple-600">Groups & Circles</span>
                </Link>
                <Link href="/social/mentorship" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-purple-50 transition-colors group/item">
                  <Award className="w-5 h-5 text-slate-400 group-hover/item:text-purple-600 transition-colors" />
                  <span className="font-semibold text-purple-600">Mentorship</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Platform Dropdown */}
          <div className="relative group h-full flex items-center">
            <button className="flex items-center gap-1.5 h-8 px-2.5 text-xs font-bold text-purple-700 bg-purple-100 border border-purple-300 hover:bg-purple-200 rounded-lg transition-all">
              Platform
              <ChevronDown className="w-3 h-3 opacity-50 group-hover:rotate-180 transition-transform duration-300" />
            </button>
            <div className="absolute top-[calc(100%-5px)] left-0 w-64 p-2 bg-white/95 backdrop-blur-xl border border-white/80 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 z-50">
              <div className="space-y-1">
                <Link href="/platform/how-it-works" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-purple-50 transition-colors group/item">
                  <HelpCircle className="w-5 h-5 text-slate-400 group-hover/item:text-purple-600 transition-colors" />
                  <span className="font-semibold text-purple-600">How it works</span>
                </Link>
                <Link href="/platform/modules" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-purple-50 transition-colors group/item">
                  <Grid className="w-5 h-5 text-slate-400 group-hover/item:text-purple-600 transition-colors" />
                  <span className="font-semibold text-purple-600">Modules</span>
                </Link>
                <Link href="/platform/impact" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-purple-50 transition-colors group/item">
                  <Activity className="w-5 h-5 text-slate-400 group-hover/item:text-purple-600 transition-colors" />
                  <span className="font-semibold text-purple-600">Impact Index</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Ecosystems Dropdown */}
          <div className="relative group h-full flex items-center">
            <button className="flex items-center gap-1.5 h-8 px-2.5 text-xs font-bold text-purple-700 bg-purple-100 border border-purple-300 hover:bg-purple-200 rounded-lg transition-all">
              Ecosystems
              <ChevronDown className="w-3 h-3 opacity-50 group-hover:rotate-180 transition-transform duration-300" />
            </button>
            <div className="absolute top-[calc(100%-5px)] left-0 w-72 p-2 bg-white/95 backdrop-blur-xl border border-white/80 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 z-50">
              <div className="space-y-1">
                <Link href="/jobs" className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-purple-50 transition-colors group/item">
                  <Briefcase className="w-5 h-5 text-slate-400 group-hover/item:text-purple-600 transition-colors" />
                  <span className="font-semibold text-purple-600">Jobs & Careers</span>
                </Link>
                <Link href="/housing" className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-purple-50 transition-colors group/item">
                  <Home className="w-5 h-5 text-slate-400 group-hover/item:text-purple-600 transition-colors" />
                  <span className="font-semibold text-purple-600">Housing & Mortgages</span>
                </Link>
                <Link href="/automotive" className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-purple-50 transition-colors group/item">
                  <Car className="w-5 h-5 text-slate-400 group-hover/item:text-purple-600 transition-colors" />
                  <span className="font-semibold text-purple-600">Automotive & Mobility</span>
                </Link>
                <Link href="/money" className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-purple-50 transition-colors group/item">
                  <Wallet className="w-5 h-5 text-slate-400 group-hover/item:text-purple-600 transition-colors" />
                  <span className="font-semibold text-purple-600">Money & Finance</span>
                </Link>
                <Link href="/business" className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-purple-50 transition-colors group/item">
                  <Rocket className="w-5 h-5 text-slate-400 group-hover/item:text-purple-600 transition-colors" />
                  <span className="font-semibold text-purple-600">Business & Grants</span>
                </Link>
                <Link href="/wellness" className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-purple-50 transition-colors group/item">
                  <Heart className="w-5 h-5 text-slate-400 group-hover/item:text-purple-600 transition-colors" />
                  <span className="font-semibold text-purple-600">Wellness Hub</span>
                </Link>
                <Link href="/education" className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-purple-50 transition-colors group/item">
                  <GraduationCap className="w-5 h-5 text-slate-400 group-hover/item:text-purple-600 transition-colors" />
                  <span className="font-semibold text-purple-600">Education & TAFE</span>
                </Link>
                <Link href="/government" className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-purple-50 transition-colors group/item">
                  <Landmark className="w-5 h-5 text-slate-400 group-hover/item:text-purple-600 transition-colors" />
                  <span className="font-semibold text-purple-600">Government & Public Sector</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Resources Dropdown */}
          <div className="relative group h-full flex items-center">
            <button className="flex items-center gap-1.5 h-8 px-2.5 text-xs font-bold text-purple-700 bg-purple-100 border border-purple-300 hover:bg-purple-200 rounded-lg transition-all">
              Resources
              <ChevronDown className="w-3 h-3 opacity-50 group-hover:rotate-180 transition-transform duration-300" />
            </button>
            <div className="absolute top-[calc(100%-5px)] left-0 w-64 p-2 bg-white/95 backdrop-blur-xl border border-white/80 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 z-50">
              <div className="space-y-1">
                <Link href="/resources/guides" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-purple-50 transition-colors group/item">
                  <BookOpen className="w-5 h-5 text-slate-400 group-hover/item:text-purple-600 transition-colors" />
                  <span className="font-semibold text-purple-600">Guides & Playbooks</span>
                </Link>
                <Link href="/resources/research" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-purple-50 transition-colors group/item">
                  <BarChart className="w-5 h-5 text-slate-400 group-hover/item:text-purple-600 transition-colors" />
                  <span className="font-semibold text-purple-600">Research</span>
                </Link>
                <Link href="/resources/blog" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-purple-50 transition-colors group/item">
                  <Newspaper className="w-5 h-5 text-slate-400 group-hover/item:text-purple-600 transition-colors" />
                  <span className="font-semibold text-purple-600">Blog</span>
                </Link>
                <Link href="/resources/help" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-purple-50 transition-colors group/item">
                  <Headphones className="w-5 h-5 text-slate-400 group-hover/item:text-purple-600 transition-colors" />
                  <span className="font-semibold text-purple-600">Help Center</span>
                </Link>
              </div>
            </div>
          </div>



        </nav>

        <div className="flex items-center gap-2">
          <ModeToggle />
          <Link href="/login" className="hidden sm:flex items-center px-4 py-1.5 text-xs font-bold text-purple-500 bg-white/50 border border-purple-100/50 hover:bg-white hover:text-purple-600 rounded-full transition-all">
            Sign in
          </Link>
          
          <Link href="/register" className="flex items-center px-4 py-1.5 text-xs font-bold text-white bg-linear-to-r from-purple-400 to-fuchsia-400 hover:from-purple-500 hover:to-fuchsia-500 rounded-full shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 hover:-translate-y-0.5 transition-all">
            Join Athena
          </Link>

          <button className="xl:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <Menu className="w-5 h-5" />
          </button>
        </div>

      </div>

      {/* Bottom Row: Company & Shortcuts */}
      <div className="h-9 hidden lg:flex items-center justify-between px-6">
        
        {/* Company Link */}
        <Link href="/company" className="flex items-center gap-1.5 h-8 px-2.5 text-xs font-bold text-purple-700 bg-purple-100 border border-purple-300 hover:bg-purple-200 rounded-lg transition-all">
          <Building2 className="w-3.5 h-3.5" />
          Company
        </Link>

        <Link href="/dashboard" className="flex items-center gap-1.5 h-8 px-2.5 text-xs font-bold text-purple-700 bg-purple-100 border border-purple-300 hover:bg-purple-200 rounded-lg transition-all" title="Member Dashboard">
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </Link>
        <Link href="/jobs" className="flex items-center gap-1.5 h-8 px-2.5 text-xs font-bold text-purple-700 bg-purple-100 border border-purple-300 hover:bg-purple-200 rounded-lg transition-all" title="Jobs & Careers">
          <Briefcase className="w-3.5 h-3.5" />
          <span>Jobs</span>
        </Link>
        <Link href="/apprenticeships" className="flex items-center gap-1.5 h-8 px-2.5 text-xs font-bold text-purple-700 bg-purple-100 border border-purple-300 hover:bg-purple-200 rounded-lg transition-all" title="Apprenticeships">
          <GraduationCap className="w-3.5 h-3.5" />
          <span>Apprenticeships</span>
        </Link>
        <Link href="/housing" className="flex items-center gap-1.5 h-8 px-2.5 text-xs font-bold text-purple-700 bg-purple-100 border border-purple-300 hover:bg-purple-200 rounded-lg transition-all" title="Housing">
          <Home className="w-3.5 h-3.5" />
          <span>Housing</span>
        </Link>
        <Link href="/healthcare" className="flex items-center gap-1.5 h-8 px-2.5 text-xs font-bold text-purple-700 bg-purple-100 border border-purple-300 hover:bg-purple-200 rounded-lg transition-all" title="Healthcare">
          <Heart className="w-3.5 h-3.5" />
          <span>Healthcare</span>
        </Link>
        <Link href="/wellness" className="flex items-center gap-1.5 h-8 px-2.5 text-xs font-bold text-purple-700 bg-purple-100 border border-purple-300 hover:bg-purple-200 rounded-lg transition-all" title="Wellness">
          <Activity className="w-3.5 h-3.5" />
          <span>Wellness</span>
        </Link>
        <Link href="/fifo" className="flex items-center gap-1.5 h-8 px-2.5 text-xs font-bold text-purple-700 bg-purple-100 border border-purple-300 hover:bg-purple-200 rounded-lg transition-all" title="FIFO Work">
          <Briefcase className="w-3.5 h-3.5" />
          <span>FIFO</span>
        </Link>
        <Link href="/business" className="flex items-center gap-1.5 h-8 px-2.5 text-xs font-bold text-purple-700 bg-purple-100 border border-purple-300 hover:bg-purple-200 rounded-lg transition-all" title="Business Network">
          <Building2 className="w-3.5 h-3.5" />
          <span>Business</span>
        </Link>
        <Link href="/finance" className="flex items-center gap-1.5 h-8 px-2.5 text-xs font-bold text-purple-700 bg-purple-100 border border-purple-300 hover:bg-purple-200 rounded-lg transition-all" title="Finance">
          <Wallet className="w-3.5 h-3.5" />
          <span>Finance</span>
        </Link>
        <Link href="/government" className="flex items-center gap-1.5 h-8 px-2.5 text-xs font-bold text-purple-700 bg-purple-100 border border-purple-300 hover:bg-purple-200 rounded-lg transition-all" title="Government & Public Sector">
          <Landmark className="w-3.5 h-3.5" />
          <span>Gov</span>
        </Link>

      </div>


    </header>
  );
}
