'use client';

/**
 * Safety Center Access
 * Phase 4: Web Client - Persona Studios
 * Step 74: Security tools and account protection
 * 
 * Features:
 * - Account security overview
 * - Two-factor authentication
 * - Login activity
 * - Active sessions
 * - Password management
 * - Recovery options
 */

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Key,
  Smartphone,
  Mail,
  Lock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Monitor,
  Laptop,
  Tablet,
  Globe,
  MapPin,
  Clock,
  RefreshCw,
  Eye,
  EyeOff,
  LogOut,
  MoreHorizontal,
  Info,
  Download,
  AlertCircle,
  Fingerprint,
  QrCode,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

// ============================================
// TYPES
// ============================================

export interface SecurityCheck {
  id: string;
  label: string;
  status: 'passed' | 'warning' | 'failed';
  action?: string;
}

export interface ActiveSession {
  id: string;
  device: string;
  deviceType: 'desktop' | 'laptop' | 'tablet' | 'mobile';
  browser: string;
  location: string;
  ip: string;
  lastActive: Date;
  isCurrent: boolean;
}

export interface LoginActivity {
  id: string;
  type: 'success' | 'failed';
  device: string;
  location: string;
  ip: string;
  timestamp: Date;
  reason?: string;
}

interface SafetyCenterAccessProps {
  className?: string;
  securityChecks?: SecurityCheck[];
  activeSessions?: ActiveSession[];
  loginActivity?: LoginActivity[];
  securityScore?: number | null;
  isTwoFactorEnabled?: boolean;
  passwordLastChangedLabel?: string | null;
  isLoading?: boolean;
  error?: string | null;
  onStartTwoFactorSetup?: () => void | Promise<void>;
  onRevokeSession?: (sessionId: string) => void | Promise<void>;
  onRevokeAllSessions?: () => void | Promise<void>;
  onRequestPasswordChange?: () => void | Promise<void>;
}

const EMPTY_SECURITY_CHECKS: SecurityCheck[] = [];
const EMPTY_ACTIVE_SESSIONS: ActiveSession[] = [];
const EMPTY_LOGIN_ACTIVITY: LoginActivity[] = [];

// ============================================
// COMPONENTS
// ============================================

