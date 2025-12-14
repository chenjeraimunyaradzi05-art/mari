import Link from "next/link";
import { 
  Building2, 
  LayoutDashboard, 
  Briefcase, 
  GraduationCap, 
  Home as HomeIcon,
  Heart, 
  Activity, 
  Wallet, 
  Landmark,
  ArrowRight,
  Bell,
  Users,
  Star,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';

export default function Home() {
  const verticals = [
    { 
      id: 'jobs',
      name: 'Jobs & Careers', 
      icon: Briefcase, 
      href: '/jobs', 
      description: 'Discover roles that celebrate your ambition. From flexible leadership positions to companies committed to pay equity, find a career that fits your life, not just your resume.',
      adText: 'Featured Inclusive Employers',
      theme: 'from-blue-50 to-indigo-50',
      accent: 'text-blue-600',
      bgAccent: 'bg-blue-100',
      button: 'bg-blue-900 hover:bg-blue-800',
      stat: '450+ New Roles Today',
      quote: '"I found a flexible leadership role that respects my time as a mother."',
      quoteAuthor: 'Sarah J., VP of Engineering'
    },
    { 
      id: 'apprenticeships',
      name: 'Apprenticeships', 
      icon: GraduationCap, 
      href: '/apprenticeships', 
      description: 'Reinvent your future with hands-on pathways designed for women. Earn while you learn, connect with mentors, and break barriers in new industries.',
      adText: 'Pathway Partners & Scholarships',
      theme: 'from-emerald-50 to-teal-50',
      accent: 'text-emerald-600',
      bgAccent: 'bg-emerald-100',
      button: 'bg-emerald-900 hover:bg-emerald-800',
      stat: '1,200+ Active Mentors',
      quote: '"The mentorship program gave me the confidence to switch careers at 35."',
      quoteAuthor: 'Michelle K., Electrician Apprentice'
    },
    { 
      id: 'housing',
      name: 'Housing & Sanctuary', 
      icon: HomeIcon, 
      href: '/housing', 
      description: 'Find your sanctuary. Whether you\'re buying your first home, seeking safe rentals, or investing in property, explore housing solutions that prioritize your security and independence.',
      adText: 'Women-Centric Real Estate',
      theme: 'from-rose-50 to-orange-50',
      accent: 'text-rose-600',
      bgAccent: 'bg-rose-100',
      button: 'bg-rose-900 hover:bg-rose-800',
      stat: 'Verified Safe Landlords',
      quote: '"Finally, a rental platform where I feel safe and understood."',
      quoteAuthor: 'Priya M., Single Mom'
    },
    { 
      id: 'healthcare',
      name: 'Healthcare', 
      icon: Heart, 
      href: '/healthcare', 
      description: 'Care that understands you. Connect with practitioners who listen, from reproductive health to holistic specialists, ensuring your well-being is never secondary.',
      adText: 'Trusted Health Partners',
      theme: 'from-cyan-50 to-sky-50',
      accent: 'text-cyan-600',
      bgAccent: 'bg-cyan-100',
      button: 'bg-cyan-900 hover:bg-cyan-800',
      stat: '500+ Female Specialists',
      quote: '"Connecting with a doctor who actually listened changed my life."',
      quoteAuthor: 'Emma R., Community Member'
    },
    { 
      id: 'wellness',
      name: 'Wellness & Balance', 
      icon: Activity, 
      href: '/wellness', 
      description: 'Nurture your mind, body, and spirit. Access burnout prevention tools, mental health support, and self-care rituals designed for the modern woman.',
      adText: 'Wellness & Lifestyle Brands',
      theme: 'from-violet-50 to-purple-50',
      accent: 'text-violet-600',
      bgAccent: 'bg-violet-100',
      button: 'bg-violet-900 hover:bg-violet-800',
      stat: 'Free Mental Health Tools',
      quote: '"The burnout prevention guide helped me reclaim my evenings."',
      quoteAuthor: 'Lisa T., Founder'
    },
    { 
      id: 'fifo',
      name: 'FIFO & Resources', 
      icon: Briefcase, 
      href: '/fifo', 
      description: 'Thrive anywhere. Specialized support for women in mining and resources, connecting you with community, family support, and safe workplaces while you work away.',
      adText: 'Resource Sector Leaders',
      theme: 'from-amber-50 to-orange-50',
      accent: 'text-amber-600',
      bgAccent: 'bg-amber-100',
      button: 'bg-amber-900 hover:bg-amber-800',
      stat: 'Community Support Groups',
      quote: '"Knowing I have a community while working remote makes all the difference."',
      quoteAuthor: 'Jess D., Mining Engineer'
    },
    { 
      id: 'business',
      name: 'Business & Grants', 
      icon: Building2, 
      href: '/business', 
      description: 'Build your empire. Access grants for female founders, connect with investors who get it, and find the tools to scale your vision from startup to C-suite.',
      adText: 'Enterprise & Funding',
      theme: 'from-slate-50 to-gray-50',
      accent: 'text-slate-600',
      bgAccent: 'bg-slate-100',
      button: 'bg-slate-900 hover:bg-slate-800',
      stat: '$5M+ Grants Available',
      quote: '"I secured my first round of funding through the investor matching tool."',
      quoteAuthor: 'Rachel G., Tech CEO'
    },
    { 
      id: 'finance',
      name: 'Finance & Wealth', 
      icon: Wallet, 
      href: '/finance', 
      description: 'Master your money. From closing the investment gap to planning for financial freedom, access tools and advice to build wealth on your own terms.',
      adText: 'Financial Freedom Partners',
      theme: 'from-green-50 to-emerald-50',
      accent: 'text-green-600',
      bgAccent: 'bg-green-100',
      button: 'bg-green-900 hover:bg-green-800',
      stat: 'Wealth Building Workshops',
      quote: '"I finally feel in control of my financial future."',
      quoteAuthor: 'Maria S., Investor'
    },
    { 
      id: 'gov',
      name: 'Government & Policy', 
      icon: Landmark, 
      href: '/government', 
      description: 'Shape the future. Explore public sector opportunities where your voice matters, influencing policy and driving change in your community.',
      adText: 'Public Sector Initiatives',
      theme: 'from-indigo-50 to-blue-50',
      accent: 'text-indigo-600',
      bgAccent: 'bg-indigo-100',
      button: 'bg-indigo-900 hover:bg-indigo-800',
      stat: 'Policy Impact Forums',
      quote: '"It\'s empowering to know my voice is being heard in policy decisions."',
      quoteAuthor: 'Anita L., Policy Advocate'
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {verticals.map((section, index) => (
        <section key={section.id} className={`py-4 border-b border-slate-100 dark:border-slate-800 bg-linear-to-br ${section.theme} dark:from-slate-900 dark:to-slate-950`}>
          <div className="max-w-[1920px] mx-auto px-6 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              
              {/* Content Column */}
              <div className={`space-y-8 flex flex-col justify-center ${index % 2 !== 0 ? 'lg:order-2' : ''}`}>
                
                {/* Header */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-1.5 ${section.accent} dark:text-slate-200`}>
                      <TrendingUp className="w-3 h-3" />
                      {section.stat}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Users className="w-3 h-3" />
                      Community Verified
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-2xl shadow-sm ${section.bgAccent} ${section.accent} dark:bg-slate-800 dark:text-slate-200`}>
                      <section.icon className="w-10 h-10" />
                    </div>
                    <h2 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">{section.name}</h2>
                  </div>
                </div>
                
                {/* Description */}
                <p className="text-xl text-slate-700 dark:text-slate-300 leading-relaxed max-w-xl font-medium">
                  {section.description}
                </p>

                {/* Social Proof Quote */}
                <div className="flex gap-4 items-start max-w-lg">
                  <div className="mt-1">
                    <div className={`w-1 h-12 rounded-full ${section.bgAccent} dark:bg-slate-700`} />
                  </div>
                  <div>
                    <p className="text-slate-600 dark:text-slate-400 italic text-lg mb-2">{section.quote}</p>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-300">
                        {section.quoteAuthor.charAt(0)}
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-200">{section.quoteAuthor}</span>
                    </div>
                  </div>
                </div>

                {/* Pre-Apply Card */}
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl p-6 border border-white/60 dark:border-slate-700 shadow-lg hover:shadow-xl transition-all duration-300 group">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${section.bgAccent} ${section.accent} dark:bg-slate-800 dark:text-slate-200 group-hover:scale-110 transition-transform duration-300`}>
                      <Bell className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-bold text-slate-900 dark:text-white text-lg">Priority Talent Pool</h4>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${section.bgAccent} ${section.accent} dark:bg-slate-800 dark:text-slate-200`}>
                          High Demand
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                        Don't miss out. Pre-apply now to get instant SMS/Email alerts when new {section.name.split('&')[0]} roles match your profile.
                      </p>
                      
                      <div className="flex gap-3">
                        <input 
                          type="email" 
                          placeholder="Enter your email..." 
                          className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                        />
                        <button className={`px-6 py-2.5 text-white font-bold rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all ${section.button} dark:bg-slate-700 dark:hover:bg-slate-600`}>
                          Notify Me
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        Your data is secure and never shared without permission.
                      </p>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <div className="pt-2">
                  <Link 
                    href={section.href}
                    className={`inline-flex items-center justify-center px-8 py-4 bg-white dark:bg-slate-800 ${section.accent} dark:text-slate-200 font-bold text-lg rounded-2xl transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 border border-slate-200 dark:border-slate-700`}
                  >
                    Explore {section.name}
                  </Link>
                </div>
              </div>

              {/* Advertising Column */}
              <div className={`h-full min-h-[600px] bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-slate-700/60 shadow-2xl shadow-slate-200/50 dark:shadow-slate-900/50 p-8 flex flex-col items-center justify-center text-center relative overflow-hidden group ${index % 2 !== 0 ? 'lg:order-1' : ''}`}>
                {/* Background Effects */}
                <div className={`absolute inset-0 opacity-10 bg-linear-to-br ${section.theme}`} />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 dark:opacity-10 dark:invert" />
                <div className={`absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-20 ${section.bgAccent}`} />
                <div className={`absolute -bottom-24 -left-24 w-64 h-64 rounded-full blur-3xl opacity-20 ${section.bgAccent}`} />
                
                <div className="relative z-10 space-y-6 max-w-md mx-auto">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span className="text-xs font-bold tracking-wide text-slate-500 dark:text-slate-400 uppercase">
                      Partner Spotlight
                    </span>
                  </div>
                  
                  <h3 className="text-3xl font-bold text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-500 transition-colors duration-300">
                    {section.adText}
                  </h3>
                  
                  <p className="text-slate-400 dark:text-slate-500 text-sm leading-relaxed">
                    Connect with industry leaders and organizations committed to empowering women in {section.name.toLowerCase()}.
                  </p>

                  <button className="px-6 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-all text-sm">
                    View Opportunities
                  </button>
                </div>
              </div>

            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
