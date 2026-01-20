'use client';

/**
 * Candidate Profile Viewer
 * Phase 4: Web Client - Persona Studios
 * Step 68: Full profile view with AI insights
 * 
 * Features:
 * - Complete candidate profile
 * - AI-powered insights and recommendations
 * - Comparison with job requirements
 * - Interview history
 * - Skills verification
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  GraduationCap,
  Calendar,
  Star,
  Download,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  TrendingUp,
  Award,
  Clock,
  FileText,
  Link2,
  Play,
  ThumbsUp,
  ThumbsDown,
  Share2,
  MoreHorizontal,
  ChevronRight,
  Shield,
  Target,
  Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ============================================
// TYPES
// ============================================

interface Experience {
  id: string;
  title: string;
  company: string;
  location: string;
  startDate: Date;
  endDate?: Date;
  current: boolean;
  description: string[];
  skills: string[];
}

interface Education {
  id: string;
  degree: string;
  institution: string;
  location: string;
  graduationDate: Date;
  gpa?: number;
  honors?: string[];
}

interface Skill {
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  yearsOfExperience: number;
  verified: boolean;
  endorsements?: number;
}

interface Interview {
  id: string;
  type: 'phone' | 'video' | 'onsite' | 'technical';
  date: Date;
  interviewer: string;
  rating: number;
  feedback?: string;
  status: 'completed' | 'scheduled' | 'cancelled';
}

interface AIInsight {
  type: 'strength' | 'concern' | 'recommendation';
  title: string;
  description: string;
}

interface CandidateProfile {
  id: string;
  name: string;
  avatar?: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  resumeUrl?: string;
  matchScore: number;
  experience: Experience[];
  education: Education[];
  skills: Skill[];
  interviews: Interview[];
  aiInsights: AIInsight[];
  appliedAt: Date;
  source: string;
  expectedSalary?: { min: number; max: number };
  availability: string;
  references?: number;
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_CANDIDATE: CandidateProfile = {
  id: '1',
  name: 'Sarah Chen',
  avatar: '/avatars/sarah.jpg',
  headline: 'Senior Product Manager | B2B SaaS | Ex-Google, Ex-Stripe',
  email: 'sarah.chen@email.com',
  phone: '+1 (555) 123-4567',
  location: 'San Francisco, CA',
  linkedinUrl: 'https://linkedin.com/in/sarahchen',
  portfolioUrl: 'https://sarahchen.com',
  resumeUrl: '/resumes/sarah-chen.pdf',
  matchScore: 94,
  source: 'LinkedIn',
  appliedAt: new Date(2026, 0, 15),
  expectedSalary: { min: 180000, max: 220000 },
  availability: 'Available in 2 weeks',
  references: 3,
  experience: [
    {
      id: '1',
      title: 'Senior Product Manager',
      company: 'TechCorp',
      location: 'San Francisco, CA',
      startDate: new Date(2023, 5),
      current: true,
      description: [
        'Led product strategy for enterprise platform serving 500+ customers',
        'Increased user engagement by 40% through data-driven feature development',
        'Managed cross-functional team of 12 engineers and designers',
      ],
      skills: ['Product Strategy', 'User Research', 'Data Analysis', 'Agile'],
    },
    {
      id: '2',
      title: 'Product Manager',
      company: 'Google',
      location: 'Mountain View, CA',
      startDate: new Date(2020, 2),
      endDate: new Date(2023, 4),
      current: false,
      description: [
        'Owned product roadmap for Google Workspace integrations',
        'Launched 3 major features with 10M+ users',
        'Collaborated with UX research to improve user satisfaction scores by 25%',
      ],
      skills: ['A/B Testing', 'Roadmapping', 'Stakeholder Management'],
    },
    {
      id: '3',
      title: 'Associate Product Manager',
      company: 'Stripe',
      location: 'San Francisco, CA',
      startDate: new Date(2018, 7),
      endDate: new Date(2020, 1),
      current: false,
      description: [
        'Supported launch of Stripe Terminal point-of-sale product',
        'Conducted competitive analysis and market research',
        'Created product specifications and user stories',
      ],
      skills: ['Fintech', 'API Products', 'Documentation'],
    },
  ],
  education: [
    {
      id: '1',
      degree: 'MBA',
      institution: 'Stanford Graduate School of Business',
      location: 'Stanford, CA',
      graduationDate: new Date(2018, 5),
      honors: ['Dean\'s List', 'Product Management Club President'],
    },
    {
      id: '2',
      degree: 'BS Computer Science',
      institution: 'UC Berkeley',
      location: 'Berkeley, CA',
      graduationDate: new Date(2016, 5),
      gpa: 3.8,
    },
  ],
  skills: [
    { name: 'Product Strategy', level: 'expert', yearsOfExperience: 6, verified: true, endorsements: 45 },
    { name: 'User Research', level: 'advanced', yearsOfExperience: 5, verified: true, endorsements: 32 },
    { name: 'Data Analysis', level: 'advanced', yearsOfExperience: 5, verified: true, endorsements: 28 },
    { name: 'Agile/Scrum', level: 'expert', yearsOfExperience: 6, verified: true, endorsements: 38 },
    { name: 'SQL', level: 'intermediate', yearsOfExperience: 4, verified: false, endorsements: 15 },
    { name: 'Figma', level: 'intermediate', yearsOfExperience: 3, verified: false, endorsements: 12 },
    { name: 'A/B Testing', level: 'advanced', yearsOfExperience: 4, verified: true, endorsements: 22 },
    { name: 'Roadmapping', level: 'expert', yearsOfExperience: 5, verified: true, endorsements: 35 },
  ],
  interviews: [
    {
      id: '1',
      type: 'phone',
      date: new Date(2026, 0, 16),
      interviewer: 'John Smith (Recruiter)',
      rating: 4,
      feedback: 'Strong communication skills. Good understanding of the role.',
      status: 'completed',
    },
    {
      id: '2',
      type: 'video',
      date: new Date(2026, 0, 20),
      interviewer: 'Maria Garcia (Hiring Manager)',
      rating: 5,
      feedback: 'Excellent product sense. Great examples from previous experience.',
      status: 'completed',
    },
    {
      id: '3',
      type: 'technical',
      date: new Date(2026, 0, 25),
      interviewer: 'Panel Interview',
      rating: 0,
      status: 'scheduled',
    },
  ],
  aiInsights: [
    {
      type: 'strength',
      title: 'Strong Product Experience',
      description: '6+ years at top tech companies (Google, Stripe) with proven track record of shipping successful products.',
    },
    {
      type: 'strength',
      title: 'Technical Background',
      description: 'CS degree from UC Berkeley provides strong technical foundation for B2B SaaS product management.',
    },
    {
      type: 'concern',
      title: 'Salary Expectations',
      description: 'Expected salary range ($180-220k) is at the higher end of the budgeted range for this position.',
    },
    {
      type: 'recommendation',
      title: 'Discuss Growth Opportunities',
      description: 'Candidate appears motivated by career growth. Highlight leadership path and mentorship opportunities.',
    },
  ],
};

const JOB_REQUIREMENTS = [
  { skill: 'Product Strategy', required: true, match: true },
  { skill: 'B2B SaaS Experience', required: true, match: true },
  { skill: 'Agile/Scrum', required: true, match: true },
  { skill: 'Data Analysis', required: true, match: true },
  { skill: 'User Research', required: false, match: true },
  { skill: 'Team Leadership', required: true, match: true },
  { skill: 'API Products', required: false, match: true },
  { skill: 'Enterprise Sales', required: false, match: false },
];

// ============================================
// COMPONENTS
// ============================================

const SKILL_LEVELS: Record<string, { label: string; width: number }> = {
  beginner: { label: 'Beginner', width: 25 },
  intermediate: { label: 'Intermediate', width: 50 },
  advanced: { label: 'Advanced', width: 75 },
  expert: { label: 'Expert', width: 100 },
};

function MatchScoreCard({ score, requirements }: { score: number; requirements: typeof JOB_REQUIREMENTS }) {
  const matched = requirements.filter(r => r.match).length;
  const total = requirements.length;
  const requiredMatched = requirements.filter(r => r.required && r.match).length;
  const requiredTotal = requirements.filter(r => r.required).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5" />
            AI Match Analysis
          </CardTitle>
          <Badge className={cn(
            score >= 90 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 'bg-blue-100 text-blue-700'
          )}>
            {score}% Match
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Match</span>
            <span className="font-medium">{matched}/{total} skills</span>
          </div>
          <Progress value={(matched / total) * 100} className="h-2" />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Required Skills</span>
            <span className="font-medium text-emerald-600">{requiredMatched}/{requiredTotal}</span>
          </div>
          <Progress value={(requiredMatched / requiredTotal) * 100} className="h-2 [&>div]:bg-emerald-500" />
        </div>

        <Separator />

        <div className="space-y-2">
          {requirements.map((req) => (
            <div key={req.skill} className="flex items-center justify-between text-sm">
              <span className={cn(!req.match && 'text-muted-foreground')}>
                {req.skill}
                {req.required && <span className="text-red-500 ml-1">*</span>}
              </span>
              {req.match ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AIInsightsCard({ insights }: { insights: AIInsight[] }) {
  const getIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'strength':
        return <TrendingUp className="h-4 w-4 text-emerald-500" />;
      case 'concern':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'recommendation':
        return <Lightbulb className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          AI Insights
        </CardTitle>
        <CardDescription>Powered by Athena AI</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {insights.map((insight, index) => (
          <div
            key={index}
            className={cn(
              'p-3 rounded-lg border',
              insight.type === 'strength' && 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800',
              insight.type === 'concern' && 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-800',
              insight.type === 'recommendation' && 'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800'
            )}
          >
            <div className="flex items-start gap-3">
              {getIcon(insight.type)}
              <div>
                <p className="font-medium text-sm">{insight.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ExperienceTimeline({ experience }: { experience: Experience[] }) {
  return (
    <div className="space-y-6">
      {experience.map((exp, index) => (
        <div key={exp.id} className="relative pl-8">
          {index < experience.length - 1 && (
            <div className="absolute left-3 top-8 bottom-0 w-0.5 bg-zinc-200 dark:bg-zinc-800" />
          )}
          <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Briefcase className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium">{exp.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {exp.company} • {exp.location}
                </p>
              </div>
              <Badge variant={exp.current ? 'default' : 'outline'}>
                {exp.startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                {' - '}
                {exp.current ? 'Present' : exp.endDate?.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </Badge>
            </div>
            <ul className="mt-2 space-y-1">
              {exp.description.map((item, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-1 mt-2">
              {exp.skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SkillsGrid({ skills }: { skills: Skill[] }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {skills.map((skill) => (
        <div key={skill.name} className="p-3 border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{skill.name}</span>
              {skill.verified && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Shield className="h-3.5 w-3.5 text-emerald-500" />
                    </TooltipTrigger>
                    <TooltipContent>Verified skill</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {skill.yearsOfExperience} yrs
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Progress 
              value={SKILL_LEVELS[skill.level].width} 
              className="h-1.5 flex-1" 
            />
            <span className="text-xs text-muted-foreground w-20">
              {SKILL_LEVELS[skill.level].label}
            </span>
          </div>
          {skill.endorsements && (
            <p className="text-xs text-muted-foreground mt-1">
              {skill.endorsements} endorsements
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function InterviewHistory({ interviews }: { interviews: Interview[] }) {
  const typeLabels: Record<string, string> = {
    phone: 'Phone Screen',
    video: 'Video Interview',
    onsite: 'Onsite',
    technical: 'Technical Interview',
  };

  return (
    <div className="space-y-4">
      {interviews.map((interview) => (
        <div
          key={interview.id}
          className={cn(
            'p-4 border rounded-lg',
            interview.status === 'scheduled' && 'border-blue-200 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800'
          )}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{typeLabels[interview.type]}</h4>
                {interview.status === 'scheduled' && (
                  <Badge>Upcoming</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {interview.interviewer}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">
                {interview.date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
              {interview.rating > 0 && (
                <div className="flex items-center gap-0.5 justify-end mt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        'h-3 w-3',
                        star <= interview.rating
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-zinc-300'
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
          {interview.feedback && (
            <p className="text-sm text-muted-foreground mt-2 italic">
              "{interview.feedback}"
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function CandidateProfileViewer({
  candidate = MOCK_CANDIDATE,
  onBack,
  className,
}: {
  candidate?: CandidateProfile;
  onBack?: () => void;
  className?: string;
}) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className={cn('min-h-screen bg-zinc-50 dark:bg-zinc-950', className)}>
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {onBack && (
                <Button variant="ghost" size="icon" onClick={onBack}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={candidate.avatar} alt={candidate.name} />
                  <AvatarFallback className="text-lg">
                    {candidate.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-xl font-bold">{candidate.name}</h1>
                  <p className="text-sm text-muted-foreground">{candidate.headline}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                Schedule
              </Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                <ThumbsUp className="h-4 w-4 mr-2" />
                Move Forward
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share profile
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Download className="h-4 w-4 mr-2" />
                    Download resume
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600">
                    <ThumbsDown className="h-4 w-4 mr-2" />
                    Reject candidate
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="experience">Experience</TabsTrigger>
                <TabsTrigger value="skills">Skills</TabsTrigger>
                <TabsTrigger value="interviews">Interviews</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6 mt-6">
                {/* Contact Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                          <Mail className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Email</p>
                          <p className="font-medium">{candidate.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                          <Phone className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Phone</p>
                          <p className="font-medium">{candidate.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                          <MapPin className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Location</p>
                          <p className="font-medium">{candidate.location}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                          <Clock className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Availability</p>
                          <p className="font-medium">{candidate.availability}</p>
                        </div>
                      </div>
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <div className="flex items-center gap-4">
                      {candidate.linkedinUrl && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={candidate.linkedinUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            LinkedIn
                          </a>
                        </Button>
                      )}
                      {candidate.portfolioUrl && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={candidate.portfolioUrl} target="_blank" rel="noopener noreferrer">
                            <Link2 className="h-4 w-4 mr-2" />
                            Portfolio
                          </a>
                        </Button>
                      )}
                      {candidate.resumeUrl && (
                        <Button variant="outline" size="sm">
                          <FileText className="h-4 w-4 mr-2" />
                          Resume
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Stats */}
                <div className="grid md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-3xl font-bold">
                          {candidate.experience.reduce((sum, exp) => {
                            const end = exp.endDate || new Date();
                            const years = (end.getTime() - exp.startDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
                            return sum + years;
                          }, 0).toFixed(0)}
                        </p>
                        <p className="text-sm text-muted-foreground">Years Experience</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-3xl font-bold">{candidate.skills.length}</p>
                        <p className="text-sm text-muted-foreground">Skills Listed</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-3xl font-bold">{candidate.references || 0}</p>
                        <p className="text-sm text-muted-foreground">References</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-3xl font-bold text-emerald-600">{candidate.matchScore}%</p>
                        <p className="text-sm text-muted-foreground">Match Score</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Education */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <GraduationCap className="h-5 w-5" />
                      Education
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {candidate.education.map((edu) => (
                      <div key={edu.id} className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                          <Award className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h4 className="font-medium">{edu.degree}</h4>
                          <p className="text-sm text-muted-foreground">
                            {edu.institution} • {edu.location}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Class of {edu.graduationDate.getFullYear()}
                            {edu.gpa && ` • GPA: ${edu.gpa}`}
                          </p>
                          {edu.honors && edu.honors.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {edu.honors.map((honor) => (
                                <Badge key={honor} variant="outline" className="text-xs">
                                  {honor}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="experience" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Work Experience</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ExperienceTimeline experience={candidate.experience} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="skills" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Skills & Expertise</CardTitle>
                    <CardDescription>
                      {candidate.skills.filter(s => s.verified).length} verified skills
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SkillsGrid skills={candidate.skills} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="interviews" className="mt-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Interview History</CardTitle>
                        <CardDescription>
                          {candidate.interviews.filter(i => i.status === 'completed').length} completed,{' '}
                          {candidate.interviews.filter(i => i.status === 'scheduled').length} scheduled
                        </CardDescription>
                      </div>
                      <Button>
                        <Calendar className="h-4 w-4 mr-2" />
                        Schedule Interview
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <InterviewHistory interviews={candidate.interviews} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <MatchScoreCard score={candidate.matchScore} requirements={JOB_REQUIREMENTS} />
            <AIInsightsCard insights={candidate.aiInsights} />

            {/* Application Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Application Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Applied</span>
                  <span>{candidate.appliedAt.toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Source</span>
                  <Badge variant="outline">{candidate.source}</Badge>
                </div>
                {candidate.expectedSalary && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expected Salary</span>
                    <span>
                      ${(candidate.expectedSalary.min / 1000).toFixed(0)}k - ${(candidate.expectedSalary.max / 1000).toFixed(0)}k
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CandidateProfileViewer;
