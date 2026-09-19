'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function LoginPage() {
  const { login } = useAuth();
  const { settings } = useSettings();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!phone.trim()) { setError('Phone number is required'); return; }
    if (pin.length !== 4) { setError('PIN must be 4 digits'); return; }

    setLoading(true);
    const result = await login(phone.trim(), pin);
    if (!result.success) {
      setError(result.error || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen bg-brand-gradient flex items-center justify-center p-4 overflow-hidden">
      {/* Decorative blooms */}
      <div aria-hidden className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-gold-300/10 blur-3xl" />
      <div aria-hidden className="absolute -bottom-32 -right-16 w-80 h-80 rounded-full bg-amber-400/15 blur-3xl" />
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="grid place-items-center w-16 h-16 mx-auto rounded-2xl bg-white/10 ring-1 ring-white/15 text-4xl mb-4">
            🌱
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{settings.groupName}</h1>
          <p className="text-gold-200/70 mt-1.5 text-sm">Contributions, funds &amp; forum — in one place</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-lift border border-white/40 p-6 space-y-4">
          <Input
            label="Phone Number"
            type="tel"
            placeholder="0712345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />

          <Input
            label="PIN"
            type="password"
            placeholder="••••"
            maxLength={4}
            inputMode="numeric"
            pattern="[0-9]*"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            autoComplete="current-password"
          />

          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 border border-red-200">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full" size="lg">
            Sign In
          </Button>
        </form>

        <p className="text-center text-xs text-gold-200/50 mt-6">
          Contact your admin to get registered
        </p>
      </div>
    </div>
  );
}
