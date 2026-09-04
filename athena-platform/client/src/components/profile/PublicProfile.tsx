'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Ban,
  BarChart3,
  BookOpen,
  Briefcase,
  Calendar,
  Edit,
  ExternalLink,
  Flag,
  Heart,
  Link as LinkIcon,
  Lock,
  MapPin,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Play,
  Repeat2,
  UserPlus,
} from 'lucide-react';
import { useAuth, useFollow, useProfile, useUnfollow } from '@/lib/hooks';
import { postApi, safetyApi } from '@/lib/api';
import { videoApi } from '@/lib/api-extensions';
import { formatDate, PERSONA_LABELS, cn } from '@/lib/utils';
import { renderSocialText } from '@/lib/social-text';
import { ProfileSkeleton } from '@/components/ui/loading';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ReportDialog } from '@/components/safety/ReportDialog';
import { StoryHighlights } from '@/components/profile/StoryHighlights';
import { originalAuthorName } from '@/components/community/RepostEmbed';

/**
 * A member's public profile, built on what GET /users/:id actually returns.
 *
 * The previous page read `profile.profile.avatarUrl`, `profile.workExperiences`,
 * `profile.educations`, `profile.skills[].name`, `profile.posts` and a `verified`
 * flag. None of those exist on the wire: the avatar, bio and location are
 * top-level, experience and education are `experience` and `education`, a
 * skill is `{ skill: { name } }`, and posts are not included at all. So a
 * profile rendered as a name, a persona label and "No posts yet" for everyone,
 * including members with years of history on the platform.
 */

type ProfileUser = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  avatar?: string | null;
  bio?: string | null;
  headline?: string | null;
  persona?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  currentJobTitle?: string | null;
  currentCompany?: string | null;
  createdAt: string;
  isFollowing?: boolean;
  profile?: {
    aboutMe?: string | null;
    linkedinUrl?: string | null;
    websiteUrl?: string | null;
    openToWork?: boolean | null;
  } | null;
  skills?: Array<{ id?: string; skill?: { id: string; name: string } | null }>;
  education?: Array<{
    id: string;
    institution: string;
    degree?: string | null;
    fieldOfStudy?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    current?: boolean;
  }>;
  experience?: Array<{
    id: string;
    company: string;
    title: string;
    location?: string | null;
    startDate: string;
    endDate?: string | null;
    current?: boolean;
    description?: string | null;
  }>;
  _count?: { followers?: number; following?: number; posts?: number };
};

type ProfilePost = {
  id: string;
  content: string;
  createdAt: string;
  likeCount?: number;
  commentCount?: number;
  _count?: { likes?: number; comments?: number };
  // Set on a repost or quote; the original is null once it is gone.
  repostOfId?: string | null;
  repostOf?: {
    content: string;
    author?: { displayName?: string | null; firstName?: string | null; lastName?: string | null } | null;
  } | null;
};

type ProfileVideo = {
  id: string;
  thumbnailUrl?: string | null;
  videoUrl: string;
  title?: string | null;
  description?: string | null;
  viewCount?: number;
};

function fullName(user: ProfileUser): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return user.displayName?.trim() || full || 'ATHENA member';
}

function initials(user: ProfileUser): string {
  return (
    fullName(user)
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'A'
  );
}

function location(user: ProfileUser): string {
  return [user.city, user.state, user.country].filter(Boolean).join(', ');
}

function monthYear(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
}

function dateRange(start?: string | null, end?: string | null, current?: boolean): string {
  const from = monthYear(start);
  const to = current ? 'Present' : monthYear(end);
  if (!from && !to) return '';
  return [from, to].filter(Boolean).join(' - ');
}

