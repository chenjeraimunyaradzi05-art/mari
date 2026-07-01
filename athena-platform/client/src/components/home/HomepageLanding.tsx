import Image from 'next/image';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BookOpen,
  Bot,
  Brain,
  Briefcase,
  Building2,
  Calendar,
  Check,
  Command,
  Compass,
  Crown,
  DollarSign,
  FileText,
  Gem,
  Globe2,
  GraduationCap,
  Heart,
  MessageCircle,
  Mic,
  Network,
  PenSquare,
  Play,
  Radar,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Users,
  UsersRound,
  Video,
  Wand2,
  Zap,
} from 'lucide-react';
import { ClientOnly } from '@/components/ClientOnly';
import PublicThemeToggle from '@/components/theme/PublicThemeToggle';
import successPortraitImage from './photos for successful women/ChatGPT Image May 15, 2026, 08_43_20 PM.png';
import successYachtImage from './photos for successful women/ChatGPT Image May 15, 2026, 08_45_05 PM.png';
import successCoastImage from './photos for successful women/generated-image.png';
import successVillaImage from './photos for successful women/generated-image (1).png';
import successCityImage from './photos for successful women/generated-image (2).png';

const brandLogo = '/athena-logo.png';

const navLinks = [
  { href: '/jobs', label: 'Jobs' },
  { href: '/mentors', label: 'Mentors' },
  { href: '/feed', label: 'Social' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/business', label: 'Partners' },
  { href: '/help/safety-center', label: 'Safety' },
];

const shortcuts = [
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/mentors', label: 'Mentors', icon: Users },
  { href: '/feed', label: 'Social', icon: Heart },
  { href: '/dashboard/ai/chat', label: 'AI', icon: Sparkles },
];

const navStatusPills = [
  { label: 'Signal', value: '92%', tone: 'text-emerald-500 dark:text-emerald-300' },
  { label: 'Concierge', value: 'Live', tone: 'text-cyan-500 dark:text-cyan-300' },
  { label: 'Safety', value: 'Protected', tone: 'text-rose-500 dark:text-rose-300' },
];

const commandSignals = [
  { label: 'Role match', value: '92%', icon: Radar, tone: 'text-emerald-300' },
  { label: 'Mentor fit', value: '8 new', icon: Users, tone: 'text-sky-300' },
  { label: 'Skills gap', value: '3 tasks', icon: BookOpen, tone: 'text-amber-300' },
  { label: 'Trust state', value: 'clear', icon: ShieldCheck, tone: 'text-rose-300' },
];

const heroMomentumTiles = [
  {
    label: 'Jobs',
    detail: 'Matched roles, salary signal, and saved shortlists',
    href: '/jobs',
    icon: Briefcase,
    gradient: 'from-rose-500 to-pink-500',
  },
  {
    label: 'Mentors',
    detail: 'Warm guidance from people already in motion',
    href: '/mentors',
    icon: Users,
    gradient: 'from-cyan-500 to-sky-500',
  },
  {
    label: 'AI coach',
    detail: 'Resume, interview, and strategy help on demand',
    href: '/dashboard/ai/chat',
    icon: Sparkles,
    gradient: 'from-fuchsia-500 to-purple-500',
  },
  {
    label: 'Learning',
    detail: 'Skill paths that connect directly to opportunity',
    href: '/courses',
    icon: GraduationCap,
    gradient: 'from-emerald-500 to-teal-500',
  },
];

const heroFocusPlan = [
  { label: 'Profile', value: 'Signal tuned' },
  { label: 'Mentor', value: '2 warm fits' },
  { label: 'Applications', value: '3 ready' },
];

const intelligenceCards = [
  {
    icon: Radar,
    title: 'Opportunity radar',
    description: 'A focused search layer for roles, companies, saved jobs, and application movement.',
    href: '/jobs',
    gradient: 'from-rose-500 via-pink-500 to-orange-400',
    glow: 'shadow-[0_20px_45px_-15px_rgba(244,63,94,0.55)]',
  },
  {
    icon: Wand2,
    title: 'AI career co-pilot',
    description: 'Resume positioning, interview prep, and career planning inside the same workspace.',
    href: '/dashboard/ai',
    gradient: 'from-fuchsia-500 via-purple-500 to-indigo-500',
    glow: 'shadow-[0_20px_45px_-15px_rgba(168,85,247,0.55)]',
  },
  {
    icon: UsersRound,
    title: 'Human network',
    description: 'Mentors, peers, groups, and events designed to turn ambition into accountable progress.',
    href: '/mentors',
    gradient: 'from-sky-400 via-cyan-400 to-teal-400',
    glow: 'shadow-[0_20px_45px_-15px_rgba(14,165,233,0.5)]',
  },
  {
    icon: Gem,
    title: 'Earning engine',
    description: 'Creator, mentor, employer, and learning paths that help expertise become durable income.',
    href: '/pricing',
    gradient: 'from-amber-400 via-orange-400 to-rose-400',
    glow: 'shadow-[0_20px_45px_-15px_rgba(245,158,11,0.55)]',
  },
];

const operatingLayers = [
  {
    eyebrow: 'Discover',
    title: 'Find the next move',
    description: 'Search roles, compare opportunities, and build a shortlist without losing context.',
    icon: Compass,
    gradient: 'from-rose-500 to-orange-400',
    href: '/jobs',
  },
  {
    eyebrow: 'Prepare',
    title: 'Raise your signal',
    description: 'Use AI tools, learning paths, mentor feedback, and profile improvements together.',
    icon: Rocket,
    gradient: 'from-fuchsia-500 to-purple-500',
    href: '/dashboard/ai',
  },
  {
    eyebrow: 'Connect',
    title: 'Work with the right people',
    description: 'Move from isolated searching into communities, events, messages, and support loops.',
    icon: Heart,
    gradient: 'from-pink-500 to-rose-400',
    href: '/network',
  },
];

const audienceRoutes = [
  { label: 'Job seekers', href: '/register', icon: Briefcase, gradient: 'from-rose-500 to-pink-500' },
  { label: 'Employers', href: '/employer', icon: Building2, gradient: 'from-indigo-500 to-purple-500' },
  { label: 'Mentors', href: '/dashboard/mentors/become-mentor', icon: Star, gradient: 'from-amber-500 to-orange-500' },
  { label: 'Brand partners', href: '/contact-sales?intent=partnership', icon: Gem, gradient: 'from-emerald-500 to-teal-500' },
  { label: 'Developers', href: '/developers', icon: Command, gradient: 'from-sky-500 to-cyan-500' },
];

const memberPromises = [
  'Verified mentors, employers, and creator partners',
  'Consent-first messaging, safety centre, and report flow',
  'Private by default \u2014 you control what is public, paid, or partnered',
  'Earnings, learning, and applications tracked in one wallet view',
];

const partnerFormats = [
  {
    label: 'Sponsored learning track',
    tag: 'Education',
    description: 'Co-publish a 4-week skill path with branded mentors, certificates, and graduation events.',
    metric: 'Avg 2.4k completions',
    icon: GraduationCap,
    gradient: 'from-sky-500 to-cyan-500',
    href: '/contact-sales?intent=partnership&format=learning',
  },
  {
    label: 'Featured hiring sprint',
    tag: 'Talent',
    description: 'Run a 2-week curated hiring drive surfaced in jobs, mentorship, and referral inboxes.',
    metric: 'Avg 18% reply rate',
    icon: Briefcase,
    gradient: 'from-rose-500 to-pink-500',
    href: '/contact-sales?intent=partnership&format=hiring',
  },
  {
    label: 'Native creator drop',
    tag: 'Awareness',
    description: 'Sponsor a creator-led video, AMA, or live workshop with measurable engagement.',
    metric: 'Avg 41k impressions',
    icon: Video,
    gradient: 'from-fuchsia-500 to-purple-500',
    href: '/contact-sales?intent=partnership&format=creator',
  },
  {
    label: 'Capital & grants spotlight',
    tag: 'Capital',
    description: 'Promote your fund, grant, or programme to verified founders and operators ready to apply.',
    metric: 'Avg 320 applications',
    icon: Gem,
    gradient: 'from-amber-500 to-orange-500',
    href: '/contact-sales?intent=partnership&format=capital',
  },
];

const partnerCaseStudies = [
  {
    sector: 'Banking',
    quote: 'A salary literacy track with ATHENA filled three early-career analyst cohorts in eight weeks.',
    attribution: 'Emerging Markets Bank',
    outcome: 'Cohort filled 8 weeks',
    icon: DollarSign,
    gradient: 'from-emerald-500 to-teal-500',
    href: '/finances',
  },
  {
    sector: 'Mining & Trades',
    quote: 'Sponsored apprenticeship spotlights brought us 280 verified women into our field-engineer pipeline.',
    attribution: 'Continental Resources Co.',
    outcome: '280 verified leads',
    icon: Compass,
    gradient: 'from-amber-500 to-orange-500',
    href: '/apprenticeships',
  },
  {
    sector: 'Education',
    quote: 'Our scholarship landing page from ATHENA outperformed paid social by 3.4x on quality applications.',
    attribution: 'Sunrise Foundation',
    outcome: '3.4x quality lift',
    icon: GraduationCap,
    gradient: 'from-sky-500 to-cyan-500',
    href: '/courses',
  },
];

const partnerCategories = [
  {
    label: 'Banking & finance',
    industry: 'banking',
    description: 'Sponsor financial literacy tracks, salary tools, and capital programmes for women in motion.',
    icon: DollarSign,
    gradient: 'from-emerald-500 to-teal-500',
    href: '/contact-sales?intent=partnership&industry=banking',
    routeHref: '/finances',
  },
  {
    label: 'Education & training',
    industry: 'education',
    description: 'Co-publish learning paths, micro-credentials, and scholarship pipelines into your campuses.',
    icon: GraduationCap,
    gradient: 'from-sky-500 to-cyan-500',
    href: '/contact-sales?intent=partnership&industry=education',
    routeHref: '/courses',
  },
  {
    label: 'Mining & energy',
    industry: 'mining',
    description: 'Recruit underground-to-boardroom talent and showcase apprenticeships, safety culture, and ESG wins.',
    icon: Compass,
    gradient: 'from-amber-500 to-orange-500',
    href: '/contact-sales?intent=partnership&industry=mining',
    routeHref: '/apprenticeships',
  },
  {
    label: 'Trades & infrastructure',
    industry: 'trades',
    description: 'Promote apprenticeships, certifications, and field roles to women breaking into trades.',
    icon: Wand2,
    gradient: 'from-rose-500 to-pink-500',
    href: '/contact-sales?intent=partnership&industry=trades',
    routeHref: '/apprenticeships',
  },
  {
    label: 'Healthcare & wellness',
    industry: 'healthcare',
    description: 'Reach a verified audience for clinical roles, mental-health partnerships, and wellbeing benefits.',
    icon: Heart,
    gradient: 'from-fuchsia-500 to-purple-500',
    href: '/contact-sales?intent=partnership&industry=healthcare',
    routeHref: '/jobs?sector=healthcare',
  },
  {
    label: 'Tech & AI',
    industry: 'technology',
    description: 'Plug into AI tooling rails, developer programmes, and engineering hiring pipelines.',
    icon: Bot,
    gradient: 'from-indigo-500 to-blue-500',
    href: '/contact-sales?intent=partnership&industry=technology',
    routeHref: '/developers',
  },
];

const lifeOsSignals = [
  { label: 'Career routes', value: '16', detail: 'abilities synced', icon: Command, href: '/dashboard' },
  { label: 'Concierge mode', value: 'Live', detail: 'next-step guidance', icon: Bot, href: '/dashboard/ai/chat' },
  { label: 'Momentum loop', value: '1', detail: 'account, every track', icon: Zap, href: '/dashboard/accelerator' },
];

const partnerStats = [
  {
    label: 'Verified members',
    value: 'Women-led',
    detail: 'Identity-checked, opt-in audience',
    href: '/privacy-center',
  },
  {
    label: 'Native formats',
    value: 'Sponsored',
    detail: 'Learning paths, events, job boosts',
    href: '/admin/marketing/partnerships',
  },
  {
    label: 'Performance',
    value: 'Transparent',
    detail: 'Reach, engagement, applications',
    href: '/dashboard/finance',
  },
];

const conciergeActions = [
  {
    icon: Compass,
    title: 'Map my next move',
    description: 'Turn goals into a weekly plan across jobs, mentors, learning, and money.',
    href: '/dashboard/ai/chat?q=Map%20my%20next%20career%20move%20across%20jobs%2C%20mentors%2C%20learning%2C%20and%20income.',
  },
  {
    icon: Radar,
    title: 'Scan opportunities',
    description: 'Find roles, referrals, events, and warm openings that match your signal.',
    href: '/dashboard/ai/chat?q=Scan%20for%20opportunities%20that%20match%20my%20skills%2C%20goals%2C%20and%20network.',
  },
  {
    icon: ShieldCheck,
    title: 'Protect my path',
    description: 'Use safety, consent, and privacy controls without losing momentum.',
    href: '/dashboard/ai/chat?q=Help%20me%20set%20up%20safer%20privacy%2C%20consent%2C%20and%20career%20support%20controls.',
  },
];

const successGallery = [
  {
    image: successCityImage,
    alt: 'Professional woman in a tailored black suit stepping from a luxury car in a city setting',
    label: 'Signal',
    caption: 'Sharp positioning, high-trust networks, and visible momentum.',
    thumbPosition: '50% 50%',
  },
  {
    image: successVillaImage,
    alt: 'Professional woman in a cream suit walking beside a waterfront residence at sunset',
    label: 'Capital',
    caption: 'Turn expertise into leverage across roles, ventures, and income.',
    thumbPosition: '56% 50%',
  },
  {
    image: successPortraitImage,
    alt: 'Professional woman smiling from the driver seat of a convertible',
    label: 'Daily',
    caption: 'Make the next step feel concrete before the day starts.',
    thumbPosition: '42% 50%',
  },
  {
    image: successYachtImage,
    alt: 'Professional woman in a white blazer seated on a yacht at sunset',
    label: 'Global',
    caption: 'Mentors, peers, and rooms that expand the horizon.',
    thumbPosition: '38% 50%',
  },
  {
    image: successCoastImage,
    alt: 'Professional woman in a white suit standing beside a sports car above a coastal skyline',
    label: 'Future',
    caption: 'A clear route from ambition into action.',
    thumbPosition: '64% 50%',
  },
];

// Full platform abilities: each module has a lane and live signal so the grid
// reads like an operating system instead of a generic feature catalogue.
const platformAbilities = [
  { icon: Briefcase, title: 'Smart job search', description: 'AI-matched roles with salary insights and one-click apply.', gradient: 'from-rose-500 to-pink-500', lane: 'Opportunity', signal: 'Match engine', href: '/jobs' },
  { icon: FileText, title: 'Resume optimizer', description: 'Tailor your resume to any job in seconds with AI feedback.', gradient: 'from-fuchsia-500 to-purple-500', lane: 'Signal', signal: 'ATS tune', href: '/dashboard/ai/resume-optimizer' },
  { icon: Brain, title: 'AI career coach', description: 'Always-on copilot for interview prep, planning, and mindset.', gradient: 'from-violet-500 to-indigo-500', lane: 'Concierge', signal: 'Live plan', href: '/dashboard/ai/chat' },
  { icon: Users, title: 'Mentorship circles', description: 'Find mentors, run 1:1s, and track growth milestones.', gradient: 'from-sky-500 to-cyan-500', lane: 'Network', signal: 'Human loop', href: '/mentors' },
  { icon: GraduationCap, title: 'Learning paths', description: 'Curated courses, micro-credentials, and skills tracks.', gradient: 'from-teal-500 to-emerald-500', lane: 'Growth', signal: 'Skill graph', href: '/courses' },
  { icon: Heart, title: 'Social feed', description: 'Post wins, ask questions, follow inspiring women worldwide.', gradient: 'from-pink-500 to-rose-500', lane: 'Community', signal: 'Live pulse', href: '/feed' },
  { icon: Video, title: 'Video discovery', description: 'Short-form career videos, events, and creator content.', gradient: 'from-purple-500 to-fuchsia-500', lane: 'Discovery', signal: 'Creator rail', href: '/videos' },
  { icon: Calendar, title: 'Events & meetups', description: 'Join workshops, AMAs, and community calls that matter.', gradient: 'from-amber-500 to-orange-500', lane: 'Calendar', signal: 'Next room', href: '/events' },
  { icon: DollarSign, title: 'Earning pathways', description: 'Turn expertise into income as a creator, mentor, or consultant.', gradient: 'from-yellow-500 to-amber-500', lane: 'Income', signal: 'Revenue path', href: '/dashboard/finance' },
  { icon: PenSquare, title: 'Creator tools', description: 'Publish articles, run paid workshops, launch digital products.', gradient: 'from-orange-500 to-rose-500', lane: 'Creator', signal: 'Launch kit', href: '/dashboard/creator-studio' },
  { icon: Building2, title: 'Employer branding', description: 'Showcase culture, post roles, and engage top talent.', gradient: 'from-indigo-500 to-blue-500', lane: 'Employer', signal: 'Talent signal', href: '/employer' },
  { icon: Network, title: 'Warm referrals', description: 'Connect with employees and mentors who can open doors.', gradient: 'from-cyan-500 to-sky-500', lane: 'Access', signal: 'Warm intro', href: '/network' },
  { icon: Target, title: 'Goal tracking', description: 'Set weekly intentions and watch momentum compound.', gradient: 'from-emerald-500 to-teal-500', lane: 'Momentum', signal: 'Weekly loop', href: '/dashboard' },
  { icon: ShieldCheck, title: 'Safety first', description: 'Built-in moderation, consent controls, and safety centre.', gradient: 'from-rose-500 to-red-500', lane: 'Trust', signal: 'Protected', href: '/help/safety-center' },
  { icon: Mic, title: 'Voice notes', description: 'Send voice intros, check-ins, and mentor reflections.', gradient: 'from-fuchsia-500 to-pink-500', lane: 'Voice', signal: 'Async sync', href: '/dashboard/messages' },
  { icon: Crown, title: 'Your life OS', description: 'Everything connected: one dashboard for your whole chapter.', gradient: 'from-amber-400 via-rose-500 to-purple-500', lane: 'Command', signal: 'Unified', href: '/dashboard' },
];

type Ability = (typeof platformAbilities)[number];

const abilityBands: Array<{
  orbit: string;
  description: string;
  accent: string;
  lanes: string[];
  headline?: Ability;
  support: Ability[];
}> = [
  {
    orbit: 'Opportunity',
    description: 'Scan opportunities, tune your signal, and keep progress measurable every week.',
    accent: 'from-rose-500 via-fuchsia-500 to-amber-400',
    lanes: ['Opportunity', 'Signal', 'Concierge', 'Momentum'],
  },
  {
    orbit: 'Network',
    description: 'Mentors, community rituals, live creator drops, and events that build gravity.',
    accent: 'from-sky-500 via-cyan-400 to-emerald-400',
    lanes: ['Network', 'Community', 'Discovery', 'Calendar'],
  },
  {
    orbit: 'Growth & income',
    description: 'Structured learning meets monetisation routes so expertise compounds into income.',
    accent: 'from-amber-400 via-rose-400 to-purple-500',
    lanes: ['Growth', 'Income', 'Creator', 'Voice'],
  },
  {
    orbit: 'Access & trust',
    description: 'Warm intros, employer layers, consent controls, and your command hub in one surface.',
    accent: 'from-indigo-500 via-blue-500 to-fuchsia-500',
    lanes: ['Access', 'Employer', 'Trust', 'Command'],
  },
].map((band) => {
  const features = band.lanes
    .map((lane) => platformAbilities.find((ability) => ability.lane === lane))
    .filter((ability): ability is Ability => Boolean(ability));
  const [headline, ...rest] = features;
  return {
    ...band,
    headline,
    support: rest.slice(0, 2),
  };
});

// Sample feed preview (static, links to live feed)
const feedPreview = [
  {
    name: 'Amara Okonkwo',
    role: 'Staff Product Designer',
    image: successPortraitImage,
    imageAlt: 'Professional woman smiling from the driver seat of a convertible',
    badge: 'Win',
    pulse: 'Signal boost',
    caption: 'Closed the offer with Luma Robotics. Three mentor retros, one concierge sprint, one brave DM.',
    likes: 284,
    comments: 37,
  },
  {
    name: 'Priya Singh',
    role: 'Applied ML Engineer',
    image: successYachtImage,
    imageAlt: 'Professional woman in a white blazer seated on a yacht at sunset',
    badge: 'Debate',
    pulse: 'Community prompt',
    caption: 'What did you automate first when you led your own ML platform team? Planning my switch.',
    likes: 96,
    comments: 24,
  },
  {
    name: 'Sofia Martinez',
    role: 'Founder · QueenBee Labs',
    image: successCityImage,
    imageAlt: 'Professional woman in a tailored black suit beside a luxury car in a city setting',
    badge: 'Live',
    pulse: 'Creator studio',
    caption: 'Micro-AMA in 9 minutes: raising a pre-seed as a non-technical founder with zero warm intros.',
    likes: 512,
    comments: 88,
  },
];

function HeroPhotoGallery() {
  const [featured, ...supporting] = successGallery;

  return (
    <div className="relative h-full overflow-hidden rounded-lg border border-white/45 bg-white/55 p-2 shadow-2xl shadow-rose-950/10 backdrop-blur dark:border-white/10 dark:bg-white/[0.06] dark:shadow-black/35">
      <div className="relative h-full min-h-[35rem] overflow-hidden rounded-lg bg-slate-950">
        <Image
          src={featured.image}
          alt={featured.alt}
          fill
          priority
          className="object-cover"
          sizes="(min-width: 1280px) 28rem, (min-width: 1024px) 50vw, 100vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.04)_0%,rgba(15,23,42,0.16)_45%,rgba(15,23,42,0.9)_100%)]" />
        <div className="absolute inset-x-0 bottom-[14.25rem] p-4 text-white sm:bottom-24">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-200">
            {featured.label}
          </div>
          <p className="mt-2 max-w-[17rem] text-sm font-medium leading-6 text-white/95">
            {featured.caption}
          </p>
        </div>
        <div className="absolute inset-x-0 bottom-0 grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
          {supporting.map((item) => (
            <div
              key={item.label}
              className="group relative aspect-[16/10] overflow-hidden rounded-lg border border-white/30 bg-white/20 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <Image
                src={item.image}
                alt={item.alt}
                fill
                className="object-cover transition duration-500 group-hover:scale-105"
                sizes="(min-width: 1280px) 6rem, (min-width: 1024px) 7rem, 42vw"
                style={{ objectPosition: item.thumbPosition }}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 to-transparent px-2 py-1.5">
                <div className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-white">
                  {item.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HeroCommandDeck() {
  return (
    <div className="space-y-4">
      <HeroSocialRail />
      <SignalPanel />
    </div>
  );
}

function HeroMomentumRibbon() {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.05]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-600 dark:text-rose-200">
            Momentum lanes
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Choose a lane to dive deeper. Each tile links directly into the workspace surface it represents.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:text-rose-600 dark:border-slate-700 dark:bg-white/5 dark:text-slate-200"
        >
          Open dashboard
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {heroMomentumTiles.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="group flex min-h-[6.5rem] items-start gap-3 rounded-xl border border-rose-200/60 bg-white/75 p-4 backdrop-blur transition hover:-translate-y-0.5 hover:border-rose-300 hover:bg-white dark:border-rose-400/20 dark:bg-white/5 dark:hover:bg-white/10"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${item.gradient} text-white shadow-lg shadow-rose-500/15`}
            >
              <item.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                {item.label}
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-rose-500" />
              </div>
              <div className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{item.detail}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function HeroProgressPanel() {
  return (
    <div className="grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.05]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-600 dark:text-rose-200">
          Today&apos;s focus plan
        </div>
        <div className="mt-3 space-y-2">
          {heroFocusPlan.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg bg-slate-950/[0.03] px-3 py-2 text-sm dark:bg-white/[0.04]">
              <span className="text-slate-600 dark:text-slate-300">{item.label}</span>
              <span className="font-semibold text-slate-950 dark:text-white">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-amber-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(254,243,199,0.72))] p-4 shadow-sm backdrop-blur dark:border-amber-300/20 dark:bg-white/[0.05]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700 dark:text-amber-200">
          Momentum score
        </div>
        <div className="mt-3 flex items-end gap-2">
          <span className="text-4xl font-semibold text-slate-950 dark:text-white">92</span>
          <span className="pb-1 text-sm font-semibold text-emerald-600 dark:text-emerald-300">+14%</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
          Higher fit score after profile, mentor, and learning signals connect.
        </p>
      </div>
    </div>
  );
}

function HeroSocialRail() {
  return (
    <div className="relative overflow-hidden rounded-lg border border-white/15 bg-slate-950/75 p-4 text-white shadow-2xl shadow-slate-950/25 backdrop-blur">
      <div className="cyber-grid pointer-events-none absolute inset-0 opacity-25" aria-hidden="true" />
      <div className="relative flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-fuchsia-200">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-300 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-300" />
              <span className="sr-only">Live</span>
            </span>
            Community signal
          </div>
          <h2 className="mt-2 text-lg font-semibold">Live momentum feed</h2>
        </div>
        <Link
          href="/feed"
          aria-label="Open live social feed"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:bg-white/15"
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="relative mt-4 space-y-3">
        {feedPreview.map((post) => (
          <Link
            key={post.name}
            href="/feed"
            className="group block rounded-lg border border-white/10 bg-white/[0.06] p-3 transition hover:-translate-y-0.5 hover:border-rose-300/40 hover:bg-white/[0.09]"
          >
            <div className="flex items-center gap-3">
              <Image
                src={post.image}
                alt={post.imageAlt}
                width={72}
                height={72}
                className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-white/30"
                sizes="36px"
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">{post.name}</div>
                <div className="truncate text-[11px] text-slate-400">{post.role}</div>
              </div>
            </div>
            <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-300">{post.caption}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 font-semibold uppercase tracking-[0.24em] text-white">
                {post.badge}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                <span aria-hidden="true">{post.pulse}</span>
                <span className="sr-only">Pulse signal</span>
              </span>
              <span className="inline-flex items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <Heart className="h-3 w-3 text-rose-300" /> {post.likes}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="h-3 w-3 text-cyan-300" /> {post.comments}
                </span>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SignalPanel() {
  return (
    <div className="rounded-2xl border border-white/15 bg-slate-950/70 p-4 text-white shadow-2xl shadow-slate-950/30 backdrop-blur">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-rose-600">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">ATHENA Signal Console</div>
            <div className="text-xs text-slate-400">Live growth pathways</div>
          </div>
        </div>
        <span className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
          Online
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {commandSignals.map((signal) => (
          <div key={signal.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between">
              <signal.icon className={`h-5 w-5 ${signal.tone}`} />
              <span className="text-lg font-semibold">{signal.value}</span>
            </div>
            <div className="mt-3 text-sm text-slate-300">{signal.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Zap className="h-4 w-4 text-amber-300" />
          Suggested next action
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Update your profile, compare three matched roles, and send one mentor request before your next application.
        </p>
      </div>
    </div>
  );
}

function SocialFeedPreview() {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/70">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span className="sr-only">Live</span>
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-rose-200">
            Live community signal
          </span>
        </div>
        <Link
          href="/feed"
          className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-rose-300 hover:text-rose-600 dark:border-white/10 dark:text-slate-300 dark:hover:border-rose-400/40 dark:hover:text-rose-300"
        >
          Open feed <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-3">
        {feedPreview.map((post) => (
          <Link
            key={post.name}
            href="/feed"
            className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-rose-400/20"
          >
            <div className="flex items-start gap-3">
              <Image
                src={post.image}
                alt={post.imageAlt}
                width={88}
                height={88}
                className="h-11 w-11 flex-shrink-0 rounded-xl object-cover ring-2 ring-white dark:ring-slate-900"
                sizes="44px"
              />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{post.name}</span>
                  <span className="rounded-full border border-rose-300/60 bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-600 dark:border-rose-400/40 dark:bg-rose-500/15 dark:text-rose-200">
                    {post.badge}
                  </span>
                  <span className="rounded-full border border-cyan-300/40 bg-cyan-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-cyan-600 dark:border-cyan-400/30 dark:bg-cyan-500/15 dark:text-cyan-200">
                    <span aria-hidden="true">{post.pulse}</span>
                    <span className="sr-only">Pulse signal</span>
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{post.role}</div>
                <p className="mt-1 text-xs leading-5 text-slate-700 dark:text-slate-300 line-clamp-2">
                  {post.caption}
                </p>
                <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3 w-3" /> {post.likes}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" /> {post.comments}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function HomepageLanding() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Image
              src={brandLogo}
              alt="ATHENA"
              width={48}
              height={48}
              className="h-11 w-11 rounded-xl object-cover shadow-blossom ring-1 ring-rose-200/60 dark:ring-rose-400/20"
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-wide text-slate-950 dark:text-white">ATHENA</div>
              <div className="truncate text-xs text-slate-500 dark:text-slate-400">Career intelligence platform</div>
            </div>
          </Link>

          <div className="hidden items-center gap-6 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-600 transition hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-300"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1 sm:flex">
              {navStatusPills.map((pill) => (
                <dl
                  key={pill.label}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200/60 bg-white/70 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-slate-700 backdrop-blur dark:border-white/10 dark:bg-white/10 dark:text-slate-200"
                  aria-label={`${pill.label} status`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-rose-500 to-fuchsia-500" aria-hidden="true" />
                  <dt className="sr-only">{pill.label}</dt>
                  <span className="uppercase text-[10px] text-slate-500 dark:text-slate-300" aria-hidden="true">
                    {pill.label}
                  </span>
                  <dd className={`font-medium ${pill.tone}`} aria-live="polite">
                    {pill.value}
                  </dd>
                </dl>
              ))}
            </div>
            <div className="hidden sm:block">
              <ClientOnly>
                <PublicThemeToggle />
              </ClientOnly>
            </div>
            <Link
              href="/login"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl border border-rose-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-950 shadow-[0_14px_32px_-20px_rgba(15,23,42,0.65)] transition hover:-translate-y-0.5 hover:border-rose-300 hover:text-rose-700 hover:shadow-[0_18px_38px_-18px_rgba(244,63,94,0.48)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 dark:border-rose-300/30 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 sm:text-sm"
            >
              <span
                className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-rose-500 via-fuchsia-500 to-amber-400 opacity-80 transition group-hover:h-1"
                aria-hidden="true"
              />
              <span className="relative flex h-6 w-6 items-center justify-center rounded-lg bg-rose-50 text-rose-600 transition group-hover:bg-rose-100 dark:bg-rose-400/15 dark:text-rose-100">
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
              <span className="relative">Sign in</span>
              <ArrowRight className="relative h-3.5 w-3.5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-rose-600" />
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,#f43f5e_0%,#a855f7_55%,#f59e0b_100%)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-10px_rgba(244,63,94,0.55)] sm:text-sm"
            >
              Join free
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-4 sm:px-6 lg:hidden lg:px-8">
          {shortcuts.map((shortcut) => (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              <shortcut.icon className="h-4 w-4" />
              {shortcut.label}
            </Link>
          ))}
        </div>
      </nav>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-aurora">
          <div className="cyber-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:px-8 xl:min-h-[calc(100vh-5rem)] xl:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/60 bg-white/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-rose-700 shadow-sm backdrop-blur dark:border-rose-400/30 dark:bg-white/5 dark:text-rose-200">
                <Globe2 className="h-3.5 w-3.5" />
                Built for global career momentum
              </div>
              <h1 className="mt-6 max-w-4xl font-display text-5xl font-semibold leading-[1.05] text-slate-900 sm:text-6xl lg:text-7xl dark:text-white">
                A career command center for women{' '}
                <span className="gradient-text-feminine">building the future.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-700 sm:text-lg dark:text-slate-200">
                ATHENA connects jobs, mentors, learning, community, AI coaching, and earning pathways in one
                intelligent workspace designed for women&apos;s whole lives.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center rounded-xl bg-[linear-gradient(135deg,#f43f5e_0%,#a855f7_55%,#f59e0b_100%)] px-6 py-3 text-sm font-semibold text-white shadow-blossom transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-10px_rgba(244,63,94,0.55)]"
                >
                  Start your workspace
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  href="/jobs"
                  className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white/80 px-6 py-3 text-sm font-semibold text-rose-700 backdrop-blur transition hover:bg-white dark:border-rose-400/30 dark:bg-white/5 dark:text-rose-200 dark:hover:bg-white/10"
                >
                  Explore roles
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                <span>Or jump straight to</span>
                <Link
                  href="/feed"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-white dark:border-slate-700 dark:bg-white/5 dark:text-slate-200"
                >
                  <Heart className="h-3.5 w-3.5 text-rose-500" />
                  Social feed
                </Link>
                <Link
                  href="/contact-sales?intent=partnership"
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-300/70 bg-emerald-50/80 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 transition hover:-translate-y-0.5 hover:bg-emerald-50 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                >
                  <Gem className="h-3.5 w-3.5" />
                  Brand partners
                </Link>
              </div>
            </div>
            <HeroPhotoGallery />
          </div>
        </section>

        <section className="relative border-y border-slate-200/70 bg-white/80 backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/60">
          <div className="cyber-grid pointer-events-none absolute inset-0 opacity-20" aria-hidden="true" />
          <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="grid gap-10 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:items-start">
              <div className="space-y-6">
                <div className="max-w-xl space-y-3">
                  <div className="kicker">Command surface preview</div>
                  <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">
                    Live social momentum and concierge guidance appear right after the hero.
                  </h2>
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                    We moved the interactive rail to a second beat so the headline breathes, while the operating system
                    still opens within a single scroll.
                  </p>
                </div>
                <HeroCommandDeck />
              </div>
              <div className="space-y-6">
                <HeroMomentumRibbon />
                <HeroProgressPanel />
              </div>
            </div>
          </div>
        </section>

        {/* Sponsor strip */}
        <section className="relative border-b border-slate-200/70 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-slate-950/60">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              <span className="inline-flex h-6 items-center rounded-full border border-emerald-300/60 bg-emerald-50 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                Sponsored
              </span>
              Trusted by partners across
            </div>
            <div className="flex flex-wrap items-center gap-2">
                  {partnerCategories.map((category) => (
                    <Link
                      key={category.industry}
                      href={category.href}
                  className="group inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-rose-300 hover:text-rose-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-rose-400/40 dark:hover:text-rose-200"
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br ${category.gradient} text-white`}
                  >
                    <category.icon className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                  {category.label}
                </Link>
              ))}
              <Link
                href="/contact-sales?intent=partnership"
                className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                Advertise
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>

        {/* Intelligence layer */}
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="kicker">Intelligence layer</div>
              <h2 className="mt-2 max-w-3xl text-3xl font-semibold text-slate-950 dark:text-white">
                Futuristic where it matters: faster decisions, better signal, less scattered work.
              </h2>
            </div>
            <Link href="/dashboard/ai" className="inline-flex items-center text-sm font-semibold text-rose-600 dark:text-rose-300">
              Open AI tools
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {intelligenceCards.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="panel group relative overflow-hidden p-5 transition hover:-translate-y-1 hover:border-rose-200 hover:shadow-md dark:hover:border-rose-400/30"
              >
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${card.gradient} opacity-0 blur-2xl transition duration-500 group-hover:opacity-40`}
                />
                <div className="relative flex items-center justify-between">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${card.gradient} text-white ${card.glow} transition group-hover:scale-110 group-hover:rotate-[-4deg]`}
                  >
                    <card.icon className="h-6 w-6" strokeWidth={2.25} />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-rose-600" />
                </div>
                <h3 className="relative mt-5 text-lg font-semibold text-slate-950 dark:text-white">{card.title}</h3>
                <p className="relative mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{card.description}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Full platform abilities */}
        <section className="relative overflow-hidden border-y border-slate-900 bg-slate-950 text-white">
          <div className="cyber-grid pointer-events-none absolute inset-0 opacity-35" aria-hidden="true" />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-300/80 to-transparent"
            aria-hidden="true"
          />
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/25 bg-white/[0.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-100">
                  <Sparkles className="h-3.5 w-3.5 text-rose-200" />
                  Every ability, one account
                </div>
                <h2 className="mt-5 max-w-4xl text-3xl font-semibold leading-tight text-white sm:text-4xl">
                  The full <span className="gradient-text-feminine">life OS</span>{' '}for women&apos;s careers.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                  Sixteen connected abilities now behave like one intelligent command layer: jobs, mentors,
                  learning, community, income, safety, and guidance move together.
                </p>

                <Link
                  href="/contact-sales?intent=partnership"
                  className="group mt-5 inline-flex items-center gap-3 rounded-2xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:-translate-y-0.5 hover:border-emerald-300/60 hover:bg-emerald-500/15"
                >
                  <span className="inline-flex items-center rounded-full border border-emerald-300/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200">
                    Partner spotlight
                  </span>
                  Sponsor a learning lane, hiring sprint, or community ritual
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>

                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  {lifeOsSignals.map((signal) => (
                    <Link
                      key={signal.label}
                      href={signal.href}
                      className="group rounded-lg border border-white/10 bg-white/[0.05] p-4 shadow-[0_18px_60px_-35px_rgba(244,63,94,0.8)] backdrop-blur transition hover:-translate-y-0.5 hover:border-rose-300/35 hover:bg-white/[0.08]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <signal.icon className="h-5 w-5 text-rose-200" />
                        <span className="inline-flex items-center gap-2 font-mono text-lg font-semibold text-white">
                          {signal.value}
                          <ArrowRight className="h-3.5 w-3.5 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-rose-200" />
                        </span>
                      </div>
                      <div className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {signal.label}
                      </div>
                      <div className="mt-1 text-sm text-slate-200">{signal.detail}</div>
                    </Link>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {platformAbilities.slice(0, 4).map((ability) => (
                    <Link
                      key={ability.title}
                      href={ability.href}
                      className="group flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-rose-300/35 hover:bg-white/[0.08]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${ability.gradient} text-white`}
                        >
                          <ability.icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{ability.title}</div>
                          <div className="mt-0.5 truncate text-xs text-slate-400">{ability.signal}</div>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-rose-200" />
                    </Link>
                  ))}
                </div>
              </div>

              <div className="relative rounded-lg border border-white/12 bg-white/[0.06] p-5 shadow-[0_24px_80px_-35px_rgba(14,165,233,0.75)] backdrop-blur">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#f43f5e_0%,#a855f7_55%,#06b6d4_100%)] text-white shadow-[0_18px_38px_-16px_rgba(244,63,94,0.8)]">
                    <Bot className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200">
                      Athena Concierge
                    </div>
                    <h3 className="text-lg font-semibold text-white">Floating guidance layer</h3>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-300">
                  Ask once and the concierge routes your next best action through the whole platform.
                </p>
                <div className="mt-5 space-y-3">
                  {conciergeActions.map((action) => (
                    <Link
                      key={action.title}
                      href={action.href}
                      className="group flex gap-3 rounded-lg border border-white/10 bg-slate-950/45 p-3 transition hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-white/[0.08]"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-cyan-200">
                        <action.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                          {action.title}
                          <ArrowRight className="h-3.5 w-3.5 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-cyan-200" />
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-400">{action.description}</p>
                      </div>
                    </Link>
                  ))}
                </div>
                <Link
                  href="/dashboard/ai/chat"
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-50"
                >
                  <MessageCircle className="h-4 w-4" />
                  Ask Athena Concierge
                </Link>
              </div>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              {abilityBands.map((band) => {
                const { headline, support } = band;
                return (
                  <div
                    key={band.orbit}
                    className="group relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.07] p-6 shadow-[0_24px_70px_-38px_rgba(244,63,94,0.85)] backdrop-blur"
                  >
                    <div
                      aria-hidden="true"
                      className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${band.accent} opacity-70 transition duration-500 group-hover:opacity-100`}
                    />
                    {headline ? (
                      <Link href={headline.href} className="relative block">
                        <div className="flex items-start justify-between gap-4">
                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${headline.gradient} text-white shadow-[0_18px_45px_-22px_rgba(244,63,94,0.75)] transition duration-500 group-hover:rotate-[-3deg] group-hover:scale-110`}
                          >
                            <headline.icon className="h-6 w-6" strokeWidth={2.25} />
                          </div>
                          <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80">
                            {headline.lane}
                          </span>
                        </div>
                        <h3 className="mt-5 text-lg font-semibold text-white">{headline.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-200">{headline.description}</p>
                        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-[11px] uppercase tracking-[0.22em] text-cyan-200">
                          <span>{headline.signal}</span>
                          <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-rose-200" />
                        </div>
                      </Link>
                    ) : (
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                        Coming soon: more signal lanes.
                      </div>
                    )}
                    <div className="relative mt-5 space-y-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/70">
                        {band.orbit}
                      </div>
                      <p className="text-xs leading-6 text-slate-300">{band.description}</p>
                      <div className="space-y-3">
                        {support.map((feature: Ability) => (
                          <Link
                            key={feature.title}
                            href={feature.href}
                            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-rose-300/40 hover:bg-white/10"
                          >
                            <div className="min-w-0">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
                                {feature.lane}
                              </div>
                              <div className="mt-1 text-sm font-semibold text-white">{feature.title}</div>
                              <div className="mt-1 text-xs leading-5 text-slate-300 line-clamp-2">
                                {feature.description}
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Social preview + operating layers */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div>
              <div className="kicker">Community lattice</div>
              <h2 className="mt-2 max-w-3xl text-3xl font-semibold text-slate-950 dark:text-white">
                A living feed, trusted circles, and guided rituals shaped for women building momentum.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                Share wins, ask bold questions, broadcast micro-classes, and co-create the support layer you wish existed.
              </p>

              <div className="mt-8 grid gap-6 sm:grid-cols-3">
                  {operatingLayers.map((layer) => (
                  <Link
                    key={layer.title}
                    href={layer.href}
                    className="group border-l-2 border-rose-300/70 pl-5 transition hover:-translate-y-0.5 hover:border-rose-500 dark:border-rose-400/40 dark:hover:border-rose-200"
                  >
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${layer.gradient} text-white shadow-lg transition group-hover:scale-105`}
                    >
                      <layer.icon className="h-5 w-5" strokeWidth={2.25} />
                    </div>
                    <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-700 dark:text-rose-300">
                      {layer.eyebrow}
                    </div>
                    <h3 className="mt-1 flex items-center gap-2 text-xl font-semibold text-slate-950 dark:text-white">
                      {layer.title}
                      <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-rose-600" />
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{layer.description}</p>
                  </Link>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/feed"
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  <Play className="h-4 w-4" />
                  Open live social feed
                </Link>
                <Link
                  href="/events"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Calendar className="h-4 w-4" />
                  Upcoming events
                </Link>
              </div>
            </div>

            <SocialFeedPreview />
          </div>
        </section>

        {/* Audience routes */}
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div>
              <div className="kicker">Routes for every growth mode</div>
              <h2 className="mt-2 max-w-3xl text-3xl font-semibold text-slate-950 dark:text-white">
                Move from public discovery into the dashboard when you are ready to act.
              </h2>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {audienceRoutes.map((route) => (
                  <Link
                    key={route.href}
                    href={route.href}
                    className="panel group flex items-center justify-between gap-4 p-5 transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-md dark:hover:border-rose-400/30"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${route.gradient} text-white shadow-md transition-transform duration-300 group-hover:scale-110`}
                      >
                        <route.icon className="h-5 w-5" strokeWidth={2.25} />
                      </div>
                      <span className="font-semibold text-slate-950 dark:text-white">{route.label}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-rose-600" />
                  </Link>
                ))}
              </div>
            </div>

            <div className="panel p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                <ShieldCheck className="h-4 w-4 text-rose-600" />
                Member promise
              </div>
              <div className="mt-4 space-y-3">
                {memberPromises.map((check) => (
                  <div key={check} className="flex gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-rose-600" />
                    {check}
                  </div>
                ))}
              </div>
              <Link
                href="/help/safety-center"
                className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-200"
              >
                Visit safety centre <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* Partner ecosystem */}
        <section className="relative overflow-hidden border-y border-slate-900/10 bg-gradient-to-b from-white via-rose-50/40 to-white dark:border-white/10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
          <div className="cyber-grid pointer-events-none absolute inset-0 opacity-20" aria-hidden="true" />
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
              <div>
                <div className="kicker">Partners & advertising</div>
                <h2 className="mt-2 max-w-3xl text-3xl font-semibold text-slate-950 dark:text-white">
                  Reach women in motion across banking, education, mining, trades, and beyond.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                  ATHENA hosts native advertising rails, sponsored learning, and verified hiring partnerships. Plug into a curated audience without compromising the member experience.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                <Link
                  href="/contact-sales?intent=partnership"
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  Become a partner
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/admin/marketing/partnerships"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-white dark:border-slate-700 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  <Building2 className="h-4 w-4" />
                  Partnership hub
                </Link>
              </div>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {partnerCategories.map((category) => (
                  <Link
                    key={category.industry}
                    href={category.href}
                    className="panel group relative overflow-hidden p-5 transition hover:-translate-y-1 hover:border-rose-200 hover:shadow-md dark:hover:border-rose-400/30"
                  >
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${category.gradient} opacity-0 blur-2xl transition duration-500 group-hover:opacity-40`}
                  />
                  <div className="relative flex items-center justify-between">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${category.gradient} text-white shadow-lg transition duration-300 group-hover:scale-110 group-hover:rotate-[-3deg]`}
                    >
                      <category.icon className="h-6 w-6" strokeWidth={2.25} />
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
                      Sector
                    </span>
                  </div>
                  <h3 className="relative mt-5 text-lg font-semibold text-slate-950 dark:text-white">{category.label}</h3>
                  <p className="relative mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{category.description}</p>
                  <div className="relative mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-300">
                      Discuss partnership
                      <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white/80 px-2 py-1 text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
                      Route: {category.routeHref.replace(/\?.*$/, '')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-12">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="kicker">Ad formats</div>
                  <h3 className="mt-2 max-w-2xl text-2xl font-semibold text-slate-950 dark:text-white">
                    Native ways to show up — never disruptive.
                  </h3>
                </div>
                <Link
                  href="/contact-sales?intent=partnership"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-rose-600 dark:text-rose-300"
                >
                  Get a media kit
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {partnerFormats.map((format) => (
                  <Link
                    key={format.label}
                    href={format.href}
                    className="panel group relative flex h-full flex-col overflow-hidden p-5 transition hover:-translate-y-1 hover:border-rose-200 hover:shadow-md dark:hover:border-rose-400/30"
                  >
                    <div
                      aria-hidden="true"
                      className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${format.gradient} opacity-80 transition group-hover:opacity-100`}
                    />
                    <div className="flex items-center justify-between">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${format.gradient} text-white shadow-md`}
                      >
                        <format.icon className="h-5 w-5" strokeWidth={2.25} />
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
                        {format.tag}
                      </span>
                    </div>
                    <h4 className="mt-4 text-base font-semibold text-slate-950 dark:text-white">{format.label}</h4>
                    <p className="mt-2 flex-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{format.description}</p>
                    <div className="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-3 text-xs font-semibold dark:border-white/10">
                      <span className="text-emerald-600 dark:text-emerald-300">{format.metric}</span>
                      <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-300">
                        Brief us <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
              <div className="space-y-6 rounded-3xl bg-slate-950 p-8 text-white shadow-[0_45px_120px_-60px_rgba(15,23,42,0.85)]">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-200">
                      Partner stories
                    </div>
                    <h3 className="mt-3 max-w-2xl text-2xl font-semibold">
                      Real outcomes from sectors already on ATHENA.
                    </h3>
                  </div>
                  <Link
                    href="/admin/marketing/partnerships"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-rose-200 transition hover:text-white"
                  >
                    Open partnership hub
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {partnerCaseStudies.map((story) => (
                    <Link
                      key={story.attribution}
                      href={story.href}
                      className="relative flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur"
                    >
                      <div
                        aria-hidden="true"
                        className={`absolute -right-12 -top-14 h-32 w-32 rounded-full bg-gradient-to-br ${story.gradient} opacity-30 blur-2xl`}
                      />
                      <div className="relative flex items-center justify-between">
                        <div
                          className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${story.gradient} text-white shadow-[0_18px_45px_-22px_rgba(244,63,94,0.65)]`}
                        >
                          <story.icon className="h-5 w-5" strokeWidth={2.25} />
                        </div>
                        <span className="rounded-full border border-emerald-300/40 bg-emerald-400/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                          {story.outcome}
                        </span>
                      </div>
                      <p className="relative flex-1 text-sm leading-6 text-slate-200">
                        &ldquo;{story.quote}&rdquo;
                      </p>
                      <div className="relative border-t border-white/10 pt-3 text-xs text-slate-300">
                        <div className="font-semibold text-white">{story.attribution}</div>
                        <div className="flex items-center gap-1">
                          {story.sector}
                          <ArrowRight className="h-3 w-3 text-slate-400" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
              <form
                className="rounded-3xl border border-slate-200/70 bg-white/85 p-6 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-950/70"
                action="/contact-sales"
                method="get"
                aria-labelledby="partner-briefing-title"
              >
                <input type="hidden" name="intent" value="partnership" />
                <div className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-300">
                    Briefing request
                  </div>
                  <h3 id="partner-briefing-title" className="text-xl font-semibold text-slate-950 dark:text-white">
                    Seed your partnership conversation now.
                  </h3>
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Pick a format and jurisdiction so our partnerships team can route you to the right rail instantly.
                  </p>
                </div>
                <div className="mt-6 space-y-4">
                  <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300" htmlFor="partner-format">
                    Preferred format
                  </label>
                  <select
                    id="partner-format"
                    name="format"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-rose-500 dark:focus:ring-rose-500/30"
                    defaultValue="learning"
                  >
                    <option value="learning">Sponsored learning track</option>
                    <option value="hiring">Featured hiring sprint</option>
                    <option value="creator">Native creator drop</option>
                    <option value="capital">Capital & grants spotlight</option>
                    <option value="event">Amplify an event</option>
                  </select>
                  <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300" htmlFor="partner-jurisdiction">
                    Jurisdiction
                  </label>
                  <select
                    id="partner-jurisdiction"
                    name="jurisdiction"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-rose-500 dark:focus:ring-rose-500/30"
                  >
                    <option value="commonwealth">Commonwealth (Federal)</option>
                    <option value="nsw">New South Wales</option>
                    <option value="vic">Victoria</option>
                    <option value="qld">Queensland</option>
                    <option value="wa">Western Australia</option>
                    <option value="intl">Outside Australia</option>
                  </select>
                  <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300" htmlFor="partner-email">
                    Work email (optional)
                  </label>
                  <input
                    id="partner-email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-rose-500 dark:focus:ring-rose-500/30"
                    autoComplete="email"
                  />
                </div>
                <button
                  type="submit"
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#f43f5e_0%,#a855f7_55%,#22d3ee_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_20px_45px_-18px_rgba(244,63,94,0.6)] transition hover:-translate-y-0.5 hover:shadow-[0_26px_60px_-20px_rgba(168,85,247,0.55)]"
                >
                  Send briefing request
                  <ArrowRight className="h-4 w-4" />
                </button>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  You&apos;ll land on the partnership intake form with these filters pre-filled.
                </p>
              </form>
            </div>

            <div className="mt-12 grid gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-5 backdrop-blur dark:border-white/10 dark:bg-white/[0.05] sm:grid-cols-3">
              {partnerStats.map((stat) => (
                <Link
                  key={stat.label}
                  href={stat.href}
                  className="group rounded-xl border border-slate-200/60 bg-white/70 p-4 transition hover:-translate-y-0.5 hover:border-rose-200 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-rose-400/30"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                    {stat.label}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-lg font-semibold text-slate-950 dark:text-white">
                    {stat.value}
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-rose-600" />
                  </div>
                  <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">{stat.detail}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-[linear-gradient(135deg,#f43f5e_0%,#a855f7_55%,#f59e0b_100%)] p-8 text-white shadow-blossom lg:p-12">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/80">
                  Launch the next chapter
                </div>
                <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold text-white lg:text-4xl">
                  One account. Every route into opportunity, support, learning, and income.
                </h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-rose-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
                >
                  Create account
                </Link>
                <Link
                  href="/dashboard/ai/chat"
                  className="inline-flex items-center justify-center rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Ask ATHENA AI
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
            <div>
              <Link href="/" className="flex items-center gap-3">
                <Image
                  src={brandLogo}
                  alt="ATHENA"
                  width={48}
                  height={48}
                  className="h-11 w-11 rounded-xl object-cover shadow-blossom ring-1 ring-rose-200/60 dark:ring-rose-400/20"
                />
                <div>
                  <div className="text-sm font-semibold tracking-wide text-slate-900 dark:text-white">ATHENA</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Career intelligence platform</div>
                </div>
              </Link>
              <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-400">
                The life operating system for women. Jobs, mentors, learning, community, AI, and earning &mdash; one account.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                <Link href="/stories" className="hover:text-rose-600 dark:hover:text-rose-300">
                  Stories
                </Link>
                <span>•</span>
                <Link href="/press" className="hover:text-rose-600 dark:hover:text-rose-300">
                  Press
                </Link>
                <span>•</span>
                <Link href="/help" className="hover:text-rose-600 dark:hover:text-rose-300">
                  Help Centre
                </Link>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-900 dark:text-white">Product</h4>
              <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li><Link href="/jobs" className="hover:text-rose-600 dark:hover:text-rose-300">Jobs</Link></li>
                <li><Link href="/mentors" className="hover:text-rose-600 dark:hover:text-rose-300">Mentors</Link></li>
                <li><Link href="/courses" className="hover:text-rose-600 dark:hover:text-rose-300">Learning paths</Link></li>
                <li><Link href="/events" className="hover:text-rose-600 dark:hover:text-rose-300">Events</Link></li>
                <li><Link href="/dashboard/ai" className="hover:text-rose-600 dark:hover:text-rose-300">AI tools</Link></li>
                <li><Link href="/pricing" className="hover:text-rose-600 dark:hover:text-rose-300">Pricing</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-900 dark:text-white">Community</h4>
              <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li><Link href="/feed" className="hover:text-rose-600 dark:hover:text-rose-300">Social feed</Link></li>
                <li><Link href="/groups" className="hover:text-rose-600 dark:hover:text-rose-300">Groups</Link></li>
                <li><Link href="/videos" className="hover:text-rose-600 dark:hover:text-rose-300">Videos</Link></li>
                <li><Link href="/dashboard/mentors/become-mentor" className="hover:text-rose-600 dark:hover:text-rose-300">Become a mentor</Link></li>
                <li><Link href="/employer" className="hover:text-rose-600 dark:hover:text-rose-300">For employers</Link></li>
                <li><Link href="/developers" className="hover:text-rose-600 dark:hover:text-rose-300">For developers</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-900 dark:text-white">Company</h4>
              <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li><Link href="/about" className="hover:text-rose-600 dark:hover:text-rose-300">About ATHENA</Link></li>
                <li><Link href="/impact" className="hover:text-rose-600 dark:hover:text-rose-300">Impact</Link></li>
                <li><Link href="/careers" className="hover:text-rose-600 dark:hover:text-rose-300">Careers</Link></li>
                <li><Link href="/press" className="hover:text-rose-600 dark:hover:text-rose-300">Press</Link></li>
                <li><Link href="/admin/marketing/partnerships" className="hover:text-rose-600 dark:hover:text-rose-300">Partners & advertising</Link></li>
                <li><Link href="/contact" className="hover:text-rose-600 dark:hover:text-rose-300">Contact</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-900 dark:text-white">Resources</h4>
              <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li><Link href="/help" className="hover:text-rose-600 dark:hover:text-rose-300">Help centre</Link></li>
                <li><Link href="/help/safety-center" className="hover:text-rose-600 dark:hover:text-rose-300">Safety centre</Link></li>
                <li><Link href="/help/community-guidelines" className="hover:text-rose-600 dark:hover:text-rose-300">Community guidelines</Link></li>
                <li><Link href="/privacy-center" className="hover:text-rose-600 dark:hover:text-rose-300">Privacy centre</Link></li>
                <li><Link href="/status" className="hover:text-rose-600 dark:hover:text-rose-300">System status</Link></li>
                <li><Link href="/changelog" className="hover:text-rose-600 dark:hover:text-rose-300">Changelog</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-4 border-t border-slate-100 pt-6 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-500 lg:flex-row lg:items-center lg:justify-between">
            <div>
              &copy; {new Date().getFullYear()} ATHENA. Built for career momentum by Munyaradzi Chenjerai.
            </div>
            <div className="flex flex-wrap gap-5">
              <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white">Privacy</Link>
              <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white">Terms</Link>
              <Link href="/cookies" className="hover:text-slate-900 dark:hover:text-white">Cookies</Link>
              <Link href="/accessibility" className="hover:text-slate-900 dark:hover:text-white">Accessibility</Link>
              <Link href="/help/safety-center" className="hover:text-slate-900 dark:hover:text-white">Safety</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
