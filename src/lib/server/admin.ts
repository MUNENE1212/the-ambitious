import 'server-only';
import { cert, getApps, initializeApp, applicationDefault, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Server-only Firebase Admin client.
 *
 * The Admin SDK bypasses Firestore rules entirely — that is the point. Every
 * place that imports this must re-implement its own authorization; nothing here
 * is implicitly safe because "it's the server".
 */

function initAdminApp(): App {
  if (getApps().length > 0) return getApps()[0]!;

  // Against the emulator there are no credentials — FIRESTORE_EMULATOR_HOST
  // short-circuits the Admin SDK before it ever looks for a key.
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ projectId: 'demo-project' });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // Prefer a service account. Falls back to Application Default Credentials so
  // the same code runs on GCP without a second code path.
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (clientEmail && privateKey) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  }

  return initializeApp({ credential: applicationDefault(), projectId });
}

export const adminApp = initAdminApp();
export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);

/**
 * True when the server can actually reach Firestore. Login must fail closed
 * rather than half-working, so this is checked explicitly at the call site.
 */
export function isAdminConfigured(): boolean {
  if (process.env.FIRESTORE_EMULATOR_HOST) return true;
  return !!(
    (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.K_SERVICE
  );
}