'use client';

/**
 * Organization Page
 * Phase 4: Web Client - Persona Studios
 * Step 75: Company/Organization public profile
 * 
 * Features:
 * - Organization header with branding
 * - About section
 * - Team members
 * - Open positions
 * - Recent activity/posts
 * - Follow/Connect actions
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Building2,
  MapPin,
  Globe,
  Users,
  Briefcase,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Share2,
  Bell,
  BellOff,
  MoreHorizontal,
  Link2,
  Mail,
  Phone,
  Award,
  TrendingUp,
  Heart,
  MessageSquare,
  Bookmark,
  Play,
  Image as ImageIcon,
  FileText,
  Star,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

// ============================================
// TYPES
// ============================================

interface Organization {
  id: string;
  name: string;
  logo?: string;
  coverImage?: string;
  tagline: string;
  description: string;
  industry: string;
  companySize: string;
  founded: number;
  headquarters: string;
  website: string;
  specialties: string[];
  verified: boolean;
  followers: number;
  employees: number;
}

interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  isYou?: boolean;
}

interface JobPosting {
  id: string;
  title: string;
  location: string;
  type: string;
  postedAt: Date;
  applicants: number;
}

interface Post {
  id: string;
  content: string;
  media?: { type: 'image' | 'video'; url: string };
  likes: number;
  comments: number;
  createdAt: Date;
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_ORGANIZATION: Organization = {
  id: '1',
  name: 'TechVentures Inc',
  tagline: 'Building the future of work',
  description: `TechVentures Inc is a leading technology company focused on creating innovative solutions for the modern workplace. We believe in empowering teams with tools that enhance productivity, collaboration, and creativity.

Our mission is to transform how organizations operate by providing cutting-edge software solutions that scale with their needs. From startups to enterprises, we serve clients across the globe with our suite of products.

We're proud to be at the forefront of workplace innovation, constantly pushing boundaries and exploring new technologies to deliver exceptional value to our customers.`,
  industry: 'Technology',
  companySize: '501-1,000 employees',
  founded: 2015,
  headquarters: 'Dubai, UAE',
  website: 'https://techventures.example.com',
  specialties: ['SaaS', 'Enterprise Software', 'AI/ML', 'Cloud Computing', 'Remote Work Tools'],
  verified: true,
  followers: 24500,
  employees: 847,
};

const MOCK_TEAM: TeamMember[] = [
  { id: '1', name: 'Ahmed Hassan', role: 'CEO & Founder', avatar: '' },
  { id: '2', name: 'Sarah Mitchell', role: 'CTO', avatar: '' },
  { id: '3', name: 'Michael Chen', role: 'VP of Engineering', avatar: '' },
  { id: '4', name: 'Fatima Al-Rashid', role: 'Head of Product', avatar: '' },
  { id: '5', name: 'James Wilson', role: 'Head of Design', avatar: '' },
  { id: '6', name: 'Priya Sharma', role: 'Head of HR', avatar: '' },
];

const MOCK_JOBS: JobPosting[] = [
  {
    id: '1',
    title: 'Senior Software Engineer',
    location: 'Dubai, UAE',
    type: 'Full-time',
    postedAt: new Date(Date.now() - 86400000),
    applicants: 45,
  },
  {
    id: '2',
    title: 'Product Manager',
    location: 'Remote',
    type: 'Full-time',
    postedAt: new Date(Date.now() - 172800000),
    applicants: 32,
  },
  {
    id: '3',
    title: 'UX Designer',
    location: 'Abu Dhabi, UAE',
    type: 'Full-time',
    postedAt: new Date(Date.now() - 259200000),
    applicants: 28,
  },
  {
    id: '4',
    title: 'DevOps Engineer',
    location: 'Dubai, UAE',
    type: 'Full-time',
    postedAt: new Date(Date.now() - 345600000),
    applicants: 19,
  },
];

const MOCK_POSTS: Post[] = [
  {
    id: '1',
    content: `We're excited to announce our latest product launch! 🚀 After months of development, our new AI-powered analytics platform is now available. It helps teams make data-driven decisions faster than ever.`,
    media: { type: 'image', url: '' },
    likes: 342,
    comments: 28,
    createdAt: new Date(Date.now() - 3600000),
  },
  {
    id: '2',
    content: `Proud to share that TechVentures has been recognized as one of the top 50 places to work in the UAE! Thank you to our amazing team for making this possible. 🏆`,
    likes: 567,
    comments: 45,
    createdAt: new Date(Date.now() - 86400000),
  },
  {
    id: '3',
    content: `Join us for our upcoming webinar on "The Future of Remote Work" featuring industry experts. Register now - link in bio! 📅`,
    media: { type: 'video', url: '' },
    likes: 189,
    comments: 12,
    createdAt: new Date(Date.now() - 172800000),
  },
];

// ============================================
// COMPONENTS
// ============================================

function OrganizationHeader({ org }: { org: Organization }) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [notificationsOn, setNotificationsOn] = useState(false);

  return (
    <div className="relative">
      {/* Cover Image */}
      <div className="h-48 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl" />

      {/* Profile Section */}
      <div className="relative px-6 pb-4">
        <div className="flex flex-col md:flex-row md:items-end gap-4 -mt-16">
          {/* Logo */}
          <div className="h-32 w-32 rounded-xl bg-white dark:bg-zinc-800 border-4 border-background shadow-lg flex items-center justify-center">
            <Building2 className="h-16 w-16 text-muted-foreground" />
          </div>

          {/* Info */}
          <div className="flex-1 py-2">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{org.name}</h1>
              {org.verified && (
                <CheckCircle2 className="h-6 w-6 text-blue-500" />
              )}
            </div>
            <p className="text-muted-foreground">{org.tagline}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Briefcase className="h-4 w-4" />
                {org.industry}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {org.headquarters}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {org.followers.toLocaleString()} followers
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant={isFollowing ? 'outline' : 'default'}
              onClick={() => setIsFollowing(!isFollowing)}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </Button>
            {isFollowing && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setNotificationsOn(!notificationsOn)}
              >
                {notificationsOn ? (
                  <Bell className="h-4 w-4" />
                ) : (
                  <BellOff className="h-4 w-4" />
                )}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link2 className="h-4 w-4 mr-2" />
                  Copy link
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Mail className="h-4 w-4 mr-2" />
                  Contact
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}

