'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Shield,
  Key,
  Smartphone,
  Monitor,
  MapPin,
  Clock,
  AlertTriangle,
  Eye,
  EyeOff,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/lib/hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

type PasswordFormData = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export default function SecuritySettingsPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<PasswordFormData>();

  const newPassword = watch('newPassword');

  // Get active sessions
  const { data: sessions } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get('/auth/sessions'),
    select: (response) => response.data.data,
  });

  // Change password mutation
  const changePassword = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.post('/auth/change-password', data),
    onSuccess: () => {
      toast.success('Password changed successfully');
      reset();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to change password');
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
    mutationFn: () => api.delete('/auth/sessions'),
    onSuccess: () => {
      toast.success('All sessions revoked. Please log in again.');
      logout();
    },
    onError: () => {
      toast.error('Failed to revoke sessions');
    },
  });

  const onSubmit = (data: PasswordFormData) => {
    changePassword.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Security Settings
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Change Password
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Update your password to keep your account secure
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                {...register('newPassword', {
                  required: 'New password is required',
                  minLength: {
                    value: 8,
                    message: 'Password must be at least 8 characters',
                  },
                  pattern: {
                    value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                    message: 'Password must contain uppercase, lowercase, and number',
                  },
                })}
                className="input w-full pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Two-Factor Authentication
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Add an extra layer of security to your account
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={twoFactorEnabled}
              onChange={() => setTwoFactorEnabled(!twoFactorEnabled)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
          </label>
        </div>
        {twoFactorEnabled && (
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div className="flex items-center space-x-2 text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Setup required</span>
            </div>
            <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-1">
              Two-factor authentication setup will be available soon.
            </p>
          </div>
        )}
      </div>

      {/* Active Sessions */}
      <div className="card">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start space-x-4">
            <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
              <Monitor className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Active Sessions
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
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
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Sign out all devices
          </button>
        </div>

        <div className="space-y-4">
          {sessions?.length > 0 ? (
            sessions.map((session: any) => (
              <div
                key={session.id}
                className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
              >
                <div className="flex items-start space-x-3">
                  <Monitor className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {session.device || 'Unknown Device'}
                      {session.isCurrent && (
                        <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                          Current
                        </span>
                      )}
                    </p>
                    <div className="flex items-center space-x-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
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
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="flex items-start space-x-3">
                <Monitor className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    This Device
                    <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                      Current
                    </span>
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Active now
                  </p>
                </div>
              </div>
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
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Irreversible and destructive actions
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              Delete Account
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Permanently delete your account and all data
            </p>
          </div>
          <button className="btn bg-red-600 text-white hover:bg-red-700 px-4 py-2">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
