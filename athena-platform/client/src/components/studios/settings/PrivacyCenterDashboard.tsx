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

import React, { useEffect, useState } from 'react';
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

export interface PrivacySetting {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  category: string;
}

export interface ConnectedApp {
  id: string;
  name: string;
  logo?: string;
  permissions: string[];
  connectedAt: Date;
  lastUsed?: Date;
}

export interface DataCategory {
  id: string;
  name: string;
  description: string;
  dataPoints: string[];
  size?: string;
}

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
}

interface PrivacyCenterDashboardProps {
  className?: string;
  profileVisibilitySettings?: PrivacySetting[];
  communicationSettings?: PrivacySetting[];
  connectedApps?: ConnectedApp[];
  dataCategories?: DataCategory[];
  privacyScore?: number | null;
  isLoading?: boolean;
  error?: string | null;
  initialCookiePreferences?: Partial<CookiePreferences>;
  onDisconnectApp?: (appId: string) => void | Promise<void>;
  onRequestDataDownload?: (categoryIds: string[]) => void | Promise<void>;
  onDeleteAccount?: () => void | Promise<void>;
  onSaveCookiePreferences?: (preferences: CookiePreferences) => void | Promise<void>;
}

const EMPTY_PRIVACY_SETTINGS: PrivacySetting[] = [];
const EMPTY_CONNECTED_APPS: ConnectedApp[] = [];
const EMPTY_DATA_CATEGORIES: DataCategory[] = [];

// ============================================
// COMPONENTS
// ============================================

