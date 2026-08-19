'use client';

/**
 * Co-founder Matching UI
 * Phase 4: Web Client - Persona Studios
 * Step 63: Tinder-style interface for finding business partners
 * 
 * Features:
 * - Swipe-style card interface
 * - Match preferences filter
 * - Skill compatibility scoring
 * - Connection requests
 * - Chat initiation
 */

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Heart,
  X,
  Star,
  RefreshCw,
  Filter,
  MapPin,
  Briefcase,
  Clock,
  Users,
  Target,
  Zap,
  Award,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ============================================
// TYPES
// ============================================

interface CofounderProfile {
  id: string;
  name: string;
  avatar?: string;
  tagline: string;
  location: string;
  timezone: string;
  experience: string;
  lookingFor: string[];
  skills: string[];
  industries: string[];
  commitment: 'full-time' | 'part-time' | 'flexible';
  equity: string;
  bio: string;
  achievements: string[];
  education?: string;
  previousStartups?: number;
  matchScore: number;
  compatibilityBreakdown: {
    skills: number;
    vision: number;
    availability: number;
    values: number;
  };
  verifications: string[];
}

interface FilterState {
  roles: string[];
  industries: string[];
  commitment: string[];
  minMatchScore: number;
  location: 'any' | 'remote' | 'local';
}

interface CofounderMatchingProps {
  className?: string;
}

// Co-founder matching is not backed by a live endpoint yet. Keep the UI honest
// by starting empty instead of showing invented partner profiles.
const INITIAL_PROFILES: CofounderProfile[] = [];

const ROLE_OPTIONS = [
  'Technical Co-founder',
  'Business Lead / CEO',
  'Product Manager',
  'Designer',
  'Sales / Growth',
  'Operations',
];

const INDUSTRY_OPTIONS = [
  'AI/ML',
  'SaaS',
  'Fintech',
  'HealthTech',
  'E-commerce',
  'EdTech',
  'Consumer',
  'Enterprise',
  'Marketplace',
  'Climate',
];

// ============================================
// COMPONENTS
// ============================================

function MatchScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-24 h-24">
      <svg className="w-full h-full -rotate-90">
        <circle
          cx="48"
          cy="48"
          r="40"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-zinc-200 dark:text-zinc-700"
        />
        <circle
          cx="48"
          cy="48"
          r="40"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-emerald-500 transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold">{score}%</span>
      </div>
    </div>
  );
}

function CompatibilityBreakdown({ breakdown }: { breakdown: CofounderProfile['compatibilityBreakdown'] }) {
  const items = [
    { key: 'skills', label: 'Skills Match', icon: Zap },
    { key: 'vision', label: 'Vision Alignment', icon: Target },
    { key: 'availability', label: 'Availability', icon: Clock },
    { key: 'values', label: 'Values', icon: Heart },
  ] as const;

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.key} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <item.icon className="h-4 w-4 text-muted-foreground" />
              <span>{item.label}</span>
            </div>
            <span className="font-medium">{breakdown[item.key]}%</span>
          </div>
          <Progress value={breakdown[item.key]} className="h-1.5" />
        </div>
      ))}
    </div>
  );
}

