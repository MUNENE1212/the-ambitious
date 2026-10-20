/**
 * Shared firebase-admin bootstrap for the one-off scripts.
 *
 * Why these scripts use the admin SDK rather than the client SDK the app uses:
 * the `secrets` and `sessions` collections are `allow read, write: if false`
 * in firestore.rules, and the Admin SDK bypasses rules by design. Any script
 * that seeds a PIN hash or performs the secrets migration has to come through
 * here, or it will fail with PERMISSION_DENIED the moment the rules deploy.
 *
 * That bypass is also why the app's own /api routes re-check authorization on
 * every call — see src/lib/server/guard.ts.
 *
 * Credentials: FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY,
 * falling back to Application Default Credentials when the last two are unset.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Minimal .env.local loader. Does not overwrite variables already set. */
export function loadEnv() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = value;
  }
}

/**
 * Point the admin SDK at the local emulator.
 *
 * The admin SDK reads FIRESTORE_EMULATOR_HOST from the environment; unlike
 * connectFirestoreEmulator() there is no function to call, so it has to be
 * set before the first getFirestore().
 *
 * (Named without a `use` prefix on purpose — the react-hooks lint rule treats
 * any `use*` function as a hook, and this is not one.)
 */
export function pointAtEmulator() {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.FIRESTORE_EMULATOR_PROJECT_ID =
    process.env.FIRESTORE_EMULATOR_PROJECT_ID || 'demo-project';
  process.env.GCLOUD_PROJECT = process.env.FIRESTORE_EMULATOR_PROJECT_ID;
}

/**
 * Return a Firestore instance with rules bypassed.
 * @param {{ emulator?: boolean, label?: string }} opts
 */
export function adminFirestore({ emulator = false, label = '' } = {}) {
  if (emulator) pointAtEmulator();

  const projectId =
    process.env.FIRESTORE_EMULATOR_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  const existing = getApps().find((a) => a.name === 'seed-script');
  if (existing) return getFirestore(existing);

  if (emulator) {
    return getFirestore(initializeApp({ projectId: 'demo-project' }, 'seed-script'));
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (clientEmail && privateKey) {
    return getFirestore(
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, 'seed-script')
    );
  }

  // No explicit key: fall back to Application Default Credentials.
  initializeApp({ projectId }, 'seed-script');
  const db = getFirestore('seed-script');
  if (label) {
    console.log(
      `${label}: using Application Default Credentials against project ${projectId}.`
    );
  }
  return db;
}