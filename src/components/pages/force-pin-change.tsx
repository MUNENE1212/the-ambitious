'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ForcePinChange() {
  const { user, changePin, logout } = useAuth();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (currentPin.length !== 4) { setError('Current PIN must be 4 digits'); return; }
    if (newPin.length !== 4) { setError('New PIN must be 4 digits'); return; }
    if (newPin !== confirmPin) { setError('PINs do not match'); return; }
    if (newPin === currentPin) { setError('New PIN must be different from current PIN'); return; }

    setLoading(true);
    const result = await changePin(currentPin, newPin);
    if (!result.success) {
      setError(result.error || 'Failed to change PIN');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔐</div>
          <h1 className="text-2xl font-bold text-amber-800">Change Your PIN</h1>
          <p className="text-stone-500 mt-1">
            Welcome, {user?.name}! Please set a new PIN before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 space-y-4">
          <Input
            label="Current PIN"
            type="password"
            placeholder="••••"
            maxLength={4}
            inputMode="numeric"
            pattern="[0-9]*"
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
          />
          <Input
            label="New PIN"
            type="password"
            placeholder="••••"
            maxLength={4}
            inputMode="numeric"
            pattern="[0-9]*"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
          />
          <Input
            label="Confirm New PIN"
            type="password"
            placeholder="••••"
            maxLength={4}
            inputMode="numeric"
            pattern="[0-9]*"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
          />

          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 border border-red-200">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full" size="lg">
            Set New PIN
          </Button>
        </form>

        <button
          onClick={logout}
          className="block mx-auto mt-4 text-sm text-stone-400 hover:text-stone-600"
        >
          Sign out instead
        </button>
      </div>
    </div>
  );
}
