import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { NextRequest } from 'next/server';

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: string;
  departmentId: string;
  departmentName: string;
};

export async function getSession(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user as SessionUser;
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) {
    throw new AuthError('Unauthorized', 401);
  }
  return user;
}

export async function requireRole(allowedRoles: string[]): Promise<SessionUser> {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) {
    throw new AuthError('Forbidden', 403);
  }
  return user;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export function apiError(message: string, status = 400, details?: unknown) {
  return Response.json({ success: false, error: message, details }, { status });
}

export function apiSuccess<T>(data: T, message?: string, status = 200) {
  return Response.json({ success: true, data, message }, { status });
}
