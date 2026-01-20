'use client';

/**
 * Badge Wallet
 * Phase 4: Web Client - Persona Studios
 * Step 72: Display and share earned credentials
 * 
 * Features:
 * - Badge collection display
 * - Badge details modal
 * - Verification info
 * - Sharing options
 * - Badge categories
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Award,
  Shield,
  Star,
  Zap,
  Trophy,
  CheckCircle2,
  ExternalLink,
  Share2,
  Download,
  Copy,
  Link2,
  Calendar,
  Building2,
  BookOpen,
  Code,
  Briefcase,
  Users,
  Filter,
  Search,
  Grid3X3,
  List,
  MoreHorizontal,
  Eye,
  Lock,
  Unlock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge as BadgeUI } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// ============================================
// TYPES
// ============================================

type BadgeLevel = 'bronze' | 'silver' | 'gold' | 'platinum';
type BadgeCategory = 'skills' | 'courses' | 'achievements' | 'community';

interface Badge {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  level: BadgeLevel;
  icon: string;
  earnedAt: Date;
  expiresAt?: Date;
  issuer: {
    name: string;
    logo?: string;
    verified: boolean;
  };
  verificationUrl?: string;
  credentialId?: string;
  skills?: string[];
  isPublic: boolean;
  metadata?: {
    score?: number;
    hoursCompleted?: number;
    projectsCompleted?: number;
  };
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_BADGES: Badge[] = [
  {
    id: '1',
    name: 'JavaScript Expert',
    description: 'Demonstrated advanced proficiency in JavaScript programming',
    category: 'skills',
    level: 'gold',
    icon: '🟨',
    earnedAt: new Date(2026, 0, 15),
    issuer: { name: 'Athena Skills', verified: true },
    verificationUrl: 'https://athena.app/verify/js-expert-123',
    credentialId: 'JS-EXP-2026-001',
    skills: ['JavaScript', 'ES6+', 'TypeScript', 'Node.js'],
    isPublic: true,
    metadata: { score: 94 },
  },
  {
    id: '2',
    name: 'React Professional',
    description: 'Completed advanced React certification with distinction',
    category: 'skills',
    level: 'silver',
    icon: '⚛️',
    earnedAt: new Date(2026, 0, 10),
    issuer: { name: 'Athena Skills', verified: true },
    verificationUrl: 'https://athena.app/verify/react-pro-456',
    credentialId: 'REACT-PRO-2026-001',
    skills: ['React', 'Redux', 'React Query', 'Testing'],
    isPublic: true,
    metadata: { score: 87 },
  },
  {
    id: '3',
    name: 'Product Management Fundamentals',
    description: 'Completed the Product Management Fundamentals course',
    category: 'courses',
    level: 'bronze',
    icon: '📊',
    earnedAt: new Date(2025, 11, 20),
    issuer: { name: 'Sarah Johnson', verified: true },
    credentialId: 'PM-FUND-2025-789',
    isPublic: true,
    metadata: { hoursCompleted: 12 },
  },
  {
    id: '4',
    name: 'Community Champion',
    description: 'Helped 100+ community members with their questions',
    category: 'community',
    level: 'gold',
    icon: '🏆',
    earnedAt: new Date(2025, 10, 15),
    issuer: { name: 'Athena Community', verified: true },
    isPublic: true,
    metadata: { projectsCompleted: 127 },
  },
  {
    id: '5',
    name: 'First Course Completed',
    description: 'Completed your first course on Athena',
    category: 'achievements',
    level: 'bronze',
    icon: '🎓',
    earnedAt: new Date(2025, 9, 1),
    issuer: { name: 'Athena', verified: true },
    isPublic: true,
  },
  {
    id: '6',
    name: 'Python Intermediate',
    description: 'Demonstrated intermediate proficiency in Python',
    category: 'skills',
    level: 'bronze',
    icon: '🐍',
    earnedAt: new Date(2025, 8, 15),
    issuer: { name: 'Athena Skills', verified: true },
    credentialId: 'PY-INT-2025-001',
    skills: ['Python', 'Data Structures', 'OOP'],
    isPublic: false,
    metadata: { score: 72 },
  },
];

// ============================================
// CONFIG
// ============================================

const LEVEL_CONFIG: Record<BadgeLevel, { label: string; color: string; bgColor: string }> = {
  bronze: { label: 'Bronze', color: 'text-amber-700', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  silver: { label: 'Silver', color: 'text-zinc-500', bgColor: 'bg-zinc-200 dark:bg-zinc-700' },
  gold: { label: 'Gold', color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' },
  platinum: { label: 'Platinum', color: 'text-cyan-600', bgColor: 'bg-cyan-100 dark:bg-cyan-900/30' },
};

const CATEGORY_CONFIG: Record<BadgeCategory, { label: string; icon: React.ElementType }> = {
  skills: { label: 'Skills', icon: Code },
  courses: { label: 'Courses', icon: BookOpen },
  achievements: { label: 'Achievements', icon: Trophy },
  community: { label: 'Community', icon: Users },
};

// ============================================
// COMPONENTS
// ============================================

function BadgeCard({
  badge,
  onClick,
  viewMode,
}: {
  badge: Badge;
  onClick: () => void;
  viewMode: 'grid' | 'list';
}) {
  const levelConfig = LEVEL_CONFIG[badge.level];
  const categoryConfig = CATEGORY_CONFIG[badge.category];
  const CategoryIcon = categoryConfig.icon;

  if (viewMode === 'list') {
    return (
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className={cn(
              'h-14 w-14 rounded-xl flex items-center justify-center text-2xl',
              levelConfig.bgColor
            )}>
              {badge.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{badge.name}</h3>
                {badge.issuer.verified && (
                  <Shield className="h-4 w-4 text-blue-500" />
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {badge.description}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <BadgeUI variant="outline" className={cn('text-xs', levelConfig.color)}>
                  {levelConfig.label}
                </BadgeUI>
                <span className="text-xs text-muted-foreground">
                  {badge.earnedAt.toLocaleDateString()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!badge.isPublic && <Lock className="h-4 w-4 text-muted-foreground" />}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow group"
      onClick={onClick}
    >
      <CardContent className="p-6 text-center">
        <div className="relative inline-block">
          <div className={cn(
            'h-20 w-20 mx-auto rounded-2xl flex items-center justify-center text-4xl mb-4',
            levelConfig.bgColor
          )}>
            {badge.icon}
          </div>
          {badge.issuer.verified && (
            <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-white" />
            </div>
          )}
          {!badge.isPublic && (
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-zinc-500 flex items-center justify-center">
              <Lock className="h-3 w-3 text-white" />
            </div>
          )}
        </div>

        <h3 className="font-semibold">{badge.name}</h3>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
          {badge.description}
        </p>

        <div className="flex items-center justify-center gap-2 mt-3">
          <BadgeUI variant="outline" className={cn('text-xs', levelConfig.color)}>
            {levelConfig.label}
          </BadgeUI>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          Earned {badge.earnedAt.toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );
}

function BadgeDetailDialog({
  badge,
  open,
  onClose,
  onToggleVisibility,
}: {
  badge: Badge | null;
  open: boolean;
  onClose: () => void;
  onToggleVisibility: (badgeId: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!badge) return null;

  const levelConfig = LEVEL_CONFIG[badge.level];
  const categoryConfig = CATEGORY_CONFIG[badge.category];

  const copyVerificationUrl = () => {
    if (badge.verificationUrl) {
      navigator.clipboard.writeText(badge.verificationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-center">
          <div className={cn(
            'h-24 w-24 mx-auto rounded-2xl flex items-center justify-center text-5xl mb-4',
            levelConfig.bgColor
          )}>
            {badge.icon}
          </div>
          <DialogTitle>{badge.name}</DialogTitle>
          <DialogDescription>{badge.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Level & Category */}
          <div className="flex items-center justify-center gap-2">
            <BadgeUI variant="outline" className={levelConfig.color}>
              {levelConfig.label}
            </BadgeUI>
            <BadgeUI variant="secondary">
              {categoryConfig.label}
            </BadgeUI>
          </div>

          <Separator />

          {/* Details */}
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Issued by</span>
              <span className="flex items-center gap-1">
                {badge.issuer.name}
                {badge.issuer.verified && (
                  <Shield className="h-4 w-4 text-blue-500" />
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Earned on</span>
              <span>{badge.earnedAt.toLocaleDateString()}</span>
            </div>
            {badge.expiresAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expires</span>
                <span>{badge.expiresAt.toLocaleDateString()}</span>
              </div>
            )}
            {badge.credentialId && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Credential ID</span>
                <span className="font-mono text-xs">{badge.credentialId}</span>
              </div>
            )}
            {badge.metadata?.score && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Score</span>
                <span className="font-medium">{badge.metadata.score}%</span>
              </div>
            )}
          </div>

          {/* Skills */}
          {badge.skills && badge.skills.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium text-sm mb-2">Skills Validated</h4>
                <div className="flex flex-wrap gap-1">
                  {badge.skills.map((skill) => (
                    <BadgeUI key={skill} variant="secondary" className="text-xs">
                      {skill}
                    </BadgeUI>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Visibility Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {badge.isPublic ? (
                <Unlock className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Lock className="h-4 w-4 text-muted-foreground" />
              )}
              <Label htmlFor="visibility">Show on profile</Label>
            </div>
            <Switch
              id="visibility"
              checked={badge.isPublic}
              onCheckedChange={() => onToggleVisibility(badge.id)}
            />
          </div>

          {/* Verification URL */}
          {badge.verificationUrl && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Verification Link</h4>
              <div className="flex gap-2">
                <Input
                  value={badge.verificationUrl}
                  readOnly
                  className="text-xs"
                />
                <Button variant="outline" size="icon" onClick={copyVerificationUrl}>
                  {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BadgeStats({ badges }: { badges: Badge[] }) {
  const totalBadges = badges.length;
  const publicBadges = badges.filter(b => b.isPublic).length;
  const skillBadges = badges.filter(b => b.category === 'skills').length;
  const courseBadges = badges.filter(b => b.category === 'courses').length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="h-12 w-12 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-2">
            <Award className="h-6 w-6 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold">{totalBadges}</p>
          <p className="text-sm text-muted-foreground">Total Badges</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="h-12 w-12 mx-auto rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
            <Code className="h-6 w-6 text-blue-600" />
          </div>
          <p className="text-2xl font-bold">{skillBadges}</p>
          <p className="text-sm text-muted-foreground">Skill Badges</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="h-12 w-12 mx-auto rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-2">
            <BookOpen className="h-6 w-6 text-purple-600" />
          </div>
          <p className="text-2xl font-bold">{courseBadges}</p>
          <p className="text-sm text-muted-foreground">Course Certificates</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="h-12 w-12 mx-auto rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mb-2">
            <Eye className="h-6 w-6 text-yellow-600" />
          </div>
          <p className="text-2xl font-bold">{publicBadges}</p>
          <p className="text-sm text-muted-foreground">Public Badges</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function BadgeWallet({ className }: { className?: string }) {
  const [badges, setBadges] = useState<Badge[]>(MOCK_BADGES);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredBadges = badges.filter((badge) => {
    const matchesCategory = categoryFilter === 'all' || badge.category === categoryFilter;
    const matchesSearch = badge.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      badge.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleBadgeClick = (badge: Badge) => {
    setSelectedBadge(badge);
    setDialogOpen(true);
  };

  const handleToggleVisibility = (badgeId: string) => {
    setBadges(badges.map(b =>
      b.id === badgeId ? { ...b, isPublic: !b.isPublic } : b
    ));
    if (selectedBadge?.id === badgeId) {
      setSelectedBadge({ ...selectedBadge, isPublic: !selectedBadge.isPublic });
    }
  };

  return (
    <div className={cn('container mx-auto py-8 space-y-8', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Badge Wallet</h1>
          <p className="text-muted-foreground">Your verified credentials and achievements</p>
        </div>
        <Button>
          <Share2 className="h-4 w-4 mr-2" />
          Share All
        </Button>
      </div>

      {/* Stats */}
      <BadgeStats badges={badges} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search badges..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="skills">Skills</SelectItem>
            <SelectItem value="courses">Courses</SelectItem>
            <SelectItem value="achievements">Achievements</SelectItem>
            <SelectItem value="community">Community</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex border rounded-lg">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Badges Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredBadges.map((badge) => (
            <BadgeCard
              key={badge.id}
              badge={badge}
              onClick={() => handleBadgeClick(badge)}
              viewMode={viewMode}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBadges.map((badge) => (
            <BadgeCard
              key={badge.id}
              badge={badge}
              onClick={() => handleBadgeClick(badge)}
              viewMode={viewMode}
            />
          ))}
        </div>
      )}

      {filteredBadges.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium">No badges found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Try adjusting your filters or search query
            </p>
          </CardContent>
        </Card>
      )}

      {/* Badge Detail Dialog */}
      <BadgeDetailDialog
        badge={selectedBadge}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onToggleVisibility={handleToggleVisibility}
      />
    </div>
  );
}

export default BadgeWallet;
