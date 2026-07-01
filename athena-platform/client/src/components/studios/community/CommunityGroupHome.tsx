'use client';

/**
 * Community/Group Home
 * Phase 4: Web Client - Persona Studios
 * Step 76: Community group page with discussions
 * 
 * Features:
 * - Group header with cover
 * - Member management
 * - Discussion feed
 * - Events section
 * - Files/Resources
 * - Group settings (for admins)
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Users,
  BellOff,
  Share2,
  MoreHorizontal,
  Globe,
  Lock,
  UserPlus,
  MessageSquare,
  Heart,
  Bookmark,
  Link2,
  Calendar,
  Video,
  Pin,
  Flag,
  Search,
  Plus,
  ChevronRight,
  Check,
  Shield,
  Crown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';

// ============================================
// TYPES
// ============================================

interface Community {
  id: string;
  name: string;
  description: string;
  coverImage?: string;
  avatar?: string;
  isPublic: boolean;
  memberCount: number;
  postCount: number;
  createdAt: Date;
  rules: string[];
  admins: Member[];
}

interface Member {
  id: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'moderator' | 'member';
  joinedAt: Date;
}

interface Post {
  id: string;
  author: Member;
  content: string;
  media?: { type: 'image' | 'video' | 'link'; url: string; title?: string };
  likes: number;
  comments: number;
  isPinned: boolean;
  createdAt: Date;
}

interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  date: Date;
  attendees: number;
  isOnline: boolean;
}

// ============================================
// COMPONENTS
// ============================================

function CommunityHeader({ community }: { community: Community }) {
  return (
    <div className="relative">
      {/* Cover */}
      <div className="h-40 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl" />

      {/* Info */}
      <div className="relative px-6 pb-4">
        <div className="flex flex-col md:flex-row md:items-end gap-4 -mt-12">
          <div className="h-24 w-24 rounded-xl bg-white dark:bg-zinc-800 border-4 border-background shadow-lg flex items-center justify-center">
            <Users className="h-12 w-12 text-muted-foreground" />
          </div>

          <div className="flex-1 py-2">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{community.name}</h1>
              {community.isPublic ? (
                <Badge variant="secondary">
                  <Globe className="h-3 w-3 mr-1" />
                  Public
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <Lock className="h-3 w-3 mr-1" />
                  Private
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {community.memberCount.toLocaleString()} members • {community.postCount.toLocaleString()} posts
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled
              title="Community notifications are not connected yet"
            >
              <BellOff className="h-4 w-4" />
            </Button>
            <Button disabled title="Community membership is not connected yet">
              <UserPlus className="h-4 w-4 mr-2" />
              Join Group
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
                  <Flag className="h-4 w-4 mr-2" />
                  Report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreatePostCard() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex gap-3">
          <Avatar>
            <AvatarFallback>ME</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <Button
              variant="outline"
              className="w-full justify-start rounded-full text-muted-foreground"
              disabled
              title="Community posting is not connected yet"
            >
              Share something with the group...
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PostCard({ post }: { post: Post }) {
  const formatTime = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getRoleBadge = (role: string) => {
    if (role === 'admin') return <Crown className="h-3 w-3 text-yellow-500" />;
    if (role === 'moderator') return <Shield className="h-3 w-3 text-blue-500" />;
    return null;
  };

  return (
    <Card className={cn(post.isPinned && 'border-primary/50')}>
      <CardContent className="pt-6">
        {post.isPinned && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <Pin className="h-3 w-3" />
            Pinned post
          </div>
        )}

        <div className="flex items-start gap-3">
          <Avatar>
            <AvatarImage src={post.author.avatar} />
            <AvatarFallback>
              {post.author.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold">{post.author.name}</h4>
              {getRoleBadge(post.author.role)}
              <span className="text-sm text-muted-foreground">
                {formatTime(post.createdAt)}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-line">{post.content}</p>

            {post.media && post.media.type === 'link' && (
              <a
                href={post.media.url}
                className="mt-3 block p-3 border rounded-lg hover:bg-muted"
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="flex items-center gap-2 text-sm text-primary">
                  <Link2 className="h-4 w-4" />
                  {post.media.title || post.media.url}
                </div>
              </a>
            )}

            <div className="flex items-center gap-4 mt-4">
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
              <Button
                variant="ghost"
                size="sm"
                disabled
                title="Post saving is not connected yet"
              >
                <Bookmark className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled>
                    <Flag className="h-4 w-4 mr-2" />
                    Report
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AboutSection({ community }: { community: Community }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>About</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">{community.description}</p>

        <Separator />

        <div>
          <h4 className="font-medium mb-2">Group Rules</h4>
          {community.rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">Group rules are not connected yet.</p>
          ) : (
            <ol className="space-y-2">
              {community.rules.map((rule, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="font-medium text-muted-foreground">{i + 1}.</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <Separator />

        <div>
          <h4 className="font-medium mb-2">Admins & Moderators</h4>
          {community.admins.length === 0 ? (
            <p className="text-sm text-muted-foreground">Admin profiles are not connected yet.</p>
          ) : (
            <div className="space-y-2">
              {community.admins.map((admin) => (
                <div key={admin.id} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={admin.avatar} />
                    <AvatarFallback>
                      {admin.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <span className="text-sm font-medium">{admin.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">
                    {admin.role}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MembersSection({ members }: { members: Member[] }) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Members</CardTitle>
          <Badge variant="secondary">{members.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            disabled={members.length === 0}
          />
        </div>

        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {filteredMembers.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Member profiles are not connected yet.
              </div>
            ) : (
              filteredMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 rounded-lg"
              >
                <Avatar>
                  <AvatarImage src={member.avatar} />
                  <AvatarFallback>
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{member.name}</span>
                    {member.role === 'admin' && (
                      <Crown className="h-3 w-3 text-yellow-500" />
                    )}
                    {member.role === 'moderator' && (
                      <Shield className="h-3 w-3 text-blue-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Joined {member.joinedAt.toLocaleDateString()}
                  </p>
                </div>
                <Button variant="outline" size="sm" disabled title="Member messaging is not connected yet">
                  Message
                </Button>
              </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function EventsSection({ events }: { events: CommunityEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Upcoming Events</CardTitle>
          <Button variant="outline" size="sm" disabled title="Community event creation is not connected yet">
            <Plus className="h-4 w-4 mr-2" />
            Create Event
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {events.map((event) => (
          <div
            key={event.id}
            className="p-4 border rounded-lg"
          >
            <div className="flex items-start gap-4">
              <div className="text-center p-3 bg-primary/10 rounded-lg">
                <p className="text-sm font-medium text-primary">
                  {event.date.toLocaleDateString('en', { month: 'short' })}
                </p>
                <p className="text-2xl font-bold">
                  {event.date.getDate()}
                </p>
              </div>
              <div className="flex-1">
                <h4 className="font-medium">{event.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {event.description}
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    {event.isOnline ? (
                      <Video className="h-3 w-3" />
                    ) : (
                      <Calendar className="h-3 w-3" />
                    )}
                    {event.isOnline ? 'Online' : 'In Person'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {event.attendees} attending
                  </span>
                </div>
              </div>
              <Button variant="outline" size="sm" disabled title="Community event RSVP is not connected yet">
                <Check className="h-4 w-4 mr-2" />
                Going
              </Button>
            </div>
          </div>
        ))}

        {events.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No upcoming events</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface CommunityGroupHomeProps {
  community?: Community | null;
  members?: Member[];
  posts?: Post[];
  events?: CommunityEvent[];
  className?: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function CommunityGroupHome({
  community,
  members = [],
  posts = [],
  events = [],
  className,
}: CommunityGroupHomeProps) {
  if (!community) {
    return (
      <div className={cn('container mx-auto py-8', className)}>
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-xl font-semibold">No community profile connected</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Community details will appear here once a live group is selected.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('container mx-auto py-8 space-y-6', className)}>
      {/* Header */}
      <CommunityHeader community={community} />

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="discussion">
            <TabsList>
              <TabsTrigger value="discussion">Discussion</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="about">About</TabsTrigger>
            </TabsList>

            <TabsContent value="discussion" className="mt-6 space-y-4">
              <CreatePostCard />
              {posts.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    Community posts are not connected yet.
                  </CardContent>
                </Card>
              ) : (
                posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))
              )}
            </TabsContent>

            <TabsContent value="events" className="mt-6">
              <EventsSection events={events} />
            </TabsContent>

            <TabsContent value="members" className="mt-6">
              <MembersSection members={members} />
            </TabsContent>

            <TabsContent value="about" className="mt-6">
              <AboutSection community={community} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <AboutSection community={community} />

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Active Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex -space-x-2">
                {members.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Active members are not connected yet.
                  </div>
                ) : (
                  members.slice(0, 5).map((member) => (
                  <Avatar key={member.id} className="border-2 border-background">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback className="text-xs">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  ))
                )}
                {members.length > 5 && (
                  <div className="h-10 w-10 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
                    +{members.length - 5}
                  </div>
                )}
              </div>
              <Button variant="link" className="mt-2 px-0" disabled={members.length === 0}>
                See all members
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default CommunityGroupHome;
