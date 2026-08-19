'use client';

import { usePWAInstall } from '@/lib/use-pwa-install';
import { Button } from './button';

export function PWAInstallBanner() {
  const { showBanner, install, dismiss } = usePWAInstall();

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-40 px-4 animate-slide-up">
      <div className="max-w-lg mx-auto bg-white rounded-xl border border-stone-200 shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">🌱</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-stone-800 text-sm">Install Y&amp;A</p>
            <p className="text-xs text-stone-500 mt-0.5">
              Add to your home screen for quick access and offline use
            </p>
          </div>
          <button
            onClick={dismiss}
            className="p-1 text-stone-400 hover:text-stone-600 flex-shrink-0"
            aria-label="Dismiss"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" size="sm" onClick={dismiss} className="flex-1">
            Not now
          </Button>
          <Button size="sm" onClick={install} className="flex-1">
            Install App
          </Button>
        </div>
      </div>
    </div>
  );
}
