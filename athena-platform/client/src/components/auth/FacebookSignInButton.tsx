'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

type FacebookAuthResponse = {
  accessToken?: string;
  userID?: string;
  expiresIn?: number;
};

type FacebookLoginResponse = {
  status: 'connected' | 'not_authorized' | 'unknown';
  authResponse?: FacebookAuthResponse;
};

type FacebookSDK = {
  init: (params: {
    appId: string;
    cookie?: boolean;
    xfbml?: boolean;
    version: string;
  }) => void;
  login: (
    callback: (response: FacebookLoginResponse) => void,
    options?: { scope?: string; return_scopes?: boolean; auth_type?: 'rerequest' }
  ) => void;
  getLoginStatus: (callback: (response: FacebookLoginResponse) => void) => void;
  logout: (callback?: () => void) => void;
};

declare global {
  interface Window {
    FB?: FacebookSDK;
    fbAsyncInit?: () => void;
  }
}

let fbScriptPromise: Promise<void> | null = null;

function loadFacebookScript(appId: string): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (window.FB) {
    return Promise.resolve();
  }

  if (fbScriptPromise) {
    return fbScriptPromise;
  }

  fbScriptPromise = new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      try {
        window.FB?.init({ appId, cookie: true, xfbml: false, version: 'v19.0' });
        resolve();
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to initialise Facebook SDK'));
      }
    };

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-facebook-sdk="true"]');
    if (existingScript) {
      if (window.FB) resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.dataset.facebookSdk = 'true';
    script.onerror = () => reject(new Error('Failed to load Facebook SDK'));
    document.head.appendChild(script);
  });

  return fbScriptPromise;
}

function FacebookIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.675 0h-21.35C.593 0 0 .593 0 1.326v21.348C0 23.407.593 24 1.326 24h11.495v-9.294H9.692v-3.622h3.129V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.794.715-1.794 1.763v2.312h3.587l-.467 3.622h-3.12V24h6.116C23.407 24 24 23.407 24 22.674V1.326C24 .593 23.407 0 22.675 0z" />
    </svg>
  );
}

type FacebookSignInButtonProps = {
  mode: 'login' | 'register';
  disabled?: boolean;
  persona?: string;
  womanSelfAttested?: boolean;
  inviteCode?: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

export function FacebookSignInButton({
  mode,
  disabled = false,
  persona,
  womanSelfAttested,
  inviteCode,
  onSuccess,
  onError,
}: FacebookSignInButtonProps) {
  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const queryClient = useQueryClient();
  const login = useAuthStore((state) => state.login);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const facebookMutation = useMutation({
    mutationFn: authApi.facebook,
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!appId || disabled) return;

    let cancelled = false;
    void loadFacebookScript(appId)
      .then(() => {
        if (cancelled || !mountedRef.current) return;
        setScriptError(null);
        setIsReady(true);
      })
      .catch(() => {
        if (cancelled || !mountedRef.current) return;
        setScriptError('Facebook sign-in is temporarily unavailable.');
        setIsReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appId, disabled]);

  const handleError = useCallback(
    (message: string) => {
      toast.error(message);
      onError?.(message);
    },
    [onError]
  );

  const exchangeToken = useCallback(
    async (accessToken: string) => {
      try {
        const response = await facebookMutation.mutateAsync({
          accessToken,
          mode,
          ...(persona ? { persona } : {}),
          ...(typeof womanSelfAttested === 'boolean' ? { womanSelfAttested } : {}),
          ...(inviteCode ? { inviteCode } : {}),
        });
        const { user, accessToken: jwt } = response.data.data;
        login(user, jwt, '');
        queryClient.invalidateQueries();
        toast.success(mode === 'register' ? 'Welcome to ATHENA!' : 'Welcome back!');
        onSuccess?.();
      } catch (error) {
        const message =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          (mode === 'register'
            ? 'Facebook sign-up failed. Please try again.'
            : 'Facebook sign-in failed. Please try again.');
        handleError(message);
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    },
    [facebookMutation, mode, persona, womanSelfAttested, inviteCode, login, queryClient, onSuccess, handleError]
  );

  const handleClick = useCallback(() => {
    if (!appId) {
      const msg = 'Facebook sign-in is not configured yet. Please use your email and password, or try again soon.';
      toast(msg, { icon: 'ℹ️' });
      onError?.(msg);
      return;
    }

    if (!isReady || !window.FB) {
      const msg = scriptError || 'Facebook sign-in is still loading. Please try again in a moment.';
      toast(msg, { icon: 'ℹ️' });
      return;
    }

    setIsLoading(true);
    window.FB.login(
      (response) => {
        if (response.status !== 'connected' || !response.authResponse?.accessToken) {
          setIsLoading(false);
          if (response.status === 'not_authorized') {
            handleError('You need to authorize ATHENA to continue with Facebook.');
          }
          // status 'unknown' usually means the user closed the popup — stay silent.
          return;
        }
        void exchangeToken(response.authResponse.accessToken);
      },
      { scope: 'public_profile,email' }
    );
  }, [appId, isReady, scriptError, exchangeToken, handleError, onError]);

  if (facebookMutation.isPending || isLoading) {
    return (
      <button
        type="button"
        disabled
        className="btn-outline flex w-full items-center justify-center py-2.5 opacity-70 cursor-not-allowed"
      >
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {mode === 'register' ? 'Creating account...' : 'Signing in...'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className="btn-outline flex w-full items-center justify-center py-2.5 text-[#1877F2] hover:bg-[#1877F2]/5 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-[#1877F2]/10"
    >
      <FacebookIcon />
      <span className="ml-2 text-gray-700 dark:text-gray-200">Continue with Facebook</span>
    </button>
  );
}