function ProfileCard({
  profile,
  onLike,
  onPass,
  onSuperLike,
  expanded = false,
  onToggleExpand,
}: {
  profile: CofounderProfile;
  onLike: () => void;
  onPass: () => void;
  onSuperLike: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  return (
    <Card className={cn(
      'w-full max-w-md mx-auto overflow-hidden transition-all',
      expanded ? 'max-h-[80vh] overflow-y-auto' : 'max-h-[600px]'
    )}>
      {/* Header Image / Avatar */}
      <div className="relative h-72 bg-gradient-to-br from-emerald-400 to-emerald-600">
        <div className="absolute inset-0 flex items-center justify-center">
          <Avatar className="h-40 w-40 border-4 border-white shadow-xl">
            <AvatarImage src={profile.avatar} alt={profile.name} />
            <AvatarFallback className="text-4xl bg-emerald-700">
              {profile.name.split(' ').map((n) => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
        </div>
        
        {/* Match Score Badge */}
        <div className="absolute top-4 right-4 bg-white dark:bg-zinc-900 rounded-full px-3 py-1 flex items-center gap-1 shadow-lg">
          <Sparkles className="h-4 w-4 text-emerald-500" />
          <span className="font-bold text-emerald-600">{profile.matchScore}% Match</span>
        </div>

        {/* Verifications */}
        <div className="absolute bottom-4 left-4 flex gap-1">
          {profile.verifications.map((v) => (
            <Badge key={v} variant="secondary" className="bg-white/90 text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />
              {v}
            </Badge>
          ))}
        </div>
      </div>

      <CardContent className="p-6">
        {/* Name & Tagline */}
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold">{profile.name}</h2>
          <p className="text-muted-foreground">{profile.tagline}</p>
        </div>

        {/* Quick Info */}
        <div className="flex flex-wrap justify-center gap-2 mb-4">
          <Badge variant="outline">
            <MapPin className="h-3 w-3 mr-1" />
            {profile.location}
          </Badge>
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            {profile.timezone}
          </Badge>
          <Badge variant="outline">
            <Briefcase className="h-3 w-3 mr-1" />
            {profile.experience}
          </Badge>
        </div>

        {/* Looking For */}
        <div className="mb-4">
          <p className="text-sm text-muted-foreground mb-2">Looking for:</p>
          <div className="flex flex-wrap gap-2">
            {profile.lookingFor.map((role) => (
              <Badge key={role} className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                {role}
              </Badge>
            ))}
          </div>
        </div>

        {/* Skills */}
        <div className="mb-4">
          <p className="text-sm text-muted-foreground mb-2">Top Skills:</p>
          <div className="flex flex-wrap gap-2">
            {profile.skills.slice(0, 4).map((skill) => (
              <Badge key={skill} variant="outline">
                {skill}
              </Badge>
            ))}
            {profile.skills.length > 4 && (
              <Badge variant="outline">+{profile.skills.length - 4}</Badge>
            )}
          </div>
        </div>

        {/* Bio Preview */}
        <p className={cn(
          'text-sm text-muted-foreground',
          !expanded && 'line-clamp-3'
        )}>
          {profile.bio}
        </p>

        {/* Expanded Content */}
        {expanded && (
          <div className="mt-6 space-y-6">
            {/* Achievements */}
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Award className="h-4 w-4 text-emerald-500" />
                Achievements
              </h4>
              <ul className="space-y-1">
                {profile.achievements.map((a, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>

            {/* Compatibility Breakdown */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-500" />
                Compatibility Breakdown
              </h4>
              <CompatibilityBreakdown breakdown={profile.compatibilityBreakdown} />
            </div>

            {/* Additional Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Commitment</p>
                <p className="font-medium capitalize">{profile.commitment}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Equity Range</p>
                <p className="font-medium">{profile.equity}</p>
              </div>
              {profile.education && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">Education</p>
                  <p className="font-medium">{profile.education}</p>
                </div>
              )}
              {profile.previousStartups !== undefined && (
                <div>
                  <p className="text-muted-foreground">Previous Startups</p>
                  <p className="font-medium">{profile.previousStartups}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Expand/Collapse */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-4"
          onClick={onToggleExpand}
        >
          {expanded ? 'Show Less' : 'View Full Profile'}
        </Button>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <Button
            variant="outline"
            size="lg"
            className="rounded-full h-14 w-14 p-0"
            onClick={onPass}
          >
            <X className="h-6 w-6 text-red-500" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="rounded-full h-16 w-16 p-0 border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950"
            onClick={onSuperLike}
          >
            <Star className="h-7 w-7 text-emerald-500" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="rounded-full h-14 w-14 p-0"
            onClick={onLike}
          >
            <Heart className="h-6 w-6 text-emerald-500" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterSheet({
  filters,
  onFiltersChange,
}: {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filter Matches</SheetTitle>
          <SheetDescription>
            Refine your co-founder search preferences
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Minimum Match Score */}
          <div className="space-y-3">
            <Label>Minimum Match Score: {filters.minMatchScore}%</Label>
            <Slider
              value={[filters.minMatchScore]}
              onValueChange={([value]) => onFiltersChange({ ...filters, minMatchScore: value })}
              min={50}
              max={100}
              step={5}
            />
          </div>

          {/* Roles */}
          <div className="space-y-3">
            <Label>Looking For</Label>
            <div className="space-y-2">
              {ROLE_OPTIONS.map((role) => (
                <div key={role} className="flex items-center space-x-2">
                  <Checkbox
                    id={`role-${role}`}
                    checked={filters.roles.includes(role)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onFiltersChange({ ...filters, roles: [...filters.roles, role] });
                      } else {
                        onFiltersChange({ ...filters, roles: filters.roles.filter((r) => r !== role) });
                      }
                    }}
                  />
                  <Label htmlFor={`role-${role}`} className="font-normal">
                    {role}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Industries */}
          <div className="space-y-3">
            <Label>Industries</Label>
            <div className="space-y-2">
              {INDUSTRY_OPTIONS.map((industry) => (
                <div key={industry} className="flex items-center space-x-2">
                  <Checkbox
                    id={`industry-${industry}`}
                    checked={filters.industries.includes(industry)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onFiltersChange({ ...filters, industries: [...filters.industries, industry] });
                      } else {
                        onFiltersChange({ ...filters, industries: filters.industries.filter((i) => i !== industry) });
                      }
                    }}
                  />
                  <Label htmlFor={`industry-${industry}`} className="font-normal">
                    {industry}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-3">
            <Label>Location Preference</Label>
            <Select
              value={filters.location}
              onValueChange={(value: FilterState['location']) => onFiltersChange({ ...filters, location: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any Location</SelectItem>
                <SelectItem value="remote">Remote Only</SelectItem>
                <SelectItem value="local">Local Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Commitment */}
          <div className="space-y-3">
            <Label>Commitment Level</Label>
            <div className="space-y-2">
              {['full-time', 'part-time', 'flexible'].map((c) => (
                <div key={c} className="flex items-center space-x-2">
                  <Checkbox
                    id={`commitment-${c}`}
                    checked={filters.commitment.includes(c)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onFiltersChange({ ...filters, commitment: [...filters.commitment, c] });
                      } else {
                        onFiltersChange({ ...filters, commitment: filters.commitment.filter((x) => x !== c) });
                      }
                    }}
                  />
                  <Label htmlFor={`commitment-${c}`} className="font-normal capitalize">
                    {c}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Button className="w-full" onClick={() => {}}>
            Apply Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function CofounderMatching({ className }: CofounderMatchingProps) {
  const [profiles] = useState(INITIAL_PROFILES);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedProfile, setExpandedProfile] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    roles: [],
    industries: [],
    commitment: [],
    minMatchScore: 70,
    location: 'any',
  });

  const currentProfile = profiles[currentIndex];

  const advanceProfile = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, profiles.length));
    setExpandedProfile(false);
  }, [profiles.length]);

  const handleLike = advanceProfile;
  const handlePass = advanceProfile;
  const handleSuperLike = advanceProfile;

  const handleRefresh = () => {
    setCurrentIndex(0);
    setExpandedProfile(false);
  };

  const isOutOfProfiles = profiles.length === 0 || currentIndex >= profiles.length;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Find Your Co-founder</h1>
          <p className="text-muted-foreground">Discover partners who complement your skills</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <FilterSheet filters={filters} onFiltersChange={setFilters} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{profiles.length}</p>
            <p className="text-sm text-muted-foreground">Potential Matches</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">0</p>
            <p className="text-sm text-muted-foreground">Connections</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">0</p>
            <p className="text-sm text-muted-foreground">Profile Views</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Card Area */}
      <div className="flex justify-center py-8">
        {isOutOfProfiles ? (
          <Card className="w-full max-w-md text-center p-8">
            <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Matching is not connected yet</h3>
            <p className="text-muted-foreground mb-6">
              Co-founder profiles will appear here once the live matching endpoint is available.
            </p>
            <Button onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </Card>
        ) : currentProfile ? (
          <ProfileCard
            profile={currentProfile}
            onLike={handleLike}
            onPass={handlePass}
            onSuperLike={handleSuperLike}
            expanded={expandedProfile}
            onToggleExpand={() => setExpandedProfile(!expandedProfile)}
          />
        ) : (
          <Card className="w-full max-w-md text-center p-8">
            <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No profile selected</h3>
          </Card>
        )}
      </div>

      {/* Keyboard Hints */}
      {!isOutOfProfiles && (
        <div className="flex justify-center gap-4 text-sm text-muted-foreground">
          <span>← Pass</span>
          <span>↑ Super Like</span>
          <span>→ Like</span>
        </div>
      )}
    </div>
  );
}

export default CofounderMatching;
