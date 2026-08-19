import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';

const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';

const firebaseConfig = {
  apiKey: useEmulators ? 'demo-key' : (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-key'),
  authDomain: useEmulators ? 'demo.firebaseapp.com' : (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com'),
  projectId: useEmulators ? 'demo-project' : (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project'),
  storageBucket: useEmulators ? '' : (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || ''),
  messagingSenderId: useEmulators ? '' : (process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || ''),
  appId: useEmulators ? '1:000:web:000' : (process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:000:web:000'),
};

let app: FirebaseApp;
try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
} catch (e) {
  console.warn('Firebase init failed:', e);
  app = initializeApp(firebaseConfig, 'fallback');
}

export const db: Firestore = getFirestore(app);
export const auth: Auth = getAuth(app);
export const isFirebaseConfigured = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (useEmulators && typeof window !== 'undefined' && !(globalThis as any).__EMULATORS_CONNECTED__) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__EMULATORS_CONNECTED__ = true;
}