function PrivacyScore({ score }: { score?: number | null }) {
  if (score === null || score === undefined) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Shield className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Privacy Score Unavailable</h3>
              <p className="text-sm text-muted-foreground">
                Live privacy scoring has not been connected for this account.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const normalizedScore = Math.max(0, Math.min(100, score));
  const scoreLabel = normalizedScore >= 80 ? 'Good standing' : normalizedScore >= 60 ? 'Needs review' : 'Needs attention';

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
                strokeDasharray={`${(normalizedScore / 100) * 264} 264`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold">{normalizedScore}</span>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-lg">Privacy Score</h3>
            <p className="text-sm text-muted-foreground">
              Calculated from live privacy settings
            </p>
            <div className="flex items-center gap-1 mt-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-emerald-600 dark:text-emerald-400">{scoreLabel}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VisibilitySettings({ initialSettings }: { initialSettings: PrivacySetting[] }) {
  const [settings, setSettings] = useState(initialSettings);

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

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
        {settings.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Live profile visibility settings are not connected yet.
          </div>
        ) : settings.map((setting) => (
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

function CommunicationSettings({ initialSettings }: { initialSettings: PrivacySetting[] }) {
  const [settings, setSettings] = useState(initialSettings);

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

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
        {settings.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Live communication preferences are not connected yet.
          </div>
        ) : settings.map((setting) => (
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

        {settings.length > 0 && (
          <>
            <Separator />

            <div>
              <Label>Email frequency</Label>
              <Select>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="No live preference selected" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily digest</SelectItem>
                  <SelectItem value="weekly">Weekly digest</SelectItem>
                  <SelectItem value="instant">Instant notifications</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ConnectedAppsSection({
  initialApps,
  onDisconnectApp,
}: {
  initialApps: ConnectedApp[];
  onDisconnectApp?: (appId: string) => void | Promise<void>;
}) {
  const [apps, setApps] = useState(initialApps);
  const [disconnectDialog, setDisconnectDialog] = useState<ConnectedApp | null>(null);

  useEffect(() => {
    setApps(initialApps);
  }, [initialApps]);

  const handleDisconnect = async (appId: string) => {
    if (!onDisconnectApp) return;

    await onDisconnectApp(appId);
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
              disabled={!onDisconnectApp}
              title={onDisconnectApp ? undefined : 'App disconnection is not connected yet'}
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

function DataDownloadSection({
  dataCategories,
  onRequestDataDownload,
}: {
  dataCategories: DataCategory[];
  onRequestDataDownload?: (categoryIds: string[]) => void | Promise<void>;
}) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const handleDownload = async () => {
    if (!onRequestDataDownload || selectedCategories.length === 0) return;

    try {
      setIsRequesting(true);
      await onRequestDataDownload(selectedCategories);
    } finally {
      setIsRequesting(false);
    }
  };

  const toggleCategory = (id: string) => {
    setSelectedCategories(
      selectedCategories.includes(id)
        ? selectedCategories.filter(c => c !== id)
        : [...selectedCategories, id]
    );
  };

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
          {dataCategories.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Live export categories are not connected yet.
            </div>
          ) : dataCategories.map((category) => (
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
                    <Badge variant="secondary">{category.size ?? 'Size unavailable'}</Badge>
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

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {selectedCategories.length > 0
              ? `${selectedCategories.length} categories selected`
              : 'Select data categories to download'}
          </p>
          <Button
            onClick={handleDownload}
            disabled={!onRequestDataDownload || selectedCategories.length === 0 || isRequesting}
            title={onRequestDataDownload ? undefined : 'Data export requests are not connected yet'}
          >
            <Download className="h-4 w-4 mr-2" />
            {isRequesting ? 'Requesting...' : 'Request Export'}
          </Button>
        </div>

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

function DeleteAccountSection({ onDeleteAccount }: { onDeleteAccount?: () => void | Promise<void> }) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!onDeleteAccount || confirmText !== 'DELETE') return;

    try {
      setIsDeleting(true);
      await onDeleteAccount();
    } finally {
      setIsDeleting(false);
    }
  };

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
                disabled={!onDeleteAccount || confirmText !== 'DELETE' || isDeleting}
                title={onDeleteAccount ? undefined : 'Account deletion is not connected yet'}
                onClick={handleDelete}
              >
                {isDeleting ? 'Deleting...' : 'Permanently Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function CookieSettings({
  initialPreferences,
  onSaveCookiePreferences,
}: {
  initialPreferences?: Partial<CookiePreferences>;
  onSaveCookiePreferences?: (preferences: CookiePreferences) => void | Promise<void>;
}) {
  const [cookies, setCookies] = useState<CookiePreferences>(() => ({
    necessary: initialPreferences?.necessary ?? true,
    analytics: initialPreferences?.analytics ?? false,
    marketing: initialPreferences?.marketing ?? false,
    preferences: initialPreferences?.preferences ?? false,
  }));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setCookies({
      necessary: initialPreferences?.necessary ?? true,
      analytics: initialPreferences?.analytics ?? false,
      marketing: initialPreferences?.marketing ?? false,
      preferences: initialPreferences?.preferences ?? false,
    });
  }, [initialPreferences]);

  const handleSave = async () => {
    if (!onSaveCookiePreferences) return;

    try {
      setIsSaving(true);
      await onSaveCookiePreferences(cookies);
    } finally {
      setIsSaving(false);
    }
  };

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

        <Button
          variant="outline"
          onClick={handleSave}
          disabled={!onSaveCookiePreferences || isSaving}
          title={onSaveCookiePreferences ? undefined : 'Cookie preference persistence is not connected yet'}
        >
          {isSaving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function PrivacyCenterDashboard({
  className,
  profileVisibilitySettings = EMPTY_PRIVACY_SETTINGS,
  communicationSettings = EMPTY_PRIVACY_SETTINGS,
  connectedApps = EMPTY_CONNECTED_APPS,
  dataCategories = EMPTY_DATA_CATEGORIES,
  privacyScore = null,
  isLoading = false,
  error = null,
  initialCookiePreferences,
  onDisconnectApp,
  onRequestDataDownload,
  onDeleteAccount,
  onSaveCookiePreferences,
}: PrivacyCenterDashboardProps) {
  if (isLoading) {
    return (
      <div className={cn('container mx-auto py-8', className)}>
        <div className="rounded-lg border bg-white p-6 text-center text-sm text-muted-foreground shadow-sm dark:bg-zinc-900">
          Loading privacy center...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('container mx-auto py-8', className)}>
        <div className="rounded-lg border bg-white p-6 text-center shadow-sm dark:bg-zinc-900">
          <h2 className="font-semibold">Privacy center unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

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
      <PrivacyScore score={privacyScore} />

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
          <VisibilitySettings initialSettings={profileVisibilitySettings} />
        </TabsContent>

        <TabsContent value="communication">
          <CommunicationSettings initialSettings={communicationSettings} />
        </TabsContent>

        <TabsContent value="apps">
          <ConnectedAppsSection initialApps={connectedApps} onDisconnectApp={onDisconnectApp} />
        </TabsContent>

        <TabsContent value="cookies">
          <CookieSettings
            initialPreferences={initialCookiePreferences}
            onSaveCookiePreferences={onSaveCookiePreferences}
          />
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <DataDownloadSection
            dataCategories={dataCategories}
            onRequestDataDownload={onRequestDataDownload}
          />
          <DeleteAccountSection onDeleteAccount={onDeleteAccount} />
        </TabsContent>
      </Tabs>

      {/* Legal Links */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <a href="/privacy" className="flex items-center gap-1 text-primary hover:underline">
              <FileText className="h-4 w-4" />
              Privacy Policy
            </a>
            <a href="/terms" className="flex items-center gap-1 text-primary hover:underline">
              <FileText className="h-4 w-4" />
              Terms of Service
            </a>
            <a href="/cookies" className="flex items-center gap-1 text-primary hover:underline">
              <Cookie className="h-4 w-4" />
              Cookie Policy
            </a>
            <a href="/settings/privacy" className="flex items-center gap-1 text-primary hover:underline">
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
