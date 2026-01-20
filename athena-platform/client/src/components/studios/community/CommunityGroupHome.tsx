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
  Settings,
  Bell,
  BellOff,
  Share2,
  MoreHorizontal,
  Globe,
  Lock,
  UserPlus,
  MessageSquare,
  Heart,
  Bookmark,
  Image as ImageIcon,
  Link2,
  FileText,
  Calendar,
  Video,
  Pin,
  Flag,
  Send,
  Search,
  Plus,
  ChevronRight,
  Check,
  Shield,
  Crown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
// MOCK DATA
// ============================================

const MOCK_COMMUNITY: Community = {
  id: '1',
  name: 'React Developers UAE',
  description: 'A community for React developers in the UAE. Share knowledge, ask questions, network with fellow developers, and stay updated with the latest React ecosystem news.',
  isPublic: true,
  memberCount: 2847,
  postCount: 1523,
  createdAt: new Date(2024, 0, 15),
  rules: [
    'Be respectful and professional',
    'No spam or self-promotion without approval',
    'Stay on topic - React and related technologies',
    'No job postings outside the designated thread',
    'Help others learn - we were all beginners once',
  ],
  admins: [
    { id: '1', name: 'Ahmed Hassan', role: 'admin', joinedAt: new Date(2024, 0, 15) },
    { id: '2', name: 'Sarah Chen', role: 'moderator', joinedAt: new Date(2024, 1, 1) },
  ],
};

const MOCK_MEMBERS: Member[] = [
  { id: '1', name: 'Ahmed Hassan', role: 'admin', joinedAt: new Date(2024, 0, 15) },
  { id: '2', name: 'Sarah Chen', role: 'moderator', joinedAt: new Date(2024, 1, 1) },
  { id: '3', name: 'Michael Brown', role: 'member', joinedAt: new Date(2024, 2, 10) },
  { id: '4', name: 'Fatima Ali', role: 'member', joinedAt: new Date(2024, 3, 5) },
  { id: '5', name: 'James Wilson', role: 'member', joinedAt: new Date(2024, 4, 20) },
  { id: '6', name: 'Priya Patel', role: 'member', joinedAt: new Date(2024, 5, 8) },
];

const MOCK_POSTS: Post[] = [
  {
    id: '1',
    author: MOCK_MEMBERS[0],
    content: '📢 Welcome to our new members! Please introduce yourself in the comments. What brings you to React development?',
    likes: 89,
    comments: 45,
    isPinned: true,
    createdAt: new Date(Date.now() - 86400000),
  },
  {
    id: '2',
    author: MOCK_MEMBERS[2],
    content: `Just finished migrating our app from CRA to Vite. The build times went from 45s to 3s! 🚀

Here's what I learned during the process...`,
    likes: 156,
    comments: 32,
    isPinned: false,
    createdAt: new Date(Date.now() - 3600000 * 3),
  },
  {
    id: '3',
    author: MOCK_MEMBERS[3],
    content: 'Has anyone tried React 19 yet? Curious about the new use() hook and Server Components improvements.',
    likes: 67,
    comments: 28,
    isPinned: false,
    createdAt: new Date(Date.now() - 3600000 * 8),
  },
  {
    id: '4',
    author: MOCK_MEMBERS[4],
    content: 'Sharing my new React state management comparison article. Covers Zustand, Jotai, and Redux Toolkit.',
    media: { type: 'link', url: 'https://example.com', title: 'React State Management in 2026' },
    likes: 234,
    comments: 41,
    isPinned: false,
    createdAt: new Date(Date.now() - 86400000 * 2),
  },
];

const MOCK_EVENTS: CommunityEvent[] = [
  {
    id: '1',
    title: 'React Meetup - Server Components Deep Dive',
    description: 'Join us for an in-depth session on React Server Components',
    date: new Date(Date.now() + 86400000 * 7),
    attendees: 45,
    isOnline: true,
  },
  {
    id: '2',
    title: 'Networking Night - Dubai Tech Hub',
    description: 'In-person networking event for React developers',
    date: new Date(Date.now() + 86400000 * 14),
    attendees: 28,
    isOnline: false,
  },
];

// ============================================
// COMPONENTS
// ============================================

function CommunityHeader({ community }: { community: Community }) {
  const [isMember, setIsMember] = useState(true);
  const [notificationsOn, setNotificationsOn] = useState(true);

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
            {isMember ? (
              <>
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
                <Button variant="outline" onClick={() => setIsMember(false)}>
                  Joined
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsMember(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Join Group
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
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex gap-3">
          <Avatar>
            <AvatarFallback>ME</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            {isExpanded ? (
              <div className="space-y-3">
                <Textarea
                  placeholder="Share something with the group..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  autoFocus
                />
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon">
                      <ImageIcon className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Link2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <FileText className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setIsExpanded(false)}>
                      Cancel
                    </Button>
                    <Button disabled={!content.trim()}>
                      <Send className="h-4 w-4 mr-2" />
                      Post
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="w-full text-left px-4 py-3 border rounded-full text-muted-foreground cursor-text hover:bg-muted"
                onClick={() => setIsExpanded(true)}
              >
                Share something with the group...
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PostCard({ post }: { post: Post }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSaved(!saved)}
              >
                <Bookmark className={cn('h-4 w-4', saved && 'fill-current')} />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuItem>
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
          <ol className="space-y-2">
            {community.rules.map((rule, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="font-medium text-muted-foreground">{i + 1}.</span>
                <span>{rule}</span>
              </li>
            ))}
          </ol>
        </div>

        <Separator />

        <div>
          <h4 className="font-medium mb-2">Admins & Moderators</h4>
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
          />
        </div>

        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer"
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
                <Button variant="outline" size="sm">Message</Button>
              </div>
            ))}
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
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Create Event
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {events.map((event) => (
          <div
            key={event.id}
            className="p-4 border rounded-lg hover:bg-muted cursor-pointer"
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
              <Button variant="outline" size="sm">
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

// ============================================
// MAIN COMPONENT
// ============================================

export function CommunityGroupHome({ className }: { className?: string }) {
  const community = MOCK_COMMUNITY;

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
              {MOCK_POSTS.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </TabsContent>

            <TabsContent value="events" className="mt-6">
              <EventsSection events={MOCK_EVENTS} />
            </TabsContent>

            <TabsContent value="members" className="mt-6">
              <MembersSection members={MOCK_MEMBERS} />
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
                {MOCK_MEMBERS.slice(0, 5).map((member) => (
                  <Avatar key={member.id} className="border-2 border-background">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback className="text-xs">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {MOCK_MEMBERS.length > 5 && (
                  <div className="h-10 w-10 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
                    +{MOCK_MEMBERS.length - 5}
                  </div>
                )}
              </div>
              <Button variant="link" className="mt-2 px-0">
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