function SecurityScoreCard({
  checks,
  score,
}: {
  checks: SecurityCheck[];
  score?: number | null;
}) {
  const passedChecks = checks.filter(c => c.status === 'passed').length;
  const totalChecks = checks.length;
  const derivedScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : null;
  const normalizedScore = score === null || score === undefined
    ? derivedScore
    : Math.max(0, Math.min(100, score));

  if (normalizedScore === null) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Shield className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Security Score Unavailable</h3>
              <p className="text-sm text-muted-foreground">
                Live account security checks have not been connected yet.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-6">
          <div className="relative h-28 w-28">
            <svg className="transform -rotate-90 h-28 w-28">
              <circle
                cx="56"
                cy="56"
                r="48"
                className="stroke-muted fill-none"
                strokeWidth="10"
              />
              <circle
                cx="56"
                cy="56"
                r="48"
                className={cn(
                  'fill-none',
                  normalizedScore >= 80 ? 'stroke-emerald-500' :
                  normalizedScore >= 60 ? 'stroke-yellow-500' : 'stroke-red-500'
                )}
                strokeWidth="10"
                strokeDasharray={`${(normalizedScore / 100) * 301} 301`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold">{normalizedScore}</span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">Security Score</h3>
            <p className="text-sm text-muted-foreground mb-3">
              {totalChecks > 0
                ? `${passedChecks} of ${totalChecks} security checks passed`
                : 'No live security checks returned'}
            </p>
            <div className="space-y-2">
              {checks.length === 0 ? (
                <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  Security checks will appear here when connected.
                </div>
              ) : checks.map((check) => (
                <div key={check.id} className="flex items-center gap-2 text-sm">
                  {check.status === 'passed' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : check.status === 'warning' ? (
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className={cn(
                    check.status !== 'passed' && 'text-muted-foreground'
                  )}>
                    {check.label}
                  </span>
                  {check.action && (
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                      {check.action}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TwoFactorSection({
  enabled,
  onStartSetup,
}: {
  enabled: boolean;
  onStartSetup?: () => void | Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="h-5 w-5" />
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Add an extra layer of security to your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!enabled ? (
          <>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Recommended</AlertTitle>
              <AlertDescription>
                Two-factor authentication adds an extra layer of security to your account.
                Even if someone gets your password, they can&apos;t access your account without the second factor.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <div
                className={cn(
                  'flex items-center gap-4 p-4 border rounded-lg',
                  onStartSetup ? 'hover:bg-muted cursor-pointer' : 'opacity-70'
                )}
                onClick={() => onStartSetup?.()}
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Smartphone className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">Authenticator App</h4>
                  <p className="text-sm text-muted-foreground">
                    Use an app like Google Authenticator or Authy
                  </p>
                </div>
                <Badge variant="outline">Recommended</Badge>
              </div>

              <div className="flex items-center gap-4 p-4 border rounded-lg opacity-70">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <Key className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">Security Key</h4>
                  <p className="text-sm text-muted-foreground">
                    Use a physical security key (YubiKey, etc.)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 border rounded-lg opacity-70">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">SMS/Email Codes</h4>
                  <p className="text-sm text-muted-foreground">
                    Receive verification codes via SMS or email
                  </p>
                </div>
              </div>
            </div>

            {!onStartSetup && (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Two-factor setup is not connected yet. Live setup should provide the QR secret
                and backup codes from the server.
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-emerald-600" />
              <div>
                <h4 className="font-medium">2FA is enabled</h4>
                <p className="text-sm text-muted-foreground">
                  Using Authenticator App
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              Manage
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActiveSessionsSection({
  initialSessions,
  onRevokeSession,
  onRevokeAllSessions,
}: {
  initialSessions: ActiveSession[];
  onRevokeSession?: (sessionId: string) => void | Promise<void>;
  onRevokeAllSessions?: () => void | Promise<void>;
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [revokeDialog, setRevokeDialog] = useState<ActiveSession | null>(null);

  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'desktop': return Monitor;
      case 'laptop': return Laptop;
      case 'tablet': return Tablet;
      default: return Smartphone;
    }
  };

  const handleRevoke = async (sessionId: string) => {
    if (!onRevokeSession) return;

    await onRevokeSession(sessionId);
    setSessions(sessions.filter(s => s.id !== sessionId));
    setRevokeDialog(null);
  };

  const handleRevokeAll = async () => {
    if (!onRevokeAllSessions) return;

    await onRevokeAllSessions();
    setSessions(sessions.filter(s => s.isCurrent));
  };

  const hasOtherSessions = sessions.some(session => !session.isCurrent);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Active Sessions
            </CardTitle>
            <CardDescription>
              Devices currently logged into your account
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!onRevokeAllSessions || !hasOtherSessions}
            title={onRevokeAllSessions ? undefined : 'Session revocation is not connected yet'}
            onClick={handleRevokeAll}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out all
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessions.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Live active sessions are not connected yet.
          </div>
        ) : sessions.map((session) => {
          const DeviceIcon = getDeviceIcon(session.deviceType);
          return (
            <div
              key={session.id}
              className={cn(
                'flex items-center justify-between p-4 border rounded-lg',
                session.isCurrent && 'border-primary bg-primary/5'
              )}
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <DeviceIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{session.device}</h4>
                    {session.isCurrent && (
                      <Badge variant="secondary" className="text-xs">
                        This device
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {session.browser} • {session.location}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {session.isCurrent ? 'Active now' : `Last active ${session.lastActive.toLocaleString()}`}
                  </p>
                </div>
              </div>
              {!session.isCurrent && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={!onRevokeSession}
                      onClick={() => setRevokeDialog(session)}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}

        <Dialog open={!!revokeDialog} onOpenChange={() => setRevokeDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sign out this device?</DialogTitle>
              <DialogDescription>
                This will sign out {revokeDialog?.device} from your account.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRevokeDialog(null)}>
                Cancel
              </Button>
              <Button onClick={() => revokeDialog && handleRevoke(revokeDialog.id)}>
                Sign out
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function LoginActivitySection({ activities }: { activities: LoginActivity[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Login Activity
        </CardTitle>
        <CardDescription>
          Recent attempts to access your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-3">
            {activities.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Live login activity is not connected yet.
              </div>
            ) : activities.map((activity) => (
              <div
                key={activity.id}
                className={cn(
                  'flex items-start gap-4 p-4 border rounded-lg',
                  activity.type === 'failed' && 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/10'
                )}
              >
                <div className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center',
                  activity.type === 'success'
                    ? 'bg-emerald-100 dark:bg-emerald-900/30'
                    : 'bg-red-100 dark:bg-red-900/30'
                )}>
                  {activity.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">
                      {activity.type === 'success' ? 'Successful login' : 'Failed login attempt'}
                    </h4>
                    {activity.type === 'failed' && (
                      <Badge variant="destructive" className="text-xs">
                        Blocked
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{activity.device}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {activity.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {activity.timestamp.toLocaleString()}
                    </span>
                  </div>
                  {activity.reason && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      Reason: {activity.reason}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function PasswordSection({
  passwordLastChangedLabel,
  onRequestPasswordChange,
}: {
  passwordLastChangedLabel?: string | null;
  onRequestPasswordChange?: () => void | Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Password
        </CardTitle>
        <CardDescription>
          Manage your account password
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Password</p>
            <p className="text-sm text-muted-foreground">
              {passwordLastChangedLabel ?? 'Password history is not connected yet'}
            </p>
          </div>
          <Button
            variant="outline"
            disabled={!onRequestPasswordChange}
            title={onRequestPasswordChange ? undefined : 'Password change is not connected yet'}
            onClick={() => onRequestPasswordChange?.()}
          >
            Change password
          </Button>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Password tips</AlertTitle>
          <AlertDescription>
            Use a strong password with at least 12 characters, including uppercase,
            lowercase, numbers, and symbols.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function SafetyCenterAccess({
  className,
  securityChecks = EMPTY_SECURITY_CHECKS,
  activeSessions = EMPTY_ACTIVE_SESSIONS,
  loginActivity = EMPTY_LOGIN_ACTIVITY,
  securityScore = null,
  isTwoFactorEnabled = false,
  passwordLastChangedLabel = null,
  isLoading = false,
  error = null,
  onStartTwoFactorSetup,
  onRevokeSession,
  onRevokeAllSessions,
  onRequestPasswordChange,
}: SafetyCenterAccessProps) {
  if (isLoading) {
    return (
      <div className={cn('container mx-auto py-8', className)}>
        <div className="rounded-lg border bg-white p-6 text-center text-sm text-muted-foreground shadow-sm dark:bg-zinc-900">
          Loading safety center...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('container mx-auto py-8', className)}>
        <div className="rounded-lg border bg-white p-6 text-center shadow-sm dark:bg-zinc-900">
          <h2 className="font-semibold">Safety center unavailable</h2>
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
          <ShieldCheck className="h-8 w-8 text-emerald-500" />
          Safety Center
        </h1>
        <p className="text-muted-foreground mt-1">
          Protect your account with advanced security settings
        </p>
      </div>

      {/* Security Score */}
      <SecurityScoreCard checks={securityChecks} score={securityScore} />

      {/* Main Content */}
      <Tabs defaultValue="2fa" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="2fa">Two-Factor Auth</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
        </TabsList>

        <TabsContent value="2fa">
          <TwoFactorSection enabled={isTwoFactorEnabled} onStartSetup={onStartTwoFactorSetup} />
        </TabsContent>

        <TabsContent value="sessions">
          <ActiveSessionsSection
            initialSessions={activeSessions}
            onRevokeSession={onRevokeSession}
            onRevokeAllSessions={onRevokeAllSessions}
          />
        </TabsContent>

        <TabsContent value="activity">
          <LoginActivitySection activities={loginActivity} />
        </TabsContent>

        <TabsContent value="password">
          <PasswordSection
            passwordLastChangedLabel={passwordLastChangedLabel}
            onRequestPasswordChange={onRequestPasswordChange}
          />
        </TabsContent>
      </Tabs>

      {/* Help Card */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Info className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium">Need help?</h4>
              <p className="text-sm text-muted-foreground">
                If you notice suspicious activity, contact our support team immediately.
              </p>
            </div>
            <Button variant="outline">Contact Support</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SafetyCenterAccess;
