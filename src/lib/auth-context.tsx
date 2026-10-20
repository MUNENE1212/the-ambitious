'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Member } from './types';

/**
 * The client never sees a PIN hash, never runs bcrypt, and never decides who is
 * logged in.
 *
 * The public interface is deliberately unchanged from the version that shipped
 * with client-side PIN verification — `user`, `loading`, `login`, `logout`,
 * `changePin`, `updateProfile` — so none of the pages that consume it needed to
 * change. What changed is entirely behind this boundary.
 *
 * Two things the old version got wrong and this one cannot:
 *   1. The session was `{memberId, expiresAt}` in localStorage, with no
 *      signature. Editing it in devtools impersonated any member, including the
 *      treasurer. Sessions are now opaque tokens in an httpOnly cookie, and the
 *      only token the server accepts is one it issued.
 *   2. The PIN hash was fetched to the browser on every page load, so anyone
 *      could dump all 13 and crack a 4-digit PIN offline. Verification is now
 *      server-side and no hash crosses the wire.
 */

interface AuthContextType {
  user: Member | null;
  loading: boolean;
  login: (phone: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  changePin: (oldPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (data: { name: string }) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Required: the session cookie is SameSite=Strict and would otherwise be
    // dropped on cross-site navigations in some browsers.
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`session check failed: ${res.status}`);
      const data = (await res.json()) as { user: Member | null };
      setUser(data.user);
    } catch {
      setUser(null);
    }
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadSession(); }, [loadSession]);

  const login = async (phone: string, pin: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const data = await postJson<{ success: boolean; user?: Member; error?: string }>(
        '/api/auth/login',
        { phone, pin }
      );
      if (data.success && data.user) {
        setUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.error ?? 'Login failed. Please try again.' };
    } catch {
      return { success: false, error: 'Login failed. Please try again.' };
    }
  };

  const logout = () => {
    // Clear locally first: the user asked to log out, so the UI must not wait
    // on a network round-trip to reflect it.
    setUser(null);
    void postJson('/api/auth/logout', {}).catch(() => {});
  };

  const changePin = async (oldPin: string, newPin: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const data = await postJson<{ success: boolean; user?: Member; error?: string }>(
        '/api/auth/change-pin',
        { oldPin, newPin }
      );
      if (data.success && data.user) {
        setUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.error ?? 'Failed to change PIN. Please try again.' };
    } catch {
      return { success: false, error: 'Failed to change PIN. Please try again.' };
    }
  };

  const updateProfile = async (data: { name: string }): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not logged in' };
    try {
      await updateDoc(doc(db, 'members', user.id), { name: data.name, updatedAt: Date.now() });
      setUser({ ...user, name: data.name });
      return { success: true };
    } catch {
      return { success: false, error: 'Failed to update profile. Please try again.' };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, changePin, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}