export function PublicProfile({ userId, backHref = '/feed' }: { userId: string; backHref?: string }) {
  const { user: viewer, isAuthenticated } = useAuth();
  const { data: profile, isLoading, error } = useProfile(userId) as {
    data: ProfileUser | undefined;
    isLoading: boolean;
    error: unknown;
  };
  const follow = useFollow();
  const unfollow = useUnfollow();
  const router = useRouter();
  const [reportOpen, setReportOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const { data: posts = [] } = useQuery({
    queryKey: ['user-posts', userId],
    queryFn: () => postApi.getUserPosts(userId),
    enabled: !!userId,
    select: (response) => (Array.isArray(response.data?.data) ? (response.data.data as ProfilePost[]) : []),
  });

  const { data: videos = [] } = useQuery({
    queryKey: ['user-videos', userId],
    queryFn: () => videoApi.getUserVideos(userId, { limit: 12 }),
    enabled: !!userId,
    select: (response) => (Array.isArray(response.data?.data) ? (response.data.data as ProfileVideo[]) : []),
  });

  // Optimistic follow state, seeded from the server and reverted only when the
  // request actually fails. Both routes are idempotent, so a stale button
  // cannot produce an "already following" error any more.
  const [following, setFollowing] = useState(false);
  const [followerDelta, setFollowerDelta] = useState(0);
  useEffect(() => {
    setFollowing(Boolean(profile?.isFollowing));
    setFollowerDelta(0);
  }, [profile?.isFollowing, userId]);

  const toggleFollow = () => {
    const next = !following;
    setFollowing(next);
    setFollowerDelta((d) => d + (next ? 1 : -1));
    const revert = () => {
      setFollowing(!next);
      setFollowerDelta((d) => d - (next ? 1 : -1));
    };
    if (next) follow.mutate(userId, { onError: revert });
    else unfollow.mutate(userId, { onError: revert });
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <ProfileSkeleton />
      </div>
    );
  }

  if (error || !profile) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    const isPrivate = status === 403;
    return (
      <div className="mx-auto max-w-4xl p-6 text-center">
        {isPrivate ? <Lock className="mx-auto mb-3 h-8 w-8 text-slate-400" /> : null}
        <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">
          {isPrivate ? 'This profile is private' : 'Profile not found'}
        </h2>
        <p className="mb-4 text-slate-500 dark:text-slate-400">
          {isPrivate
            ? 'This member has chosen not to show their profile publicly.'
            : 'The member you are looking for is not here any more, or the link is wrong.'}
        </p>
        <Link href={backHref} className="btn-primary px-4 py-2">
          Back to the feed
        </Link>
      </div>
    );
  }

  const isOwnProfile = viewer?.id === userId;
  const name = fullName(profile);
  const where = location(profile);
  const about = profile.bio?.trim() || profile.profile?.aboutMe?.trim() || '';
  const skills = (profile.skills ?? []).map((s) => s.skill?.name).filter((n): n is string => Boolean(n));
  const experience = profile.experience ?? [];
  const education = profile.education ?? [];
  const followers = Math.max(0, (profile._count?.followers ?? 0) + followerDelta);
  const links = [
    { href: profile.profile?.websiteUrl, label: 'Website' },
    { href: profile.profile?.linkedinUrl, label: 'LinkedIn' },
  ].filter((l): l is { href: string; label: string } => Boolean(l.href));

  // Blocking goes through the safety route, which also stops either side
  // messaging the other. The list of blocks, with undo, is in Settings >
  // Privacy, so the toast says where to look.
  const blockMember = async () => {
    if (
      !window.confirm(
        `Block ${name}? They will not be able to message you, and you will not see each other's posts. You can undo this in Settings > Privacy.`
      )
    ) {
      return;
    }
    setBlocking(true);
    try {
      await safetyApi.blockUser({ blockedUserId: userId });
      toast.success(`${name} is blocked. Undo it any time in Settings > Privacy.`);
      router.push(backHref);
    } catch (blockError) {
      const message = (blockError as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Could not block this member');
    } finally {
      setBlocking(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Link
        href={backHref}
        className="inline-flex items-center text-slate-500 transition hover:text-slate-700 dark:hover:text-slate-300"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Link>

      <section className="card overflow-hidden">
        <div className="relative -mx-6 -mt-6 mb-4 h-32 bg-[linear-gradient(135deg,#f43f5e_0%,#a855f7_55%,#f59e0b_100%)] md:h-44" />

        <div className="relative z-10 -mt-16 flex flex-col gap-4 px-2 md:-mt-20 md:flex-row md:items-end">
          {profile.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar}
              alt={name}
              className="h-24 w-24 rounded-full border-4 border-white object-cover md:h-32 md:w-32 dark:border-slate-900"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-rose-500 to-purple-600 text-3xl font-bold text-white md:h-32 md:w-32 dark:border-slate-900">
              {initials(profile)}
            </div>
          )}

          <div className="flex-1">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{name}</h1>
                <p className="text-slate-600 dark:text-slate-300">
                  {profile.headline ||
                    [profile.currentJobTitle, profile.currentCompany].filter(Boolean).join(' at ') ||
                    (profile.persona ? PERSONA_LABELS[profile.persona] : '') ||
                    'ATHENA member'}
                </p>
                {where && (
                  <p className="mt-1 flex items-center text-sm text-slate-500 dark:text-slate-400">
                    <MapPin className="mr-1 h-4 w-4" />
                    {where}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isOwnProfile ? (
                  <>
                    <Link href="/dashboard/insights" className="btn-outline flex items-center gap-2 px-4 py-2">
                      <BarChart3 className="h-4 w-4" />
                      <span>Insights</span>
                    </Link>
                    <Link href="/dashboard/settings/profile" className="btn-outline flex items-center gap-2 px-4 py-2">
                      <Edit className="h-4 w-4" />
                      <span>Edit profile</span>
                    </Link>
                  </>
                ) : isAuthenticated ? (
                  <>
                    <button
                      type="button"
                      onClick={toggleFollow}
                      aria-pressed={following}
                      className={cn('flex items-center gap-2 px-4 py-2', following ? 'btn-outline' : 'btn-primary')}
                    >
                      <UserPlus className="h-4 w-4" />
                      <span>{following ? 'Following' : 'Follow'}</span>
                    </button>
                    <Link
                      href={`/dashboard/messages?user=${userId}`}
                      className="btn-outline flex items-center gap-2 px-4 py-2"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span>Message</span>
                    </Link>
                    <DropdownMenu as="div" className="relative">
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="btn-outline flex items-center px-3 py-2"
                          aria-label="More options"
                          disabled={blocking}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => setReportOpen(true)}>
                          <Flag className="mr-2 h-4 w-4" />
                          Report member
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={blockMember} className="text-red-600 dark:text-red-400">
                          <Ban className="mr-2 h-4 w-4" />
                          Block member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <ReportDialog
                      open={reportOpen}
                      onClose={() => setReportOpen(false)}
                      targetType="user"
                      targetId={userId}
                      targetLabel={name}
                    />
                  </>
                ) : (
                  <Link
                    href={`/login?redirect=${encodeURIComponent(`/profile/${userId}`)}`}
                    className="btn-primary flex items-center gap-2 px-4 py-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Sign in to follow</span>
                  </Link>
                )}
              </div>
            </div>

            {profile.profile?.openToWork && (
              <div className="mt-3">
                <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  Open to work
                </Badge>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-6 border-t border-slate-100 pt-4 dark:border-slate-800">
          {[
            [followers, 'Followers'],
            [profile._count?.following ?? 0, 'Following'],
            [profile._count?.posts ?? posts.length, 'Posts'],
          ].map(([value, label]) => (
            <div key={String(label)} className="text-center">
              <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <StoryHighlights userId={userId} isOwn={isOwnProfile} displayName={name} avatar={profile.avatar ?? null} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {about && (
            <section className="card">
              <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">About</h2>
              <p className="whitespace-pre-wrap text-slate-600 dark:text-slate-300">{about}</p>
            </section>
          )}

          {videos.length > 0 && (
            <section className="card">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Reels</h2>
                <Play className="h-4 w-4 text-rose-500" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {videos.map((video) => (
                  <Link key={video.id} href={`/explore?video=${video.id}`} className="reel-tile group">
                    {video.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={video.thumbnailUrl} alt={video.title || video.description || 'Reel'} className="reel-tile-media" />
                    ) : (
                      <video src={video.videoUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    )}
                    <div className="reel-scrim" />
                    <p className="absolute inset-x-0 bottom-0 line-clamp-2 p-2 text-[11px] font-medium leading-4 text-white">
                      {video.title || video.description || 'Untitled'}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="card">
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Posts</h2>
            {posts.length > 0 ? (
              <div className="space-y-3">
                {posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/posts/${post.id}`}
                    className="block rounded-lg bg-slate-50 p-4 transition hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                  >
                    {post.repostOfId ? (
                      <>
                        <p className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                          <Repeat2 className="h-3.5 w-3.5" />
                          {post.content.trim() ? 'Quoted' : 'Reposted'}
                          {post.repostOf?.author ? ` from ${originalAuthorName(post.repostOf.author)}` : ''}
                        </p>
                        {post.content.trim() && (
                          <p className="line-clamp-2 whitespace-pre-line text-slate-900 dark:text-white">{renderSocialText(post.content)}</p>
                        )}
                        <p className="line-clamp-2 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">
                          {post.repostOf ? renderSocialText(post.repostOf.content) : 'The original post is no longer available.'}
                        </p>
                      </>
                    ) : (
                      <p className="line-clamp-3 whitespace-pre-line text-slate-900 dark:text-white">
                        {renderSocialText(post.content)}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Heart className="h-3.5 w-3.5" /> {post.likeCount ?? post._count?.likes ?? 0}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" /> {post.commentCount ?? post._count?.comments ?? 0}
                      </span>
                      <span>{formatDate(post.createdAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-slate-500 dark:text-slate-400">
                {isOwnProfile ? 'You have not posted yet.' : `${name} has not posted yet.`}
              </p>
            )}
          </section>

          {experience.length > 0 && (
            <section className="card">
              <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Experience</h2>
              <div className="space-y-4">
                {experience.map((exp) => (
                  <div key={exp.id} className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                      <Briefcase className="h-6 w-6 text-slate-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-900 dark:text-white">{exp.title}</h3>
                      <p className="text-slate-600 dark:text-slate-300">
                        {exp.company}
                        {exp.location ? ` · ${exp.location}` : ''}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {dateRange(exp.startDate, exp.endDate, exp.current)}
                      </p>
                      {exp.description && (
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{exp.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {education.length > 0 && (
            <section className="card">
              <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Education</h2>
              <div className="space-y-4">
                {education.map((edu) => (
                  <div key={edu.id} className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                      <BookOpen className="h-6 w-6 text-slate-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-900 dark:text-white">{edu.institution}</h3>
                      <p className="text-slate-600 dark:text-slate-300">
                        {[edu.degree, edu.fieldOfStudy].filter(Boolean).join(' in ')}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {dateRange(edu.startDate, edu.endDate, edu.current)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          {skills.length > 0 && (
            <section className="card">
              <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {links.length > 0 && (
            <section className="card">
              <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Links</h2>
              <div className="space-y-3">
                {links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-slate-600 transition hover:text-rose-600 dark:text-slate-300"
                  >
                    <LinkIcon className="mr-3 h-4 w-4" />
                    {link.label}
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                ))}
              </div>
            </section>
          )}

          <section className="card">
            <div className="flex items-center text-slate-500 dark:text-slate-400">
              <Calendar className="mr-2 h-4 w-4" />
              <span className="text-sm">Joined {formatDate(profile.createdAt)}</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default PublicProfile;
