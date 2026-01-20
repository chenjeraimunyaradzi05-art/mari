'use client';

/**
 * User Profile Header - Safety Score and Badges display
 * Phase 3: Web Client - Super App Core
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  MapPin,
  Link as LinkIcon,
  Calendar,
  Briefcase,
  GraduationCap,
  Users,
  MessageCircle,
  UserPlus,
  UserMinus,
  MoreHorizontal,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Star,
  Award,
  CheckCircle,
  BadgeCheck,
  Flag,
  Share2,
  Copy,
  Ban,
  Edit,
  Settings,
  Camera,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface UserBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  earnedAt: Date | string;
}

interface UserProfile {
  id: string;
  name: string;
  headline?: string;
  avatar?: string;
  coverImage?: string;
  location?: string;
  website?: string;
  joinedAt: Date | string;
  isVerified: boolean;
  isPremium: boolean;
  safetyScore: number;
  safetyLevel: 'excellent' | 'good' | 'fair' | 'low';
  badges: UserBadge[];
  stats: {
    followers: number;
    following: number;
    posts: number;
    connections: number;
  };
  currentRole?: string;
  company?: string;
  education?: string;
  bio?: string;
  skills?: string[];
  isFollowing?: boolean;
  isConnected?: boolean;
  isBlocked?: boolean;
}

interface UserProfileHeaderProps {
  profile: UserProfile;
  isOwnProfile?: boolean;
  onFollow?: () => void;
  onUnfollow?: () => void;
  onConnect?: () => void;
  onMessage?: () => void;
  onBlock?: () => void;
  onReport?: () => void;
  onEditProfile?: () => void;
  className?: string;
}

const SAFETY_LEVELS = {
  excellent: {
    color: 'text-emerald-500',
    bg: 'bg-emerald-500',
    icon: ShieldCheck,
    label: 'Excellent',
  },
  good: {
    color: 'text-blue-500',
    bg: 'bg-blue-500',
    icon: Shield,
    label: 'Good',
  },
  fair: {
    color: 'text-amber-500',
    bg: 'bg-amber-500',
    icon: Shield,
    label: 'Fair',
  },
  low: {
    color: 'text-red-500',
    bg: 'bg-red-500',
    icon: ShieldAlert,
    label: 'Low',
  },
};

const BADGE_ICONS: Record<string, React.ElementType> = {
  verified: BadgeCheck,
  premium: Star,
  mentor: GraduationCap,
  top_creator: Award,
  influencer: Users,
  early_adopter: CheckCircle,
  default: Award,
};

export function UserProfileHeader({
  profile,
  isOwnProfile = false,
  onFollow,
  onUnfollow,
  onConnect,
  onMessage,
  onBlock,
  onReport,
  onEditProfile,
  className,
}: UserProfileHeaderProps) {
  const [showBadgesDialog, setShowBadgesDialog] = useState(false);
  const [showSafetyDialog, setShowSafetyDialog] = useState(false);

  const safetyConfig = SAFETY_LEVELS[profile.safetyLevel];
  const SafetyIcon = safetyConfig.icon;

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (date: Date | string): string => {
    return new Date(date).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/profile/${profile.id}`;
    if (navigator.share) {
      await navigator.share({ url, title: profile.name });
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  return (
    <div className={cn('bg-white dark:bg-zinc-950', className)}>
      {/* Cover Image */}
      <div className="relative h-48 md:h-64 bg-gradient-to-r from-blue-600 to-purple-600">
        {profile.coverImage && (
          <img
            src={profile.coverImage}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        )}
        {isOwnProfile && (
          <Button
            size="sm"
            variant="secondary"
            className="absolute bottom-4 right-4"
            onClick={onEditProfile}
          >
            <Camera className="h-4 w-4 mr-2" />
            Edit Cover
          </Button>
        )}
      </div>

      {/* Profile Info */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-16 sm:-mt-20 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:gap-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              <Avatar className="h-32 w-32 sm:h-40 sm:w-40 border-4 border-white dark:border-zinc-950 shadow-xl">
                <AvatarImage src={profile.avatar} />
                <AvatarFallback className="text-4xl">
                  {profile.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              {isOwnProfile && (
                <button
                  onClick={onEditProfile}
                  className="absolute bottom-2 right-2 w-8 h-8 bg-white dark:bg-zinc-800 rounded-full shadow-lg flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                >
                  <Camera className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Name & Actions */}
            <div className="flex-1 mt-4 sm:mt-0 sm:mb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-bold">
                      {profile.name}
                    </h1>
                    {profile.isVerified && (
                      <Tooltip>
                        <TooltipTrigger>
                          <BadgeCheck className="h-6 w-6 text-blue-500 fill-blue-500" />
                        </TooltipTrigger>
                        <TooltipContent>Verified Account</TooltipContent>
                      </Tooltip>
                    )}
                    {profile.isPremium && (
                      <Tooltip>
                        <TooltipTrigger>
                          <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                        </TooltipTrigger>
                        <TooltipContent>Premium Member</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  {profile.headline && (
                    <p className="text-zinc-600 dark:text-zinc-400 mt-1">
                      {profile.headline}
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  {isOwnProfile ? (
                    <>
                      <Button variant="outline" onClick={onEditProfile}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Profile
                      </Button>
                      <Button variant="outline" size="icon">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      {profile.isFollowing ? (
                        <Button variant="outline" onClick={onUnfollow}>
                          <UserMinus className="h-4 w-4 mr-2" />
                          Following
                        </Button>
                      ) : (
                        <Button onClick={onFollow}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Follow
                        </Button>
                      )}
                      {!profile.isConnected && (
                        <Button variant="outline" onClick={onConnect}>
                          Connect
                        </Button>
                      )}
                      <Button variant="outline" size="icon" onClick={onMessage}>
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={handleShare}>
                            <Share2 className="h-4 w-4 mr-2" />
                            Share Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              navigator.clipboard.writeText(
                                `${window.location.origin}/profile/${profile.id}`
                              )
                            }
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Link
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={onBlock}>
                            <Ban className="h-4 w-4 mr-2" />
                            Block
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-500"
                            onClick={onReport}
                          >
                            <Flag className="h-4 w-4 mr-2" />
                            Report
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stats & Info */}
          <div className="mt-6 flex flex-col lg:flex-row lg:items-start gap-6">
            {/* Left: Info */}
            <div className="flex-1 space-y-4">
              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                {profile.currentRole && profile.company && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-4 w-4" />
                    {profile.currentRole} at {profile.company}
                  </span>
                )}
                {profile.education && (
                  <span className="flex items-center gap-1">
                    <GraduationCap className="h-4 w-4" />
                    {profile.education}
                  </span>
                )}
                {profile.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {profile.location}
                  </span>
                )}
                {profile.website && (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <LinkIcon className="h-4 w-4" />
                    {profile.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Joined {formatDate(profile.joinedAt)}
                </span>
              </div>

              {/* Bio */}
              {profile.bio && (
                <p className="text-zinc-700 dark:text-zinc-300">{profile.bio}</p>
              )}

              {/* Stats */}
              <div className="flex items-center gap-6">
                <button className="group">
                  <span className="font-bold text-lg group-hover:text-blue-600 transition-colors">
                    {formatNumber(profile.stats.followers)}
                  </span>
                  <span className="text-zinc-500 ml-1">Followers</span>
                </button>
                <button className="group">
                  <span className="font-bold text-lg group-hover:text-blue-600 transition-colors">
                    {formatNumber(profile.stats.following)}
                  </span>
                  <span className="text-zinc-500 ml-1">Following</span>
                </button>
                <button className="group">
                  <span className="font-bold text-lg group-hover:text-blue-600 transition-colors">
                    {formatNumber(profile.stats.connections)}
                  </span>
                  <span className="text-zinc-500 ml-1">Connections</span>
                </button>
              </div>

              {/* Skills */}
              {profile.skills && profile.skills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {profile.skills.slice(0, 6).map((skill) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                  {profile.skills.length > 6 && (
                    <Badge variant="outline">+{profile.skills.length - 6}</Badge>
                  )}
                </div>
              )}
            </div>

            {/* Right: Safety Score & Badges */}
            <div className="lg:w-80 space-y-4">
              {/* Safety Score */}
              <button
                onClick={() => setShowSafetyDialog(true)}
                className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold flex items-center gap-2">
                    <SafetyIcon className={cn('h-5 w-5', safetyConfig.color)} />
                    Safety Score
                  </span>
                  <span className={cn('font-bold', safetyConfig.color)}>
                    {profile.safetyScore}%
                  </span>
                </div>
                <Progress
                  value={profile.safetyScore}
                  className="h-2"
                />
                <p className="text-xs text-zinc-500 mt-2">
                  {safetyConfig.label} • Click to learn more
                </p>
              </button>

              {/* Badges */}
              {profile.badges.length > 0 && (
                <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold">Badges</span>
                    {profile.badges.length > 4 && (
                      <button
                        onClick={() => setShowBadgesDialog(true)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View all
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {profile.badges.slice(0, 4).map((badge) => {
                      const BadgeIcon =
                        BADGE_ICONS[badge.icon] || BADGE_ICONS.default;
                      return (
                        <Tooltip key={badge.id}>
                          <TooltipTrigger>
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: badge.color + '20' }}
                            >
                              <BadgeIcon
                                className="h-5 w-5"
                                style={{ color: badge.color }}
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-semibold">{badge.name}</p>
                            <p className="text-xs">{badge.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Safety Score Dialog */}
      <Dialog open={showSafetyDialog} onOpenChange={setShowSafetyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SafetyIcon className={cn('h-6 w-6', safetyConfig.color)} />
              Safety Score
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <div
                className={cn(
                  'text-5xl font-bold',
                  safetyConfig.color
                )}
              >
                {profile.safetyScore}%
              </div>
              <p className="text-zinc-500 mt-1">{safetyConfig.label}</p>
            </div>
            <Progress value={profile.safetyScore} className="h-3" />
            <div className="space-y-3 text-sm">
              <p className="text-zinc-600 dark:text-zinc-400">
                The Safety Score reflects the trustworthiness and credibility of this profile based on:
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  Identity verification status
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  Community interactions and feedback
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  Profile completeness and activity
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  Employment and education verification
                </li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Badges Dialog */}
      <Dialog open={showBadgesDialog} onOpenChange={setShowBadgesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>All Badges</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {profile.badges.map((badge) => {
              const BadgeIcon = BADGE_ICONS[badge.icon] || BADGE_ICONS.default;
              return (
                <div
                  key={badge.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800"
                >
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: badge.color + '20' }}
                  >
                    <BadgeIcon
                      className="h-6 w-6"
                      style={{ color: badge.color }}
                    />
                  </div>
                  <div>
                    <p className="font-semibold">{badge.name}</p>
                    <p className="text-xs text-zinc-500">{badge.description}</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Earned {formatDate(badge.earnedAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default UserProfileHeader;
