#!/usr/bin/env node
/**
 * Stamp the service worker cache name with the current commit SHA.
 *
 * Reads GITHUB_SHA from the environment (set by GitHub Actions); falls back
 * to `git rev-parse --short HEAD` for local runs.
 *
 * Usage:
 *   node scripts/stamp-sw-cache.mjs [.next/standalone/public/sw.js]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const target = process.argv[2] ?? '.next/standalone/public/sw.js';

function resolveSha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'local';
  }
}

const sha = resolveSha();
const src = readFileSync(target, 'utf8');
const stamped = src.replace(
  /const CACHE_NAME = .*;/,
  `const CACHE_NAME = 'kuku-${sha}';`,
);

if (stamped === src) {
  console.error(`No CACHE_NAME declaration found in ${target}`);
  process.exit(1);
}

writeFileSync(target, stamped);
console.log(`Stamped ${target} with CACHE_NAME 'kuku-${sha}'`);