function AboutSection({ org }: { org: Organization }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>About</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="whitespace-pre-line text-muted-foreground">
          {org.description}
        </div>

        <Separator />

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium mb-2">Overview</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-3">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <a href={org.website} className="text-primary hover:underline">
                  {org.website.replace('https://', '')}
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span>{org.industry}</span>
              </div>
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{org.companySize}</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{org.headquarters}</span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Founded {org.founded}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Specialties</h4>
            <div className="flex flex-wrap gap-2">
              {org.specialties.map((specialty) => (
                <Badge key={specialty} variant="secondary">
                  {specialty}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TeamSection({ team }: { team: TeamMember[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Leadership Team</CardTitle>
          <Button variant="ghost" size="sm">
            See all
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {team.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted cursor-pointer"
            >
              <Avatar>
                <AvatarImage src={member.avatar} />
                <AvatarFallback>
                  {member.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <h4 className="font-medium text-sm">{member.name}</h4>
                <p className="text-xs text-muted-foreground">{member.role}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function JobsSection({ jobs }: { jobs: JobPosting[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Open Positions</CardTitle>
          <Badge variant="secondary">{jobs.length} jobs</Badge>
        </div>
        <CardDescription>
          Join our team and help build the future
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted cursor-pointer"
          >
            <div>
              <h4 className="font-medium">{job.title}</h4>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {job.location}
                </span>
                <span>{job.type}</span>
                <span>{job.applicants} applicants</span>
              </div>
            </div>
            <Button variant="outline" size="sm">
              Apply
            </Button>
          </div>
        ))}

        <Button variant="outline" className="w-full">
          View all jobs
          <ExternalLink className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}

function PostCard({ post, orgName }: { post: Post; orgName: string }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  const formatTime = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
            <Building2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold">{orgName}</h4>
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-xs text-muted-foreground">{formatTime(post.createdAt)}</p>
          </div>
        </div>

        <div className="mt-4">
          <p className="whitespace-pre-line">{post.content}</p>
        </div>

        {post.media && (
          <div className="mt-4 rounded-lg bg-muted h-64 flex items-center justify-center">
            {post.media.type === 'image' ? (
              <ImageIcon className="h-12 w-12 text-muted-foreground" />
            ) : (
              <Play className="h-12 w-12 text-muted-foreground" />
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLiked(!liked)}
              className={cn(liked && 'text-red-500')}
            >
              <Heart className={cn('h-4 w-4 mr-1', liked && 'fill-current')} />
              {post.likes + (liked ? 1 : 0)}
            </Button>
            <Button variant="ghost" size="sm">
              <MessageSquare className="h-4 w-4 mr-1" />
              {post.comments}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon">
              <Share2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSaved(!saved)}
            >
              <Bookmark className={cn('h-4 w-4', saved && 'fill-current')} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PostsSection({ posts, orgName }: { posts: Post[]; orgName: string }) {
  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} orgName={orgName} />
      ))}
    </div>
  );
}

function SidebarCard({ org }: { org: Organization }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Similar Organizations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-sm">Tech Company {i}</h4>
              <p className="text-xs text-muted-foreground">Technology</p>
            </div>
            <Button variant="outline" size="sm">Follow</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function OrganizationPage({ className }: { className?: string }) {
  const org = MOCK_ORGANIZATION;

  return (
    <div className={cn('container mx-auto py-8 space-y-6', className)}>
      {/* Header */}
      <OrganizationHeader org={org} />

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="about">
            <TabsList>
              <TabsTrigger value="about">About</TabsTrigger>
              <TabsTrigger value="posts">Posts</TabsTrigger>
              <TabsTrigger value="jobs">Jobs</TabsTrigger>
              <TabsTrigger value="people">People</TabsTrigger>
            </TabsList>

            <TabsContent value="about" className="mt-6 space-y-6">
              <AboutSection org={org} />
              <TeamSection team={MOCK_TEAM} />
            </TabsContent>

            <TabsContent value="posts" className="mt-6">
              <PostsSection posts={MOCK_POSTS} orgName={org.name} />
            </TabsContent>

            <TabsContent value="jobs" className="mt-6">
              <JobsSection jobs={MOCK_JOBS} />
            </TabsContent>

            <TabsContent value="people" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Employees on Athena</CardTitle>
                  <CardDescription>
                    {org.employees} employees
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {MOCK_TEAM.concat(MOCK_TEAM).slice(0, 8).map((member, i) => (
                      <div
                        key={`${member.id}-${i}`}
                        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted cursor-pointer"
                      >
                        <Avatar>
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback>
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{member.name}</h4>
                          <p className="text-xs text-muted-foreground">{member.role}</p>
                        </div>
                        <Button variant="outline" size="sm">Connect</Button>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" className="w-full mt-4">
                    See all employees
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <SidebarCard org={org} />

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Followers</span>
                <span className="font-medium">{org.followers.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Employees</span>
                <span className="font-medium">{org.employees}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Open Jobs</span>
                <span className="font-medium">{MOCK_JOBS.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default OrganizationPage;
