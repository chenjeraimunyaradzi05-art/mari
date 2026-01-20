'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin,
  Briefcase,
  Calendar,
  Users,
  Link as LinkIcon,
  Mail,
  MessageCircle,
  UserPlus,
  Award,
  BookOpen,
  Star,
  ExternalLink,
  ArrowLeft,
  Edit,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { useProfile, useFollowUser, useUnfollowUser, useAuth } from '@/lib/hooks';
import { formatDate, getFullName, getInitials, PERSONA_LABELS, cn } from '@/lib/utils';
import { Loading, ProfileSkeleton } from '@/components/ui/loading';
import { Badge } from '@/components/ui/badge';

export default function ProfilePage() {
  const params = useParams();
  const { user: currentUser } = useAuth();
  const userId = params.id as string;
  const { data: profile, isLoading, error } = useProfile(userId);
  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();

  const isOwnProfile = currentUser?.id === userId;
  const isFollowing = profile?.isFollowing;
  const safetyScore = profile?.profile?.safetyScore;
  const badges: string[] =
    profile?.profile?.badges ||
    (profile?.verified ? ['Verified Member', 'Trusted Creator'] : ['Community Member']);

  const handleFollowToggle = () => {
    if (isFollowing) {
      unfollowUser.mutate(userId);
    } else {
      followUser.mutate(userId);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <ProfileSkeleton />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Profile Not Found
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          The profile you're looking for doesn't exist.
        </p>
        <Link href="/dashboard/community" className="btn-primary px-4 py-2">
          Go to Community
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Back Button */}
      <Link
        href="/dashboard/community"
        className="inline-flex items-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Community
      </Link>

      {/* Profile Header */}
      <div className="card overflow-hidden">
        {/* Cover Image */}
        <div className="h-32 md:h-48 -mx-6 -mt-6 mb-4 bg-gradient-to-r from-primary-500 to-secondary-500 relative">
          {profile.profile?.coverUrl && (
            <img
              src={profile.profile.coverUrl}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Avatar and Info */}
        <div className="flex flex-col md:flex-row md:items-end gap-4 -mt-16 md:-mt-20 relative z-10 px-4">
          <div className="relative">
            {profile.profile?.avatarUrl ? (
              <img
                src={profile.profile.avatarUrl}
                alt={getFullName(profile.firstName || '', profile.lastName || '')}
                className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-white dark:border-gray-900"
              />
            ) : (
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 font-bold text-3xl border-4 border-white dark:border-gray-900">
                {getInitials(profile.firstName || '', profile.lastName || '')}
              </div>
            )}
            {profile.verified && (
              <div className="absolute bottom-2 right-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900">
                <Award className="w-4 h-4 text-white" />
              </div>
            )}
          </div>

          <div className="flex-1">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {getFullName(profile.firstName || '', profile.lastName || '')}
                </h1>
                <p className="text-gray-600 dark:text-gray-300">
                  {profile.profile?.headline || PERSONA_LABELS[profile.persona] || 'ATHENA Member'}
                </p>
                {profile.profile?.location && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center mt-1">
                    <MapPin className="w-4 h-4 mr-1" />
                    {profile.profile.location}
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {isOwnProfile ? (
                  <Link
                    href="/dashboard/settings/profile"
                    className="btn-outline px-4 py-2 flex items-center space-x-2"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit Profile</span>
                  </Link>
                ) : (
                  <>
                    <button
                      onClick={handleFollowToggle}
                      disabled={followUser.isPending || unfollowUser.isPending}
                      className={cn(
                        'px-4 py-2 flex items-center space-x-2',
                        isFollowing ? 'btn-outline' : 'btn-primary'
                      )}
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>{isFollowing ? 'Following' : 'Follow'}</span>
                    </button>
                    <Link
                      href={`/dashboard/messages?user=${userId}`}
                      className="btn-outline px-4 py-2 flex items-center space-x-2"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Message</span>
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-800 px-3 py-1 text-xs text-gray-600 dark:text-gray-300">
                {typeof safetyScore === 'number' ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Safety Score: <span className="font-semibold text-gray-900 dark:text-white">{safetyScore}</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-gray-400" />
                    Safety Score: <span className="font-semibold">Private</span>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {badges.map((badge) => (
                  <Badge
                    key={badge}
                    className="bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                  >
                    {badge}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center space-x-6 mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {profile._count?.followers || 0}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Followers</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {profile._count?.following || 0}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Following</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {profile._count?.posts || 0}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Posts</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* About */}
          {profile.profile?.bio && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                About
              </h2>
              <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                {profile.profile.bio}
              </p>
            </div>
          )}

          {/* Experience */}
          {profile.workExperiences?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Experience
              </h2>
              <div className="space-y-4">
                {profile.workExperiences.map((exp: any) => (
                  <div key={exp.id} className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Briefcase className="w-6 h-6 text-gray-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {exp.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300">{exp.company}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(exp.startDate)} -{' '}
                        {exp.current ? 'Present' : formatDate(exp.endDate)}
                      </p>
                      {exp.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                          {exp.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {profile.educations?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Education
              </h2>
              <div className="space-y-4">
                {profile.educations.map((edu: any) => (
                  <div key={edu.id} className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-6 h-6 text-gray-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {edu.institution}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        {edu.degree} {edu.field && `in ${edu.field}`}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {edu.startYear} - {edu.endYear || 'Present'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Posts */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recent Activity
            </h2>
            {profile.posts?.length > 0 ? (
              <div className="space-y-4">
                {profile.posts.slice(0, 3).map((post: any) => (
                  <Link
                    key={post.id}
                    href={`/dashboard/community/post/${post.id}`}
                    className="block p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  >
                    <p className="text-gray-900 dark:text-white line-clamp-2">
                      {post.content}
                    </p>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                      <span>{post._count?.likes || 0} likes</span>
                      <span>{post._count?.comments || 0} comments</span>
                      <span>{formatDate(post.createdAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No posts yet
              </p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Skills */}
          {profile.skills?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Skills
              </h2>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill: any) => (
                  <Badge key={skill.id} variant="secondary">
                    {skill.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Links
            </h2>
            <div className="space-y-3">
              {profile.email && !profile.hideEmail && (
                <a
                  href={`mailto:${profile.email}`}
                  className="flex items-center text-gray-600 dark:text-gray-300 hover:text-primary-600 transition"
                >
                  <Mail className="w-4 h-4 mr-3" />
                  {profile.email}
                </a>
              )}
              {profile.profile?.website && (
                <a
                  href={profile.profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-gray-600 dark:text-gray-300 hover:text-primary-600 transition"
                >
                  <LinkIcon className="w-4 h-4 mr-3" />
                  Website
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              )}
              {profile.profile?.linkedinUrl && (
                <a
                  href={profile.profile.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-gray-600 dark:text-gray-300 hover:text-primary-600 transition"
                >
                  <LinkIcon className="w-4 h-4 mr-3" />
                  LinkedIn
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              )}
              {profile.profile?.twitterUrl && (
                <a
                  href={profile.profile.twitterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-gray-600 dark:text-gray-300 hover:text-primary-600 transition"
                >
                  <LinkIcon className="w-4 h-4 mr-3" />
                  Twitter
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              )}
              {profile.profile?.githubUrl && (
                <a
                  href={profile.profile.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-gray-600 dark:text-gray-300 hover:text-primary-600 transition"
                >
                  <LinkIcon className="w-4 h-4 mr-3" />
                  GitHub
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              )}
            </div>
          </div>

          {/* Joined Date */}
          <div className="card">
            <div className="flex items-center text-gray-500 dark:text-gray-400">
              <Calendar className="w-4 h-4 mr-2" />
              <span className="text-sm">
                Joined {formatDate(profile.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
