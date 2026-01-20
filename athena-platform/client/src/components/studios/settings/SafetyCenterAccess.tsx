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

import React, { useState } from 'react';
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

interface SecurityCheck {
  id: string;
  label: string;
  status: 'passed' | 'warning' | 'failed';
  action?: string;
}

interface ActiveSession {
  id: string;
  device: string;
  deviceType: 'desktop' | 'laptop' | 'tablet' | 'mobile';
  browser: string;
  location: string;
  ip: string;
  lastActive: Date;
  isCurrent: boolean;
}

interface LoginActivity {
  id: string;
  type: 'success' | 'failed';
  device: string;
  location: string;
  ip: string;
  timestamp: Date;
  reason?: string;
}

// ============================================
// MOCK DATA
// ============================================

const SECURITY_CHECKS: SecurityCheck[] = [
  { id: 'password', label: 'Strong password', status: 'passed' },
  { id: '2fa', label: 'Two-factor authentication', status: 'warning', action: 'Enable' },
  { id: 'email', label: 'Email verified', status: 'passed' },
  { id: 'phone', label: 'Phone number verified', status: 'failed', action: 'Verify' },
  { id: 'recovery', label: 'Recovery email set', status: 'passed' },
];

const ACTIVE_SESSIONS: ActiveSession[] = [
  {
    id: '1',
    device: 'Windows PC',
    deviceType: 'desktop',
    browser: 'Chrome 120',
    location: 'Dubai, UAE',
    ip: '192.168.1.xxx',
    lastActive: new Date(),
    isCurrent: true,
  },
  {
    id: '2',
    device: 'iPhone 15',
    deviceType: 'mobile',
    browser: 'Safari',
    location: 'Dubai, UAE',
    ip: '192.168.1.xxx',
    lastActive: new Date(Date.now() - 3600000),
    isCurrent: false,
  },
  {
    id: '3',
    device: 'MacBook Pro',
    deviceType: 'laptop',
    browser: 'Firefox 121',
    location: 'Abu Dhabi, UAE',
    ip: '10.0.0.xxx',
    lastActive: new Date(Date.now() - 86400000),
    isCurrent: false,
  },
];

const LOGIN_ACTIVITY: LoginActivity[] = [
  {
    id: '1',
    type: 'success',
    device: 'Windows PC - Chrome',
    location: 'Dubai, UAE',
    ip: '192.168.1.xxx',
    timestamp: new Date(),
  },
  {
    id: '2',
    type: 'success',
    device: 'iPhone 15 - Safari',
    location: 'Dubai, UAE',
    ip: '192.168.1.xxx',
    timestamp: new Date(Date.now() - 3600000),
  },
  {
    id: '3',
    type: 'failed',
    device: 'Unknown device',
    location: 'Moscow, Russia',
    ip: '95.xxx.xxx.xxx',
    timestamp: new Date(Date.now() - 7200000),
    reason: 'Incorrect password',
  },
  {
    id: '4',
    type: 'success',
    device: 'MacBook Pro - Firefox',
    location: 'Abu Dhabi, UAE',
    ip: '10.0.0.xxx',
    timestamp: new Date(Date.now() - 86400000),
  },
];

// ============================================
// COMPONENTS
// ============================================

