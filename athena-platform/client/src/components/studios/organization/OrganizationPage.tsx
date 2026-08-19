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

import React from 'react';
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
  BellOff,
  MoreHorizontal,
  Link2,
  Mail,
  Heart,
  MessageSquare,
  Bookmark,
  Play,
  Image as ImageIcon,
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
// COMPONENTS
// ============================================

function OrganizationHeader({ org }: { org: Organization }) {
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
            <Button disabled title="Organization follow is not connected yet">
              Follow
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled
              title="Organization notifications are not connected yet"
            >
              <BellOff className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <Link2 className="h-4 w-4 mr-2" />
                  Copy link
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
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
          <Button variant="ghost" size="sm" disabled={team.length === 0}>
            See all
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {team.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Leadership data is not connected yet.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {team.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 border rounded-lg"
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
        )}
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
        {jobs.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Open positions are not connected yet.
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              className="flex items-center justify-between p-4 border rounded-lg"
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
              <Button variant="outline" size="sm" disabled title="Job application routing is not connected yet">
                Apply
              </Button>
            </div>
          ))
        )}

        <Button variant="outline" className="w-full" disabled={jobs.length === 0}>
          View all jobs
          <ExternalLink className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}

function PostCard({ post, org }: { post: Post; org: Organization }) {
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
              <h4 className="font-semibold">{org.name}</h4>
              {org.verified && <CheckCircle2 className="h-4 w-4 text-blue-500" />}
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
              disabled
              title="Post reactions are not connected yet"
            >
              <Heart className="h-4 w-4 mr-1" />
              {post.likes}
            </Button>
            <Button variant="ghost" size="sm" disabled title="Post comments are not connected yet">
              <MessageSquare className="h-4 w-4 mr-1" />
              {post.comments}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" disabled title="Post sharing is not connected yet">
              <Share2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled
              title="Post saving is not connected yet"
            >
              <Bookmark className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PostsSection({ posts, org }: { posts: Post[]; org: Organization }) {
  if (posts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Posts</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Organization posts are not connected yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} org={org} />
      ))}
    </div>
  );
}

function SidebarCard({ organizations }: { organizations: Organization[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Similar Organizations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {organizations.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Similar organizations are not connected yet.
          </div>
        ) : (
          organizations.map((organization) => (
          <div key={organization.id} className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-sm">{organization.name}</h4>
              <p className="text-xs text-muted-foreground">{organization.industry}</p>
            </div>
            <Button variant="outline" size="sm" disabled>Follow</Button>
          </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

interface OrganizationPageProps {
  organization?: Organization | null;
  team?: TeamMember[];
  jobs?: JobPosting[];
  posts?: Post[];
  similarOrganizations?: Organization[];
  className?: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function OrganizationPage({
  organization,
  team = [],
  jobs = [],
  posts = [],
  similarOrganizations = [],
  className,
}: OrganizationPageProps) {
  if (!organization) {
    return (
      <div className={cn('container mx-auto py-8', className)}>
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-xl font-semibold">No organization profile connected</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Organization details will appear here once a live profile is selected.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const org = organization;

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
              <TeamSection team={team} />
            </TabsContent>

            <TabsContent value="posts" className="mt-6">
              <PostsSection posts={posts} org={org} />
            </TabsContent>

            <TabsContent value="jobs" className="mt-6">
              <JobsSection jobs={jobs} />
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
                  {team.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      Employee profiles are not connected yet.
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-4">
                    {team.slice(0, 8).map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 p-3 border rounded-lg"
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
                        <Button variant="outline" size="sm" disabled title="Employee connections are not connected yet">
                          Connect
                        </Button>
                      </div>
                    ))}
                    </div>
                  )}
                  <Button variant="outline" className="w-full mt-4" disabled={team.length === 0}>
                    See all employees
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <SidebarCard organizations={similarOrganizations} />

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
                <span className="font-medium">{jobs.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default OrganizationPage;
