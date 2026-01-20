'use client';

/**
 * Privacy Center Dashboard
 * Phase 4: Web Client - Persona Studios
 * Step 73: User data control and privacy settings
 * 
 * Features:
 * - Data visibility controls
 * - Download your data
 * - Connected apps management
 * - Cookie preferences
 * - Marketing preferences
 * - Data deletion request
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Shield,
  Eye,
  EyeOff,
  Download,
  Trash2,
  Link2,
  Settings,
  Bell,
  Mail,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info,
  ExternalLink,
  Cookie,
  Globe,
  Users,
  Building2,
  FileText,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';

// ============================================
// TYPES
// ============================================

interface PrivacySetting {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  category: string;
}

interface ConnectedApp {
  id: string;
  name: string;
  logo?: string;
  permissions: string[];
  connectedAt: Date;
  lastUsed?: Date;
}

interface DataCategory {
  id: string;
  name: string;
  description: string;
  dataPoints: string[];
  size: string;
}

// ============================================
// MOCK DATA
// ============================================

const PROFILE_VISIBILITY_SETTINGS: PrivacySetting[] = [
  {
    id: 'show-profile',
    label: 'Public profile',
    description: 'Allow anyone to view your basic profile',
    enabled: true,
    category: 'profile',
  },
  {
    id: 'show-email',
    label: 'Show email address',
    description: 'Display your email on your public profile',
    enabled: false,
    category: 'profile',
  },
  {
    id: 'show-location',
    label: 'Show location',
    description: 'Display your city/country on your profile',
    enabled: true,
    category: 'profile',
  },
  {
    id: 'show-activity',
    label: 'Show activity status',
    description: 'Let others see when you&apos;re online',
    enabled: true,
    category: 'profile',
  },
  {
    id: 'show-badges',
    label: 'Show earned badges',
    description: 'Display your verified credentials on your profile',
    enabled: true,
    category: 'profile',
  },
];

const COMMUNICATION_SETTINGS: PrivacySetting[] = [
  {
    id: 'email-marketing',
    label: 'Marketing emails',
    description: 'Receive updates about new features and promotions',
    enabled: true,
    category: 'communication',
  },
  {
    id: 'email-notifications',
    label: 'Email notifications',
    description: 'Receive important notifications via email',
    enabled: true,
    category: 'communication',
  },
  {
    id: 'push-notifications',
    label: 'Push notifications',
    description: 'Receive push notifications on your devices',
    enabled: true,
    category: 'communication',
  },
  {
    id: 'sms-notifications',
    label: 'SMS notifications',
    description: 'Receive text messages for urgent updates',
    enabled: false,
    category: 'communication',
  },
];

const CONNECTED_APPS: ConnectedApp[] = [
  {
    id: '1',
    name: 'Google',
    permissions: ['Sign in', 'Email address'],
    connectedAt: new Date(2025, 6, 15),
    lastUsed: new Date(2026, 0, 20),
  },
  {
    id: '2',
    name: 'LinkedIn',
    permissions: ['Sign in', 'Profile info', 'Work history'],
    connectedAt: new Date(2025, 8, 1),
    lastUsed: new Date(2026, 0, 18),
  },
  {
    id: '3',
    name: 'GitHub',
    permissions: ['Sign in', 'Public repositories'],
    connectedAt: new Date(2025, 10, 10),
    lastUsed: new Date(2026, 0, 15),
  },
];

const DATA_CATEGORIES: DataCategory[] = [
  {
    id: 'profile',
    name: 'Profile Information',
    description: 'Your name, email, photo, and bio',
    dataPoints: ['Name', 'Email', 'Phone', 'Profile photo', 'Bio', 'Location'],
    size: '2.4 MB',
  },
  {
    id: 'activity',
    name: 'Activity Data',
    description: 'Your courses, assessments, and learning history',
    dataPoints: ['Course progress', 'Assessment results', 'Certificates', 'Badges'],
    size: '15.7 MB',
  },
  {
    id: 'connections',
    name: 'Connections & Messages',
    description: 'Your network and communication history',
    dataPoints: ['Connections', 'Messages', 'Group memberships'],
    size: '8.3 MB',
  },
  {
    id: 'content',
    name: 'Your Content',
    description: 'Posts, comments, and uploads',
    dataPoints: ['Posts', 'Comments', 'Reactions', 'Uploads'],
    size: '124.5 MB',
  },
];

// ============================================
// COMPONENTS
// ============================================

function PrivacyScore() {
  const score = 85; // Calculated based on settings

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-6">
          <div className="relative h-24 w-24">
            <svg className="transform -rotate-90 h-24 w-24">
              <circle
                cx="48"
                cy="48"
                r="42"
                className="stroke-muted fill-none"
                strokeWidth="8"
              />
              <circle
                cx="48"
                cy="48"
                r="42"
                className="stroke-emerald-500 fill-none"
                strokeWidth="8"
                strokeDasharray={`${(score / 100) * 264} 264`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold">{score}</span>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-lg">Privacy Score</h3>
            <p className="text-sm text-muted-foreground">
              Your privacy settings are well configured
            </p>
            <div className="flex items-center gap-1 mt-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-emerald-600 dark:text-emerald-400">Good standing</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VisibilitySettings() {
  const [settings, setSettings] = useState(PROFILE_VISIBILITY_SETTINGS);

  const toggleSetting = (id: string) => {
    setSettings(settings.map(s =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    ));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Profile Visibility
        </CardTitle>
        <CardDescription>
          Control what others can see on your profile
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {settings.map((setting) => (
          <div key={setting.id} className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor={setting.id}>{setting.label}</Label>
              <p className="text-sm text-muted-foreground">{setting.description}</p>
            </div>
            <Switch
              id={setting.id}
              checked={setting.enabled}
              onCheckedChange={() => toggleSetting(setting.id)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CommunicationSettings() {
  const [settings, setSettings] = useState(COMMUNICATION_SETTINGS);

  const toggleSetting = (id: string) => {
    setSettings(settings.map(s =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    ));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Communication Preferences
        </CardTitle>
        <CardDescription>
          Manage how we contact you
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {settings.map((setting) => (
          <div key={setting.id} className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor={setting.id}>{setting.label}</Label>
              <p className="text-sm text-muted-foreground">{setting.description}</p>
            </div>
            <Switch
              id={setting.id}
              checked={setting.enabled}
              onCheckedChange={() => toggleSetting(setting.id)}
            />
          </div>
        ))}

        <Separator />

        <div>
          <Label>Email frequency</Label>
          <Select defaultValue="weekly">
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily digest</SelectItem>
              <SelectItem value="weekly">Weekly digest</SelectItem>
              <SelectItem value="instant">Instant notifications</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

function ConnectedAppsSection() {
  const [apps, setApps] = useState(CONNECTED_APPS);
  const [disconnectDialog, setDisconnectDialog] = useState<ConnectedApp | null>(null);

  const handleDisconnect = (appId: string) => {
    setApps(apps.filter(a => a.id !== appId));
    setDisconnectDialog(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Connected Apps
        </CardTitle>
        <CardDescription>
          Apps and services connected to your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {apps.map((app) => (
          <div key={app.id} className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-lg font-semibold">
                {app.name[0]}
              </div>
              <div>
                <h4 className="font-medium">{app.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {app.permissions.join(' • ')}
                </p>
                <p className="text-xs text-muted-foreground">
                  Connected {app.connectedAt.toLocaleDateString()}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDisconnectDialog(app)}
            >
              Disconnect
            </Button>
          </div>
        ))}

        {apps.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Link2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No connected apps</p>
          </div>
        )}

        <Dialog open={!!disconnectDialog} onOpenChange={() => setDisconnectDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Disconnect {disconnectDialog?.name}?</DialogTitle>
              <DialogDescription>
                This will revoke access. You may need to reconnect if you want to use this
                app with Athena again.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDisconnectDialog(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => disconnectDialog && handleDisconnect(disconnectDialog.id)}
              >
                Disconnect
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function DataDownloadSection() {
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const handleDownload = () => {
    setDownloading(true);
    // Simulate download progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setDownloadProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setDownloading(false);
          setDownloadProgress(0);
        }, 1000);
      }
    }, 500);
  };

  const toggleCategory = (id: string) => {
    setSelectedCategories(
      selectedCategories.includes(id)
        ? selectedCategories.filter(c => c !== id)
        : [...selectedCategories, id]
    );
  };

  const totalSize = DATA_CATEGORIES
    .filter(c => selectedCategories.includes(c.id))
    .reduce((sum, c) => sum + parseFloat(c.size), 0)
    .toFixed(1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Download Your Data
        </CardTitle>
        <CardDescription>
          Get a copy of all your data stored on Athena
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {DATA_CATEGORIES.map((category) => (
            <div
              key={category.id}
              className={cn(
                'p-4 border rounded-lg cursor-pointer transition-colors',
                selectedCategories.includes(category.id)
                  ? 'border-primary bg-primary/5'
                  : 'hover:bg-muted'
              )}
              onClick={() => toggleCategory(category.id)}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedCategories.includes(category.id)}
                  onCheckedChange={() => toggleCategory(category.id)}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{category.name}</h4>
                    <Badge variant="secondary">{category.size}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {category.description}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {category.dataPoints.map((point) => (
                      <Badge key={point} variant="outline" className="text-xs">
                        {point}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {downloading ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Preparing your data...</span>
              <span>{downloadProgress}%</span>
            </div>
            <Progress value={downloadProgress} />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedCategories.length > 0
                ? `Selected: ${totalSize} MB`
                : 'Select data categories to download'}
            </p>
            <Button
              onClick={handleDownload}
              disabled={selectedCategories.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        )}

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Data export</AlertTitle>
          <AlertDescription>
            Your data will be prepared and sent to your email within 24 hours.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

function DeleteAccountSection() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <Trash2 className="h-5 w-5" />
          Delete Account
        </CardTitle>
        <CardDescription>
          Permanently delete your account and all associated data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription>
            This action is irreversible. All your data, including courses, badges,
            and connections will be permanently deleted.
          </AlertDescription>
        </Alert>

        <Button
          variant="destructive"
          onClick={() => setDeleteDialogOpen(true)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete My Account
        </Button>

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                This will permanently delete:
              </DialogDescription>
            </DialogHeader>

            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-destructive" />
                Your profile and all personal information
              </li>
              <li className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-destructive" />
                All courses, progress, and certificates
              </li>
              <li className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-destructive" />
                Your connections and message history
              </li>
              <li className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-destructive" />
                Any content you've created
              </li>
            </ul>

            <div className="space-y-2">
              <Label>Type "DELETE" to confirm</Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={confirmText !== 'DELETE'}
              >
                Permanently Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function CookieSettings() {
  const [cookies, setCookies] = useState({
    necessary: true,
    analytics: true,
    marketing: false,
    preferences: true,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cookie className="h-5 w-5" />
          Cookie Preferences
        </CardTitle>
        <CardDescription>
          Manage how we use cookies on your browser
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label>Necessary cookies</Label>
            <p className="text-sm text-muted-foreground">
              Required for the website to function properly
            </p>
          </div>
          <Switch checked disabled />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <Label>Analytics cookies</Label>
            <p className="text-sm text-muted-foreground">
              Help us understand how you use the site
            </p>
          </div>
          <Switch
            checked={cookies.analytics}
            onCheckedChange={(checked) => setCookies({ ...cookies, analytics: checked })}
          />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <Label>Marketing cookies</Label>
            <p className="text-sm text-muted-foreground">
              Used for personalized advertising
            </p>
          </div>
          <Switch
            checked={cookies.marketing}
            onCheckedChange={(checked) => setCookies({ ...cookies, marketing: checked })}
          />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <Label>Preference cookies</Label>
            <p className="text-sm text-muted-foreground">
              Remember your settings and preferences
            </p>
          </div>
          <Switch
            checked={cookies.preferences}
            onCheckedChange={(checked) => setCookies({ ...cookies, preferences: checked })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function PrivacyCenterDashboard({ className }: { className?: string }) {
  return (
    <div className={cn('container mx-auto py-8 space-y-8', className)}>
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Shield className="h-8 w-8 text-emerald-500" />
          Privacy Center
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your privacy settings and control your data
        </p>
      </div>

      {/* Privacy Score */}
      <PrivacyScore />

      {/* Main Content */}
      <Tabs defaultValue="visibility" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="visibility">Visibility</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="apps">Connected Apps</TabsTrigger>
          <TabsTrigger value="cookies">Cookies</TabsTrigger>
          <TabsTrigger value="data">My Data</TabsTrigger>
        </TabsList>

        <TabsContent value="visibility">
          <VisibilitySettings />
        </TabsContent>

        <TabsContent value="communication">
          <CommunicationSettings />
        </TabsContent>

        <TabsContent value="apps">
          <ConnectedAppsSection />
        </TabsContent>

        <TabsContent value="cookies">
          <CookieSettings />
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <DataDownloadSection />
          <DeleteAccountSection />
        </TabsContent>
      </Tabs>

      {/* Legal Links */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <a href="#" className="flex items-center gap-1 text-primary hover:underline">
              <FileText className="h-4 w-4" />
              Privacy Policy
            </a>
            <a href="#" className="flex items-center gap-1 text-primary hover:underline">
              <FileText className="h-4 w-4" />
              Terms of Service
            </a>
            <a href="#" className="flex items-center gap-1 text-primary hover:underline">
              <Cookie className="h-4 w-4" />
              Cookie Policy
            </a>
            <a href="#" className="flex items-center gap-1 text-primary hover:underline">
              <Globe className="h-4 w-4" />
              GDPR Rights
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default PrivacyCenterDashboard;
