import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clearSessionCookie, destroySession } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  await destroySession();
  const jar = await cookies();
  jar.set(clearSessionCookie());
  return NextResponse.json({ success: true });
}