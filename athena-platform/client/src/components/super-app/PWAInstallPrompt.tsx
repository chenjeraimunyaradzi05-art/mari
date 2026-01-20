'use client';

/**
 * PWA Install Prompt Component
 * Phase 3: Web Client - Super App Core
 */

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { X, Download, Share, Smartphone, Monitor, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show banner after delay if user hasn't dismissed before
      const dismissed = localStorage.getItem('pwa-banner-dismissed');
      if (!dismissed) {
        setTimeout(() => setShowBanner(true), 3000);
      }
    };

    // Listen for successful install
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowBanner(false);
      setShowDialog(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Show iOS prompt after delay
    if (isIOSDevice) {
      const dismissed = localStorage.getItem('pwa-ios-dismissed');
      if (!dismissed) {
        setTimeout(() => setShowBanner(true), 5000);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) {
      // For iOS, show instructions dialog
      if (isIOS) {
        setShowDialog(true);
        setShowBanner(false);
      }
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      
      setDeferredPrompt(null);
      setShowBanner(false);
    } catch (error) {
      console.error('Error during install:', error);
    }
  }, [deferredPrompt, isIOS]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    localStorage.setItem(isIOS ? 'pwa-ios-dismissed' : 'pwa-banner-dismissed', 'true');
  }, [isIOS]);

  // Don't render if already installed
  if (isInstalled) return null;

  return (
    <>
      {/* Bottom Banner */}
      {showBanner && (
        <div
          className={cn(
            'fixed bottom-0 inset-x-0 z-50 p-4 bg-white dark:bg-zinc-900',
            'border-t border-zinc-200 dark:border-zinc-800 shadow-lg',
            'animate-in slide-in-from-bottom duration-300'
          )}
        >
          <div className="max-w-2xl mx-auto flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
              <Download className="h-6 w-6 text-white" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm">Install ATHENA App</h3>
              <p className="text-xs text-zinc-500 truncate">
                {isIOS
                  ? 'Add to Home Screen for the best experience'
                  : 'Install for offline access & push notifications'}
              </p>
            </div>

            <Button size="sm" onClick={handleInstall}>
              {isIOS ? 'How to Install' : 'Install'}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* iOS Instructions Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Install ATHENA
            </DialogTitle>
            <DialogDescription>
              Add ATHENA to your home screen for quick access
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <span className="text-blue-600 dark:text-blue-400 font-semibold">1</span>
              </div>
              <div>
                <p className="font-medium">Tap the Share button</p>
                <p className="text-sm text-zinc-500 flex items-center gap-1">
                  Look for the <Share className="h-4 w-4" /> icon at the bottom of Safari
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <span className="text-blue-600 dark:text-blue-400 font-semibold">2</span>
              </div>
              <div>
                <p className="font-medium">Scroll and tap "Add to Home Screen"</p>
                <p className="text-sm text-zinc-500">
                  You may need to scroll down in the share menu
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <span className="text-blue-600 dark:text-blue-400 font-semibold">3</span>
              </div>
              <div>
                <p className="font-medium">Tap "Add" to confirm</p>
                <p className="text-sm text-zinc-500">
                  ATHENA will appear on your home screen
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setShowDialog(false)}>Got it</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Hook for programmatic install
export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setIsInstalled(window.matchMedia('(display-mode: standalone)').matches);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return result.outcome === 'accepted';
    } catch (error) {
      return false;
    }
  }, [deferredPrompt]);

  return { canInstall, isInstalled, install };
}

export default PWAInstallPrompt;
