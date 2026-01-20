'use client';

import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  MessageCircleWarning,
  UserX,
  CheckCircle2,
  Clock,
  Phone,
  BookOpen,
  LifeBuoy,
  ArrowUpRight,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal, ModalContent, ModalFooter } from '@/components/ui/modal';
import { safetyApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { InlineAlert } from '@/components/ui/alert';

interface ReportRecord {
  id: string;
  targetType: string;
  status: string;
  createdAt: string;
  reason: string;
  targetId?: string;
}

interface BlockRecord {
  id: string;
  blockedUserId: string;
  reason?: string;
  createdAt: string;
  user?: {
    id: string;
    displayName?: string | null;
    avatar?: string | null;
    headline?: string | null;
  } | null;
}

interface SafetySettings {
  allowMessages: boolean;
  isSafeMode: boolean;
  hideFromSearch: boolean;
}

type ReportTargetType = 'post' | 'video' | 'user' | 'message' | 'channel' | 'other';

const resources = [
  {
    id: 'res-1',
    title: '24/7 Safety Support Line',
    description: 'Immediate assistance for urgent safety concerns.',
    action: 'Call Support',
    icon: Phone,
  },
  {
    id: 'res-2',
    title: 'Community Guidelines',
    description: 'Understand our expectations for respectful behavior.',
    action: 'Read Guidelines',
    icon: BookOpen,
  },
  {
    id: 'res-3',
    title: 'Report Center',
    description: 'Submit a new report or follow up on an existing case.',
    action: 'Open Report Center',
    icon: LifeBuoy,
  },
];

export default function SafetyCenterPage() {
  const [tab, setTab] = useState('reports');
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockRecord[]>([]);
  const [settings, setSettings] = useState<SafetySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isBlockOpen, setIsBlockOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reportForm, setReportForm] = useState<{
    targetType: ReportTargetType;
    targetId: string;
    reason: string;
    details: string;
  }>({
    targetType: 'post',
    targetId: '',
    reason: '',
    details: '',
  });
  const [blockForm, setBlockForm] = useState({
    blockedUserId: '',
    reason: '',
  });

  useEffect(() => {
    const loadSafetyData = async () => {
      try {
        const [reportsRes, blocksRes, settingsRes] = await Promise.all([
          safetyApi.getReports(),
          safetyApi.getBlocks(),
          safetyApi.getSettings(),
        ]);

        setReports(reportsRes.data.data || []);
        setBlockedUsers(blocksRes.data.data || []);
        setSettings(settingsRes.data.data || null);
      } catch (error) {
        console.error('Failed to load safety data', error);
        setErrorMessage('We could not load your safety data. Please try again.');
        toast.error('Failed to load Safety Center data.');
      } finally {
        setIsLoading(false);
      }
    };

    loadSafetyData();
  }, []);

  const handleReportSubmit = async () => {
    if (!reportForm.reason.trim()) return;
    try {
      await safetyApi.createReport({
        targetType: reportForm.targetType,
        targetId: reportForm.targetId || undefined,
        reason: reportForm.reason,
        details: reportForm.details || undefined,
      });
      const reportsRes = await safetyApi.getReports();
      setReports(reportsRes.data.data || []);
      setIsReportOpen(false);
      setReportForm({ targetType: 'post', targetId: '', reason: '', details: '' });
      setSuccessMessage('Report submitted. Our safety team will review it soon.');
      setErrorMessage(null);
      toast.success('Report submitted.');
    } catch (error) {
      console.error('Failed to submit report', error);
      setErrorMessage('We could not submit your report. Please try again.');
      setSuccessMessage(null);
      toast.error('Report submission failed.');
    }
  };

  const handleBlockSubmit = async () => {
    if (!blockForm.blockedUserId.trim()) return;
    try {
      await safetyApi.blockUser({
        blockedUserId: blockForm.blockedUserId,
        reason: blockForm.reason || undefined,
      });
      const blocksRes = await safetyApi.getBlocks();
      setBlockedUsers(blocksRes.data.data || []);
      setIsBlockOpen(false);
      setBlockForm({ blockedUserId: '', reason: '' });
      setSuccessMessage('User blocked successfully.');
      setErrorMessage(null);
      toast.success('User blocked.');
    } catch (error) {
      console.error('Failed to block user', error);
      setErrorMessage('We could not block that user. Please try again.');
      setSuccessMessage(null);
      toast.error('Failed to block user.');
    }
  };

  const handleUnblock = async (blockedUserId: string) => {
    try {
      await safetyApi.unblockUser(blockedUserId);
      setBlockedUsers((prev) => prev.filter((item) => item.blockedUserId !== blockedUserId));
      setSuccessMessage('User unblocked successfully.');
      setErrorMessage(null);
      toast.success('User unblocked.');
    } catch (error) {
      console.error('Failed to unblock user', error);
      setErrorMessage('We could not unblock that user. Please try again.');
      setSuccessMessage(null);
      toast.error('Failed to unblock user.');
    }
  };

  const updateSetting = async (patch: Partial<SafetySettings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      await safetyApi.updateSettings(patch);
      setSuccessMessage('Safety settings updated.');
      setErrorMessage(null);
      toast.success('Settings saved.');
    } catch (error) {
      console.error('Failed to update settings', error);
      setErrorMessage('We could not update your safety settings.');
      setSuccessMessage(null);
      toast.error('Failed to update settings.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Safety Center</h1>
                <p className="text-gray-600">Your central hub for safety tools, reports, and support.</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setIsReportOpen(true)}>
              <MessageCircleWarning className="w-4 h-4 mr-2" />
              Report Content
            </Button>
            <Button onClick={() => setTab('resources')}>
              <AlertTriangle className="w-4 h-4 mr-2" />
              Emergency Support
            </Button>
          </div>
        </div>

        {(successMessage || errorMessage) && (
          <div className="mb-6 space-y-3">
            {successMessage && (
              <InlineAlert tone="success" onDismiss={() => setSuccessMessage(null)}>
                {successMessage}
              </InlineAlert>
            )}
            {errorMessage && (
              <InlineAlert tone="error" onDismiss={() => setErrorMessage(null)}>
                {errorMessage}
              </InlineAlert>
            )}
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white rounded-xl px-2">
            <TabsTrigger value="reports" icon={<AlertTriangle className="w-4 h-4" />}>
              Reports
            </TabsTrigger>
            <TabsTrigger value="blocked" icon={<UserX className="w-4 h-4" />}>
              Blocked Users
            </TabsTrigger>
            <TabsTrigger value="tools" icon={<ShieldCheck className="w-4 h-4" />}>
              Safety Tools
            </TabsTrigger>
            <TabsTrigger value="resources" icon={<LifeBuoy className="w-4 h-4" />}>
              Resources
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Report History</CardTitle>
                  <CardDescription>Track the status of your submitted reports.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoading && <p className="text-sm text-gray-500">Loading reports...</p>}
                  {!isLoading && reports.length === 0 && (
                    <p className="text-sm text-gray-500">No reports submitted yet.</p>
                  )}
                  {reports.map((report) => (
                    <div
                      key={report.id}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 border border-gray-100 rounded-xl"
                    >
                      <div>
                        <p className="text-sm text-gray-500">{report.targetType.toUpperCase()}</p>
                        <h3 className="text-lg font-semibold text-gray-900">{report.reason}</h3>
                        <p className="text-sm text-gray-500">Reported on {new Date(report.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="secondary"
                          className={
                            report.status === 'ACTION_TAKEN'
                              ? 'bg-green-100 text-green-700'
                              : report.status === 'CLOSED'
                              ? 'bg-gray-100 text-gray-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }
                        >
                          {report.status.replace('_', ' ')}
                        </Badge>
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Active Cases</CardTitle>
                  <CardDescription>Average response time: 24 hours</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-yellow-500" />
                    <div>
                      <p className="text-sm text-gray-500">Open reports</p>
                      <p className="text-xl font-semibold text-gray-900">
                        {reports.filter((item) => item.status !== 'CLOSED' && item.status !== 'ACTION_TAKEN').length}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-sm text-gray-500">Resolved reports</p>
                      <p className="text-xl font-semibold text-gray-900">
                        {reports.filter((item) => item.status === 'CLOSED' || item.status === 'ACTION_TAKEN').length}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full">
                    Visit Report Center
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="blocked">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Blocked Users</CardTitle>
                  <CardDescription>Manage who can contact you on ATHENA.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoading && <p className="text-sm text-gray-500">Loading blocks...</p>}
                  {!isLoading && blockedUsers.length === 0 && (
                    <p className="text-sm text-gray-500">No blocked users yet.</p>
                  )}
                  {blockedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 border border-gray-100 rounded-xl"
                    >
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {user.user?.displayName || user.blockedUserId}
                        </h3>
                        {user.reason && <p className="text-sm text-gray-500">Reason: {user.reason}</p>}
                        <p className="text-sm text-gray-500">Blocked on {new Date(user.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleUnblock(user.blockedUserId)}>
                          Unblock
                        </Button>
                        <Button size="sm">View Profile</Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Control Your Inbox</CardTitle>
                  <CardDescription>Prevent unwanted messages with safeguards.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Allow Messages</p>
                      <p className="text-xs text-gray-500">Control who can message you.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings?.allowMessages ?? true}
                      onChange={(event) => updateSetting({ allowMessages: event.target.checked })}
                      className="h-5 w-5"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Safe Mode</p>
                      <p className="text-xs text-gray-500">Enable high safety protections.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings?.isSafeMode ?? false}
                      onChange={(event) => updateSetting({ isSafeMode: event.target.checked })}
                      className="h-5 w-5"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Hide from Search</p>
                      <p className="text-xs text-gray-500">Hide your profile from discovery.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings?.hideFromSearch ?? false}
                      onChange={(event) => updateSetting({ hideFromSearch: event.target.checked })}
                      className="h-5 w-5"
                    />
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => setIsBlockOpen(true)}>
                    Block a User
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tools">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  id: 'tool-1',
                  title: 'Profile Visibility',
                  description: 'Limit profile discovery to verified employers and approved mentors.',
                  status: settings?.hideFromSearch ? 'Limited' : 'Open',
                },
                {
                  id: 'tool-2',
                  title: 'DM Requests',
                  description: 'Require message requests from new contacts.',
                  status: settings?.allowMessages ? 'Enabled' : 'Restricted',
                },
                {
                  id: 'tool-3',
                  title: 'Safety Mode',
                  description: 'Enable higher safety protections across the platform.',
                  status: settings?.isSafeMode ? 'On' : 'Off',
                },
              ].map((tool) => (
                <Card key={tool.id}>
                  <CardHeader>
                    <CardTitle>{tool.title}</CardTitle>
                    <CardDescription>{tool.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <Badge className="bg-indigo-100 text-indigo-700">{tool.status}</Badge>
                    <Button variant="outline" size="sm">
                      Manage
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="resources">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {resources.map((resource) => (
                <Card key={resource.id}>
                  <CardHeader>
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <resource.icon className="w-5 h-5 text-indigo-600" />
                    </div>
                    <CardTitle>{resource.title}</CardTitle>
                    <CardDescription>{resource.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" variant="outline">
                      {resource.action}
                      <ArrowUpRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Modal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        title="Report content"
        description="Tell us what happened so our team can review."
      >
        <ModalContent className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-gray-700">Target type</label>
            <select
              value={reportForm.targetType}
              onChange={(event) =>
                setReportForm((prev) => ({
                  ...prev,
                  targetType: event.target.value as ReportTargetType,
                }))
              }
              className="w-full rounded-lg border border-gray-200 p-2"
            >
              <option value="post">Post</option>
              <option value="video">Video</option>
              <option value="user">User</option>
              <option value="message">Message</option>
              <option value="channel">Channel</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-gray-700">Target ID (optional)</label>
            <input
              value={reportForm.targetId}
              onChange={(event) => setReportForm((prev) => ({ ...prev, targetId: event.target.value }))}
              className="w-full rounded-lg border border-gray-200 p-2"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-gray-700">Reason</label>
            <input
              value={reportForm.reason}
              onChange={(event) => setReportForm((prev) => ({ ...prev, reason: event.target.value }))}
              placeholder="e.g. Harassment, spam, impersonation"
              className="w-full rounded-lg border border-gray-200 p-2"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-gray-700">Additional details</label>
            <textarea
              value={reportForm.details}
              onChange={(event) => setReportForm((prev) => ({ ...prev, details: event.target.value }))}
              rows={4}
              className="w-full rounded-lg border border-gray-200 p-2"
            />
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="outline" onClick={() => setIsReportOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleReportSubmit}>Submit report</Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={isBlockOpen}
        onClose={() => setIsBlockOpen(false)}
        title="Block a user"
        description="Prevent a user from contacting you on ATHENA."
      >
        <ModalContent className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-gray-700">User ID</label>
            <input
              value={blockForm.blockedUserId}
              onChange={(event) => setBlockForm((prev) => ({ ...prev, blockedUserId: event.target.value }))}
              className="w-full rounded-lg border border-gray-200 p-2"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-gray-700">Reason (optional)</label>
            <input
              value={blockForm.reason}
              onChange={(event) => setBlockForm((prev) => ({ ...prev, reason: event.target.value }))}
              className="w-full rounded-lg border border-gray-200 p-2"
            />
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="outline" onClick={() => setIsBlockOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleBlockSubmit}>Block user</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