function SecurityScoreCard() {
  const score = 75;
  const passedChecks = SECURITY_CHECKS.filter(c => c.status === 'passed').length;
  const totalChecks = SECURITY_CHECKS.length;

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
                  score >= 80 ? 'stroke-emerald-500' :
                  score >= 60 ? 'stroke-yellow-500' : 'stroke-red-500'
                )}
                strokeWidth="10"
                strokeDasharray={`${(score / 100) * 301} 301`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold">{score}</span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">Security Score</h3>
            <p className="text-sm text-muted-foreground mb-3">
              {passedChecks} of {totalChecks} security checks passed
            </p>
            <div className="space-y-2">
              {SECURITY_CHECKS.map((check) => (
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

function TwoFactorSection() {
  const [enabled, setEnabled] = useState(false);
  const [setupDialog, setSetupDialog] = useState(false);
  const [step, setStep] = useState(1);

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
                className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted cursor-pointer"
                onClick={() => setSetupDialog(true)}
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

              <div className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted cursor-pointer">
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

              <div className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted cursor-pointer">
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

        <Dialog open={setupDialog} onOpenChange={setSetupDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set up Authenticator App</DialogTitle>
              <DialogDescription>
                {step === 1 && 'Scan the QR code with your authenticator app'}
                {step === 2 && 'Enter the 6-digit code from your app'}
                {step === 3 && 'Save your backup codes'}
              </DialogDescription>
            </DialogHeader>

            {step === 1 && (
              <div className="text-center py-4">
                <div className="h-48 w-48 mx-auto bg-muted rounded-lg flex items-center justify-center">
                  <QrCode className="h-24 w-24 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  Can&apos;t scan? Enter this code manually:
                </p>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  ABCD-EFGH-IJKL-MNOP
                </code>
              </div>
            )}

            {step === 2 && (
              <div className="py-4">
                <Label>Verification code</Label>
                <Input
                  placeholder="000000"
                  className="text-center text-2xl tracking-widest mt-2"
                  maxLength={6}
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Save these codes</AlertTitle>
                  <AlertDescription>
                    These backup codes can be used if you lose access to your authenticator app.
                    Each code can only be used once.
                  </AlertDescription>
                </Alert>
                <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg font-mono text-sm">
                  <div>XXXX-XXXX-1</div>
                  <div>XXXX-XXXX-2</div>
                  <div>XXXX-XXXX-3</div>
                  <div>XXXX-XXXX-4</div>
                  <div>XXXX-XXXX-5</div>
                  <div>XXXX-XXXX-6</div>
                </div>
                <Button variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download Codes
                </Button>
              </div>
            )}

            <DialogFooter>
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              )}
              {step < 3 ? (
                <Button onClick={() => setStep(step + 1)}>
                  Continue
                </Button>
              ) : (
                <Button onClick={() => {
                  setEnabled(true);
                  setSetupDialog(false);
                  setStep(1);
                }}>
                  Done
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function ActiveSessionsSection() {
  const [sessions, setSessions] = useState(ACTIVE_SESSIONS);
  const [revokeDialog, setRevokeDialog] = useState<ActiveSession | null>(null);

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'desktop': return Monitor;
      case 'laptop': return Laptop;
      case 'tablet': return Tablet;
      default: return Smartphone;
    }
  };

  const handleRevoke = (sessionId: string) => {
    setSessions(sessions.filter(s => s.id !== sessionId));
    setRevokeDialog(null);
  };

  const handleRevokeAll = () => {
    setSessions(sessions.filter(s => s.isCurrent));
  };

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
          <Button variant="outline" size="sm" onClick={handleRevokeAll}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign out all
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessions.map((session) => {
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
                    <DropdownMenuItem onClick={() => setRevokeDialog(session)}>
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

function LoginActivitySection() {
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
            {LOGIN_ACTIVITY.map((activity) => (
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

function PasswordSection() {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changeDialogOpen, setChangeDialogOpen] = useState(false);

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
              Last changed 30 days ago
            </p>
          </div>
          <Button variant="outline" onClick={() => setChangeDialogOpen(true)}>
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

        <Dialog open={changeDialogOpen} onOpenChange={setChangeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change password</DialogTitle>
              <DialogDescription>
                Enter your current password and choose a new one
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Current password</Label>
                <div className="relative">
                  <Input
                    type={showCurrentPassword ? 'text' : 'password'}
                    placeholder="Enter current password"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>New password</Label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Enter new password"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Confirm new password</Label>
                <Input
                  type="password"
                  placeholder="Confirm new password"
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Password requirements:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    At least 12 characters
                  </li>
                  <li className="flex items-center gap-2">
                    <XCircle className="h-3 w-3 text-muted-foreground" />
                    One uppercase letter
                  </li>
                  <li className="flex items-center gap-2">
                    <XCircle className="h-3 w-3 text-muted-foreground" />
                    One number
                  </li>
                  <li className="flex items-center gap-2">
                    <XCircle className="h-3 w-3 text-muted-foreground" />
                    One special character
                  </li>
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setChangeDialogOpen(false)}>
                Cancel
              </Button>
              <Button>Update password</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function SafetyCenterAccess({ className }: { className?: string }) {
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
      <SecurityScoreCard />

      {/* Main Content */}
      <Tabs defaultValue="2fa" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="2fa">Two-Factor Auth</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
        </TabsList>

        <TabsContent value="2fa">
          <TwoFactorSection />
        </TabsContent>

        <TabsContent value="sessions">
          <ActiveSessionsSection />
        </TabsContent>

        <TabsContent value="activity">
          <LoginActivitySection />
        </TabsContent>

        <TabsContent value="password">
          <PasswordSection />
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
