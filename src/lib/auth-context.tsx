'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Member, hydrateMember } from './types';
import bcrypt from 'bcryptjs';

interface AuthContextType {
  user: Member | null;
  loading: boolean;
  login: (phone: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  changePin: (oldPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (data: { name: string }) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_KEY = 'ambitious_session';
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_ATTEMPTS = 5;
const LOCK_DURATION = 30 * 60 * 1000; // 30 minutes

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      const session = localStorage.getItem(SESSION_KEY);
      if (!session) { setLoading(false); return; }
      const { memberId, expiresAt } = JSON.parse(session);
      if (Date.now() > expiresAt) {
        localStorage.removeItem(SESSION_KEY);
        setLoading(false);
        return;
      }
      const memberDoc = await getDoc(doc(db, 'members', memberId));
      if (memberDoc.exists()) {
        setUser(hydrateMember(memberDoc.id, memberDoc.data()));
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
    setLoading(false);
  }, []);

  // Restoring a saved session on mount is legitimate async-effect-then-setState;
  // the new react-hooks/set-state-in-effect rule flags it regardless of the
  // async boundary inside loadSession, so it's disabled for this one line.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadSession(); }, [loadSession]);

  const login = async (phone: string, pin: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Normalize phone
      const normalized = phone.startsWith('0') ? '+254' + phone.slice(1) : phone.startsWith('254') ? '+' + phone : phone;

      // Find member by phone
      const { query, collection, where, getDocs } = await import('firebase/firestore');
      const q = query(collection(db, 'members'), where('phone', '==', normalized));
      const snapshot = await getDocs(q);

      if (snapshot.empty) return { success: false, error: 'Invalid phone number or PIN' };

      const memberDoc = snapshot.docs[0];
      const member = hydrateMember(memberDoc.id, memberDoc.data());

      // Check lock
      if (member.isLocked) {
        const mins = Math.ceil(((member.lockedUntil ?? 0) - Date.now()) / 60000);
        return { success: false, error: `Account locked. Try again in ${mins} minutes.` };
      }

      // Verify PIN
      const valid = await bcrypt.compare(pin, member.pinHash);

      if (!valid) {
        const newAttempts = (member.failedAttempts || 0) + 1;
        const updates: Record<string, unknown> = { failedAttempts: newAttempts };
        if (newAttempts >= MAX_ATTEMPTS) {
          updates.lockedUntil = Date.now() + LOCK_DURATION;
        }
        await updateDoc(doc(db, 'members', member.id), updates);
        const remaining = MAX_ATTEMPTS - newAttempts;
        if (remaining <= 0) return { success: false, error: 'Account locked due to too many failed attempts.' };
        return { success: false, error: `Invalid PIN. ${remaining} attempts remaining.` };
      }

      // Success - reset attempts
      await updateDoc(doc(db, 'members', member.id), {
        failedAttempts: 0,
        lockedUntil: null,
      });

      // Save session
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        memberId: member.id,
        expiresAt: Date.now() + SESSION_DURATION,
      }));

      setUser(member);
      return { success: true };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'Login failed. Please try again.' };
    }
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  const changePin = async (oldPin: string, newPin: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not logged in' };
    try {
      const valid = await bcrypt.compare(oldPin, user.pinHash);
      if (!valid) return { success: false, error: 'Current PIN is incorrect' };

      const pinHash = await bcrypt.hash(newPin, 10);
      await updateDoc(doc(db, 'members', user.id), {
        pinHash,
        mustChangePin: false,
        updatedAt: Date.now(),
      });
      setUser({ ...user, pinHash, mustChangePin: false });
      return { success: true };
    } catch {
      return { success: false, error: 'Failed to change PIN. Please try again.' };
    }
  };

  const updateProfile = async (data: { name: string }): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not logged in' };
    try {
      await updateDoc(doc(db, 'members', user.id), {
        name: data.name,
        updatedAt: Date.now(),
      });
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
