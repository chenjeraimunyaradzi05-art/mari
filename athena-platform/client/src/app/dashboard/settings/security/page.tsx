'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Key,
  Smartphone,
  Monitor,
  MapPin,
  Clock,
  AlertTriangle,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';
import { useAuth, useDeleteAccount } from '@/lib/hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

type PasswordFormData = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type SessionItem = {
  id: string;
  device: string;
  isCurrent: boolean;
  location: string;
  lastActive: string;
};

type TwoFactorStatus = {
  enabled: boolean;
  enabledAt?: string | null;
  setupPending?: boolean;
};

type TwoFactorSetup = {
  secret: string;
  issuer: string;
  accountName: string;
  otpauthUrl: string;
};

export default function SecuritySettingsPage() {
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetup | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [disableTwoFactorCode, setDisableTwoFactorCode] = useState('');
  const [disableTwoFactorPassword, setDisableTwoFactorPassword] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<PasswordFormData>();

  const newPassword = watch('newPassword');

  // Get active sessions
  const { data: sessions = [], isLoading: isLoadingSessions, isError: isSessionsError } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get('/auth/sessions'),
    select: (response) => {
      const rawSessions = (response.data.data ?? []) as Array<{
        id: string;
        userAgent?: string | null;
        ipAddress?: string | null;
        createdAt?: string;
        expiresAt?: string;
        isCurrent?: boolean;
      }>;

      return rawSessions.map((session) => ({
        id: session.id,
        device: session.userAgent || 'Unknown device',
        isCurrent: Boolean(session.isCurrent),
        location: session.ipAddress ? `IP ${session.ipAddress}` : 'Unknown location',
        lastActive: session.createdAt || session.expiresAt || new Date().toISOString(),
      }));
    },
  });
  const deleteAccount = useDeleteAccount();

  const {
    data: twoFactorStatus,
    isLoading: isLoadingTwoFactorStatus,
    isError: isTwoFactorStatusError,
  } = useQuery({
    queryKey: ['two-factor-status'],
    queryFn: () => api.get('/auth/2fa/status'),
    select: (response): TwoFactorStatus => response.data.data,
  });

  // Change password mutation
  const changePassword = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.post('/auth/change-password', data),
    onSuccess: () => {
      toast.success('Password changed successfully');
      reset();
    },
    onError: (error: unknown) => {
      const responseMessage = (
        error as { response?: { data?: { message?: string } } }
      )?.response?.data?.message;
      toast.error(responseMessage || 'Failed to change password');
    },
  });

  // Revoke session mutation
  const revokeSession = useMutation({
    mutationFn: (sessionId: string) =>
      api.delete(`/auth/sessions/${sessionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session revoked');
    },
    onError: () => {
      toast.error('Failed to revoke session');
    },
  });

  // Revoke all sessions mutation
  const revokeAllSessions = useMutation({
    mutationFn: () => api.post('/auth/logout-all'),
    onSuccess: () => {
      toast.success('All sessions revoked. Please log in again.');
      logout();
    },
    onError: () => {
      toast.error('Failed to revoke sessions');
    },
  });

  const startTwoFactorSetup = useMutation({
    mutationFn: () => api.post('/auth/2fa/setup'),
    onSuccess: (response) => {
      setTwoFactorSetup(response.data.data);
      setTwoFactorCode('');
      queryClient.invalidateQueries({ queryKey: ['two-factor-status'] });
      toast.success('Two-factor setup started');
    },
    onError: (error: unknown) => {
      const responseMessage = (
        error as { response?: { data?: { message?: string } } }
      )?.response?.data?.message;
      toast.error(responseMessage || 'Failed to start two-factor setup');
    },
  });

  const enableTwoFactor = useMutation({
    mutationFn: (code: string) => api.post('/auth/2fa/enable', { code }),
    onSuccess: () => {
      setTwoFactorSetup(null);
      setTwoFactorCode('');
      queryClient.invalidateQueries({ queryKey: ['two-factor-status'] });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      toast.success('Two-factor authentication enabled');
    },
    onError: (error: unknown) => {
      const responseMessage = (
        error as { response?: { data?: { message?: string } } }
      )?.response?.data?.message;
      toast.error(responseMessage || 'Failed to enable two-factor authentication');
    },
  });

  const disableTwoFactor = useMutation({
    mutationFn: (data: { currentPassword?: string; code: string }) =>
      api.post('/auth/2fa/disable', data),
    onSuccess: () => {
      setDisableTwoFactorCode('');
      setDisableTwoFactorPassword('');
      queryClient.invalidateQueries({ queryKey: ['two-factor-status'] });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      toast.success('Two-factor authentication disabled');
    },
    onError: (error: unknown) => {
      const responseMessage = (
        error as { response?: { data?: { message?: string } } }
      )?.response?.data?.message;
      toast.error(responseMessage || 'Failed to disable two-factor authentication');
    },
  });

  const onSubmit = (data: PasswordFormData) => {
    changePassword.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  const isTwoFactorEnabled = Boolean(twoFactorStatus?.enabled);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Security Settings
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Manage your password and account security
        </p>
      </div>

      {/* Change Password */}
      <div className="card">
        <div className="flex items-start space-x-4 mb-6">
          <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
            <Key className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Change Password
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Update your password to keep your account secure
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                {...register('currentPassword', { required: 'Current password is required' })}
                className="input w-full pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showCurrentPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="text-sm text-red-500 mt-1">{errors.currentPassword.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                {...register('newPassword', {
                  required: 'New password is required',
                  minLength: {
                    value: 12,
                    message: 'Password must be at least 12 characters',
                  },
                  pattern: {
                    value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/, 
                    message: 'Password must contain uppercase, lowercase, number, and special character',
                  },
                })}
                className="input w-full pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showNewPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-sm text-red-500 mt-1">{errors.newPassword.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                {...register('confirmPassword', {
                  required: 'Please confirm your password',
                  validate: (value) =>
                    value === newPassword || 'Passwords do not match',
                })}
                className="input w-full pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-red-500 mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={changePassword.isPending}
            className="btn-primary px-4 py-2"
          >
            {changePassword.isPending ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Two-Factor Authentication */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
              <Smartphone className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Two-Factor Authentication
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Add an extra layer of security to your account
              </p>
            </div>
          </div>
          {isTwoFactorEnabled ? (
            <span className="inline-flex items-center rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700 dark:bg-green-900/20 dark:text-green-300">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Enabled
            </span>
          ) : (
            <button
              type="button"
              onClick={() => startTwoFactorSetup.mutate()}
              disabled={startTwoFactorSetup.isPending || isLoadingTwoFactorStatus}
              className="btn-primary px-4 py-2 text-sm"
            >
              {startTwoFactorSetup.isPending ? 'Starting...' : 'Set up'}
            </button>
          )}
        </div>

        {isLoadingTwoFactorStatus ? (
          <div className="mt-4 h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        ) : isTwoFactorStatusError ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            Two-factor status could not be loaded.
          </div>
        ) : isTwoFactorEnabled ? (
          <div className="mt-4 space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Enabled{twoFactorStatus?.enabledAt ? ` on ${formatDate(twoFactorStatus.enabledAt)}` : ''}.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="password"
                value={disableTwoFactorPassword}
                onChange={(event) => setDisableTwoFactorPassword(event.target.value)}
                className="input"
                placeholder="Current password"
                autoComplete="current-password"
              />
              <input
                type="text"
                value={disableTwoFactorCode}
                onChange={(event) => setDisableTwoFactorCode(event.target.value)}
                className="input"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Authenticator code"
                maxLength={8}
              />
            </div>
            <button
              type="button"
              onClick={() =>
                disableTwoFactor.mutate({
                  ...(disableTwoFactorPassword
                    ? { currentPassword: disableTwoFactorPassword }
                    : {}),
                  code: disableTwoFactorCode,
                })
              }
              disabled={disableTwoFactor.isPending || disableTwoFactorCode.trim().length < 6}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-900/20"
            >
              {disableTwoFactor.isPending ? 'Disabling...' : 'Disable two-factor authentication'}
            </button>
          </div>
        ) : twoFactorSetup ? (
          <div className="mt-4 space-y-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {twoFactorSetup.issuer} / {twoFactorSetup.accountName}
              </p>
              <p className="mt-2 break-all rounded-lg bg-slate-50 p-3 font-mono text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {twoFactorSetup.secret}
              </p>
              <a
                href={twoFactorSetup.otpauthUrl}
                className="mt-2 inline-block text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                Open authenticator app
              </a>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={twoFactorCode}
                onChange={(event) => setTwoFactorCode(event.target.value)}
                className="input flex-1"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Authenticator code"
                maxLength={8}
              />
              <button
                type="button"
                onClick={() => enableTwoFactor.mutate(twoFactorCode)}
                disabled={enableTwoFactor.isPending || twoFactorCode.trim().length < 6}
                className="btn-primary px-4 py-2"
              >
                {enableTwoFactor.isPending ? 'Verifying...' : 'Enable'}
              </button>
            </div>
          </div>
        ) : twoFactorStatus?.setupPending ? (
          <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-300">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">Setup verification pending</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Active Sessions */}
      <div className="card">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start space-x-4">
            <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
              <Monitor className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Active Sessions
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Manage your active sessions across devices
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (confirm('This will log you out of all devices. Continue?')) {
                revokeAllSessions.mutate();
              }
            }}
            disabled={sessions.length === 0 || revokeAllSessions.isPending}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Sign out all devices
          </button>
        </div>

        <div className="space-y-4">
          {isLoadingSessions ? (
            <div className="h-20 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          ) : isSessionsError ? (
            <div className="p-4 border border-red-200 bg-red-50 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300 rounded-lg">
              Active sessions could not be loaded.
            </div>
          ) : sessions.length > 0 ? (
            sessions.map((session: SessionItem) => (
              <div
                key={session.id}
                className="flex items-start justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
              >
                <div className="flex items-start space-x-3">
                  <Monitor className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {session.device || 'Unknown Device'}
                      {session.isCurrent && (
                        <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                          Current
                        </span>
                      )}
                    </p>
                    <div className="flex items-center space-x-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
                      <span className="flex items-center">
                        <MapPin className="w-3 h-3 mr-1" />
                        {session.location || 'Unknown location'}
                      </span>
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatDate(session.lastActive)}
                      </span>
                    </div>
                  </div>
                </div>
                {!session.isCurrent && (
                  <button
                    onClick={() => revokeSession.mutate(session.id)}
                    disabled={revokeSession.isPending}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="p-4 border border-dashed border-slate-200 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400 rounded-lg">
              No active session records were returned.
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card border-red-200 dark:border-red-900/50">
        <div className="flex items-start space-x-4 mb-4">
          <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-red-600">Danger Zone</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Irreversible and destructive actions
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div>
            <p className="font-medium text-slate-900 dark:text-white">
              Delete Account
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Permanently delete your account and all data
            </p>
          </div>
          <button
            className="btn bg-red-600 text-white hover:bg-red-700 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={deleteAccount.isPending}
            onClick={() => {
              if (confirm('This permanently deletes your account and all associated data. Continue?')) {
                deleteAccount.mutate();
              }
            }}
          >
            {deleteAccount.isPending ? 'Deleting...' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
