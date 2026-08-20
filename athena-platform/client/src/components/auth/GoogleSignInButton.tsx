'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

let googleScriptPromise: Promise<void> | null = null;

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode?: 'popup' | 'redirect';
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      shape?: 'rectangular' | 'pill' | 'circle' | 'square';
      width?: number;
      logo_alignment?: 'left' | 'center';
      type?: 'standard' | 'icon';
    }
  ) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
      };
    };
  }
}

function loadGoogleScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-google-identity="true"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

type GoogleSignInButtonProps = {
  mode: 'login' | 'register';
  disabled?: boolean;
  persona?: string;
  womanSelfAttested?: boolean;
  inviteCode?: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

export function GoogleSignInButton({
  mode,
  disabled = false,
  persona,
  womanSelfAttested,
  inviteCode,
  onSuccess,
  onError,
}: GoogleSignInButtonProps) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const login = useAuthStore((state) => state.login);
  const [isReady, setIsReady] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);

  const googleMutation = useMutation({
    mutationFn: authApi.google,
  });

  const handleError = useCallback(
    (message: string) => {
      setScriptError(message);
      toast.error(message);
      onError?.(message);
    },
    [onError]
  );

  const handleCredential = useCallback(
    async (credential: string) => {
      try {
        const response = await googleMutation.mutateAsync({
          credential,
          mode,
          ...(persona ? { persona } : {}),
          ...(typeof womanSelfAttested === 'boolean' ? { womanSelfAttested } : {}),
          ...(inviteCode ? { inviteCode } : {}),
        });

        const { user, accessToken } = response.data.data;
        login(user, accessToken, '');
        queryClient.invalidateQueries();
        toast.success(mode === 'register' ? 'Welcome to ATHENA!' : 'Welcome back!');
        onSuccess?.();
      } catch (error) {
        const message =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          (mode === 'register'
            ? 'Google sign-up failed. Please try again.'
            : 'Google sign-in failed. Please try again.');
        handleError(message);
      }
    },
    [googleMutation, mode, persona, womanSelfAttested, inviteCode, login, queryClient, onSuccess, handleError]
  );

  useEffect(() => {
    if (!clientId) {
      setScriptError('Google sign-in is not configured yet.');
      return;
    }

    if (disabled || !containerRef.current) {
      setIsReady(false);
      return;
    }

    let active = true;

    void loadGoogleScript()
      .then(() => {
        if (!active || !containerRef.current || !window.google?.accounts?.id) {
          return;
        }

        setScriptError(null);
        setIsReady(true);
        containerRef.current.innerHTML = '';
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (!response.credential) {
              handleError('Google did not return a valid credential. Please try again.');
              return;
            }
            void handleCredential(response.credential);
          },
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          text: mode === 'register' ? 'signup_with' : 'signin_with',
          shape: 'pill',
          width: Math.max(containerRef.current.offsetWidth, 280),
          logo_alignment: 'left',
          type: 'standard',
        });
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setIsReady(false);
        setScriptError('Google sign-in is unavailable right now.');
      });

    return () => {
      active = false;
    };
  }, [clientId, disabled, handleCredential, handleError, mode]);

  if (googleMutation.isPending) {
    return (
      <button type="button" disabled className="btn-outline flex w-full items-center justify-center py-2.5 opacity-70 cursor-not-allowed">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {mode === 'register' ? 'Creating account...' : 'Signing in...'}
      </button>
    );
  }

  if (disabled) {
    return (
      <button type="button" disabled className="btn-outline flex w-full items-center justify-center py-2.5 opacity-60 cursor-not-allowed">
        <GoogleIcon />
        <span className="ml-2">Google</span>
      </button>
    );
  }

  if (!clientId || scriptError) {
    return (
      <button type="button" disabled className="btn-outline flex w-full items-center justify-center py-2.5 opacity-60 cursor-not-allowed">
        <GoogleIcon />
        <span className="ml-2">Google Unavailable</span>
      </button>
    );
  }

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        className="flex min-h-[42px] w-full items-center justify-center overflow-hidden rounded-full"
        aria-busy={!isReady}
      />
    </div>
  );
}
