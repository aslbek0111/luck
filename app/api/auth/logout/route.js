import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/session';
import { mockStore } from '@/lib/mock-store';
import { isServerSupabaseConfigured } from '@/lib/supabaseServer';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Вы успешно вышли из аккаунта',
  });
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  await clearSessionCookie(response);

  if (!isServerSupabaseConfigured) {
    mockStore.setCurrentUserId(null);
  }

  return response;
}

export async function GET() {
  const response = NextResponse.json({
    success: true,
    message: 'Вы успешно вышли из аккаунта',
  });
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  await clearSessionCookie(response);

  if (!isServerSupabaseConfigured) {
    mockStore.setCurrentUserId(null);
  }

  return response;
}

