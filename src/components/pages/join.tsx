'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Seat {
  fullName: string;
  token: string;
}

/**
 * Self-service onboarding.
 *
 * Three beats, in the order a member actually needs them: find me, here's who
 * that is (a confirmation, not a formality — it is the only chance to notice
 * the wrong seat), then set the credentials I will use from now on.
 *
 * The browser never decides anything. It holds an opaque token from /lookup and
 * posts a phone and PIN; the server decides whether that seat can be claimed.
 */

type Step = 'name' | 'confirm' | 'credentials' | 'done';

export function JoinPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const { settings } = useSettings();

  const [step, setStep] = useState<Step>('name');
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selected, setSelected] = useState<Seat | null>(null);

  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);

  async function findSeat(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');

    const name = firstName.trim();
    if (name.length < 2) {
      setError('Enter your first name.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/onboarding/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ firstName: name }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        matches?: Seat[];
        error?: string;
        message?: string;
      };

      if (!res.ok || !data.success) {
        setError(data.error || 'Could not look that up. Please try again.');
        return;
      }

      const matches = data.matches ?? [];
      if (matches.length === 0) {
        setNotice(
          data.message ||
            'We could not find an unclaimed account with that first name. Check the spelling, or ask your admin.'
        );
        return;
      }

      setSeats(matches);
      // One unambiguous match skips the confirmation beat — asking someone to
      // confirm the only possible answer is just a tap they do not understand.
      setStep(matches.length === 1 ? 'credentials' : 'confirm');
      if (matches.length === 1) {
        setSelected(matches[0]!);
      }
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function completeSetup(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!selected) return;

    if (pin !== confirmPin) {
      setError('The two PINs do not match.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ token: selected.token, phone: phone.trim(), pin }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };

      if (!res.ok || !data.success) {
        setError(data.error || 'Could not finish setting up your account.');
        return;
      }

      setStep('done');
      await refresh();
      setTimeout(() => router.replace('/dashboard'), 1200);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const steps: { key: Step; label: string }[] = [
    { key: 'name', label: 'Find you' },
    { key: 'credentials', label: 'Set up' },
  ];
  const activeIndex = step === 'name' || step === 'confirm' ? 0 : 1;

  return (
    <div className="relative min-h-screen bg-brand-gradient flex items-center justify-center p-4 overflow-hidden">
      <div aria-hidden className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-gold-300/10 blur-3xl" />
      <div aria-hidden className="absolute -bottom-32 -right-16 w-80 h-80 rounded-full bg-amber-400/15 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="grid place-items-center w-16 h-16 mx-auto rounded-2xl bg-white/10 ring-1 ring-white/15 text-4xl mb-4">
            🌱
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Set up your account</h1>
          <p className="text-gold-200/70 mt-1.5 text-sm">
            {settings.groupName} · takes about a minute
          </p>
        </div>

        {/* Progress rail — hidden on the confirmation picker, which is a
            decision rather than a step forward. */}
        {step !== 'confirm' && step !== 'done' && (
          <ol className="flex items-center gap-2 mb-4 px-1" aria-label="Progress">
            {steps.map((s, i) => (
              <li key={s.key} className="flex items-center gap-2 flex-1 last:flex-none">
                <span
                  className={`grid place-items-center w-6 h-6 rounded-full text-xs font-bold transition-colors ${
                    i <= activeIndex
                      ? 'bg-gold-300 text-amber-900'
                      : 'bg-white/15 text-gold-200/60'
                  }`}
                >
                  {i < activeIndex ? '✓' : i + 1}
                </span>
                <span
                  className={`text-xs font-semibold ${
                    i <= activeIndex ? 'text-gold-100' : 'text-gold-200/50'
                  }`}
                >
                  {s.label}
                </span>
                {i < steps.length - 1 && (
                  <span
                    aria-hidden
                    className={`h-px flex-1 ${
                      i < activeIndex ? 'bg-gold-300/60' : 'bg-white/15'
                    }`}
                  />
                )}
              </li>
            ))}
          </ol>
        )}

        <div className="bg-white rounded-3xl shadow-lift border border-white/40 p-6">
          {/* ---------- Step 1: find the seat ---------- */}
          {step === 'name' && (
            <form onSubmit={findSeat} className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-stone-800">What is your first name?</h2>
                <p className="text-sm text-stone-500 mt-1">
                  It must match the name on the group register.
                </p>
              </div>

              <Input
                label="First name"
                placeholder="e.g. Faith"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                autoCapitalize="words"
                autoFocus
              />

              {notice && (
                <div className="bg-amber-50 text-amber-900 text-sm rounded-lg px-3 py-2 border border-amber-200">
                  {notice}
                </div>
              )}
              {error && (
                <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 border border-red-200">
                  {error}
                </div>
              )}

              <Button type="submit" loading={busy} className="w-full" size="lg">
                Find my account
              </Button>

              <p className="text-center text-xs text-stone-400 pt-1">
                Already set up?{' '}
                <Link href="/" className="font-semibold text-amber-800 hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          )}

          {/* ---------- Disambiguation ---------- */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-stone-800">Which one are you?</h2>
                <p className="text-sm text-stone-500 mt-1">
                  More than one unclaimed account starts with that name.
                </p>
              </div>

              <ul className="space-y-2">
                {seats.map((seat) => (
                  <li key={seat.token}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(seat);
                        setError('');
                        setStep('credentials');
                      }}
                      className="pressable w-full text-left rounded-xl border border-stone-200 bg-white px-4 py-3 hover:border-amber-500 hover:bg-amber-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
                    >
                      <span className="block font-semibold text-stone-800">{seat.fullName}</span>
                    </button>
                  </li>
                ))}
              </ul>

              {error && (
                <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 border border-red-200">
                  {error}
                </div>
              )}

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setSeats([]);
                  setNotice('');
                  setStep('name');
                }}
              >
                Back
              </Button>
            </div>
          )}

          {/* ---------- Step 2: credentials ---------- */}
          {step === 'credentials' && selected && (
            <form onSubmit={completeSetup} className="space-y-4">
              <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-200 px-4 py-3">
                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                  Setting up
                </p>
                <p className="text-base font-bold text-stone-800 mt-0.5">{selected.fullName}</p>
                <p className="text-xs text-stone-500 mt-1">
                  Not you?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(null);
                      setSeats([]);
                      setPhone('');
                      setPin('');
                      setConfirmPin('');
                      setError('');
                      setStep('name');
                    }}
                    className="font-semibold text-amber-800 hover:underline"
                  >
                    Start over
                  </button>
                </p>
              </div>

              <Input
                label="Your phone number"
                type="tel"
                placeholder="0712345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                inputMode="tel"
                autoFocus
                hint="You will use this to sign in from now on."
              />

              <Input
                label="Choose a 4-digit PIN"
                type="password"
                placeholder="••••"
                maxLength={4}
                inputMode="numeric"
                pattern="[0-9]*"
                value={pin}
                ref={pinRef}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, ''));
                  setError('');
                  if (e.target.value.replace(/\D/g, '').length === 4) pinRef.current?.focus();
                }}
                autoComplete="new-password"
                hint="Not 0000 or 1234 — avoid the obvious ones."
              />

              <Input
                label="Repeat your PIN"
                type="password"
                placeholder="••••"
                maxLength={4}
                inputMode="numeric"
                pattern="[0-9]*"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                autoComplete="new-password"
              />

              {error && (
                <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 border border-red-200">
                  {error}
                </div>
              )}

              <Button type="submit" loading={busy} className="w-full" size="lg">
                Finish setup
              </Button>
            </form>
          )}

          {/* ---------- Done ---------- */}
          {step === 'done' && (
            <div className="text-center py-6 space-y-3">
              <div className="grid place-items-center w-14 h-14 mx-auto rounded-full bg-amber-100 text-3xl">
                ✓
              </div>
              <h2 className="text-lg font-bold text-stone-800">You&apos;re all set</h2>
              <p className="text-sm text-stone-500">
                Taking you to your dashboard…
              </p>
            </div>
          )}
        </div>

        {step !== 'done' && (
          <p className="text-center text-xs text-gold-200/50 mt-6">
            Your details go straight to the group&apos;s own records — nothing is shared anywhere.
          </p>
        )}
      </div>
    </div>
  );
}
