import Link from 'next/link';
import Image from 'next/image';
import { 
  ArrowRight, 
  Briefcase, 
  GraduationCap, 
  Users, 
  Sparkles, 
  MessageCircle,
  Heart,
  Share2,
  Bookmark,
  TrendingUp,
  Target,
  FileText,
  Mic,
  Lightbulb,
  Calendar,
  Bell,
  Settings,
  Search,
  Home,
  Radar,
  PenTool,
} from 'lucide-react';

export default function HomePage() {
  // Left sidebar - Platform features
  const platformFeatures = [
    { icon: Home, label: 'Dashboard', description: 'Your personalized hub' },
    { icon: Briefcase, label: 'Job Search', description: 'AI-powered matching' },
    { icon: Target, label: 'Personas', description: '9 career pathways' },
    { icon: FileText, label: 'Applications', description: 'Track your progress' },
    { icon: Bookmark, label: 'Saved Jobs', description: 'Your shortlist' },
    { icon: Users, label: 'Community', description: 'Connect & grow' },
    { icon: Heart, label: 'Mentors', description: '500+ experts' },
    { icon: MessageCircle, label: 'Messages', description: 'Direct chat' },
    { icon: Calendar, label: 'Events', description: 'Workshops & webinars' },
    { icon: GraduationCap, label: 'Learn', description: 'Skill courses' },
    { icon: Sparkles, label: 'AI Hub', description: 'Smart tools' },
    { icon: FileText, label: 'Resume AI', description: 'Optimize resumes' },
    { icon: Mic, label: 'Interview Coach', description: 'Practice sessions' },
    { icon: Radar, label: 'Opportunity Radar', description: 'Job alerts' },
    { icon: TrendingUp, label: 'Career Path', description: 'Plan your future' },
    { icon: PenTool, label: 'Content Gen', description: 'AI writing' },
    { icon: Lightbulb, label: 'Idea Validator', description: 'Test concepts' },
    { icon: Settings, label: 'Settings', description: 'Preferences' },
  ];

  // Social feed posts
  const socialPosts = [
    {
      id: 1,
      author: { name: 'Sarah Chen', role: 'Software Engineer at Google', avatar: null },
      content: 'Just landed my dream job at Google! 🎉 The ATHENA community and AI tools made all the difference. Special thanks to my mentor who guided me through the interview process.',
      likes: 234,
      comments: 45,
      shares: 12,
      time: '2h ago',
    },
    {
      id: 2,
      author: { name: 'Priya Sharma', role: 'Founder, EcoStyle', avatar: null },
      content: 'Excited to announce that EcoStyle just closed our seed round! 🚀 None of this would have been possible without the entrepreneur community here. If you\'re building something, don\'t hesitate to reach out!',
      likes: 567,
      comments: 89,
      shares: 34,
      time: '4h ago',
    },
    {
      id: 3,
      author: { name: 'Emily Rodriguez', role: 'Marketing Director', avatar: null },
      content: 'Pro tip: Use the Resume Optimizer before applying. It helped me highlight achievements I didn\'t even realize were impactful. Just negotiated a 40% raise! 💪',
      likes: 412,
      comments: 67,
      shares: 28,
      time: '6h ago',
    },
    {
      id: 4,
      author: { name: 'Jessica Kim', role: 'UX Designer', avatar: null },
      content: 'The Interview Coach AI is incredible! Practiced for my Amazon interview and felt so much more confident. Got the offer today! 🎊',
      likes: 189,
      comments: 34,
      shares: 15,
      time: '8h ago',
    },
  ];

  const stats = [
    { value: '50K+', label: 'Members' },
    { value: '10K+', label: 'Jobs' },
    { value: '500+', label: 'Mentors' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-[1600px] mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Image
                  src="/logo.svg"
                  alt="ATHENA"
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-lg"
                />
                <span className="text-xl font-bold gradient-text">ATHENA</span>
              </div>
              <div className="hidden md:flex relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search jobs, people, courses..."
                  className="pl-10 pr-4 py-2 w-64 bg-gray-100 dark:bg-gray-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <Bell className="w-5 h-5" />
              </button>
              <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">Sign In</Link>
              <Link href="/register" className="btn-primary text-sm px-4 py-2">Join Free</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main 3-Column Layout */}
      <div className="pt-14 max-w-[1600px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[14rem_minmax(0,1fr)_22rem]">
          
          {/* LEFT SIDEBAR - Platform Features (Small) */}
          <aside className="hidden lg:block w-56 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="p-4">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                Platform Features
              </h3>
              <nav className="space-y-1">
                {platformFeatures.map((feature) => (
                  <Link
                    key={feature.label}
                    href="/register"
                    className="flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition group"
                  >
                    <feature.icon className="w-4 h-4 text-gray-400 group-hover:text-primary-500" />
                    <div className="flex-1 min-w-0">
                      <span className="block truncate font-medium">{feature.label}</span>
                      <span className="block truncate text-xs text-gray-500">{feature.description}</span>
                    </div>
                  </Link>
                ))}
              </nav>
            </div>
          </aside>

          {/* CENTER - Main Content (Large) */}
          <main className="flex-1 min-w-0">
            {/* Hero Banner */}
            <div className="bg-gradient-to-r from-primary-600 via-secondary-600 to-primary-700 p-8 text-white">
              <div className="max-w-2xl mx-auto text-center">
                <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur px-4 py-1.5 rounded-full text-sm mb-4">
                  <Sparkles className="w-4 h-4" />
                  <span>The #1 Platform for Women's Career Growth</span>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold mb-3">
                  Your Life Operating System
                </h1>
                <p className="text-white/90 mb-6">
                  Be part of a community of ambitious women supporting each other to achieve their goals.
                </p>
                <div className="flex items-center justify-center gap-8 mb-6">
                  {stats.map((stat) => (
                    <div key={stat.label} className="text-center">
                      <div className="text-2xl font-bold">{stat.value}</div>
                      <div className="text-sm text-white/80">{stat.label}</div>
                    </div>
                  ))}
                </div>
                <Link href="/register" className="inline-flex items-center px-6 py-3 bg-white text-primary-600 font-semibold rounded-lg hover:bg-gray-100 transition group">
                  Get Started Free
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition" />
                </Link>
              </div>
            </div>
          </main>

          {/* RIGHT COLUMN - Community Feed */}
          <aside className="hidden lg:block w-[22rem] sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="p-4 md:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Community Feed</h2>
                <Link href="/register" className="text-sm text-primary-600 hover:text-primary-700">View All</Link>
              </div>

              {socialPosts.slice(0, 1).map((post) => (
                <article
                  key={post.id}
                  className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 hover:shadow-md transition"
                >
                  <div className="flex items-start space-x-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-secondary-500 flex items-center justify-center text-white font-semibold">
                      {post.author.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{post.author.name}</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{post.author.role}</p>
                        </div>
                        <span className="text-xs text-gray-400">{post.time}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-700 dark:text-gray-300 text-sm mb-4 leading-relaxed">
                    {post.content}
                  </p>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center space-x-2 text-gray-500 text-sm">
                      <Heart className="w-4 h-4" />
                      <span>{post.likes}</span>
                    </div>
                    <button className="flex items-center space-x-2 text-gray-500 hover:text-primary-500 transition text-sm">
                      <MessageCircle className="w-4 h-4" />
                      <span>{post.comments}</span>
                    </button>
                    <button className="flex items-center space-x-2 text-gray-500 hover:text-green-500 transition text-sm">
                      <Share2 className="w-4 h-4" />
                      <span>{post.shares}</span>
                    </button>
                    <button className="text-gray-500 hover:text-primary-500 transition">
                      <Bookmark className="w-4 h-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}
