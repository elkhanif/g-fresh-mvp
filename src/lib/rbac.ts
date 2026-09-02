import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import type { Role } from '@prisma/client';
import { authOptions } from './auth';

// Peta peran → landing path setelah login.
export const HOME_BY_ROLE: Record<Role, string> = {
  PRODUSEN: '/app/produsen',
  KONSUMEN: '/app/konsumen',
  KURIR: '/app/kurir',
  ADMIN: '/app/admin',
  PEMKAB: '/app/pemkab',
};

export async function getSessionUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

/** Untuk server component: wajib login, kalau tidak → /login. */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}

/** Untuk server component: wajib login + peran tertentu. */
export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    // Bukan peran yang tepat → lempar ke beranda perannya sendiri.
    redirect(HOME_BY_ROLE[user.role]);
  }
  return user;
}

/** Untuk route handler (API): kembalikan user atau null (tanpa redirect). */
export async function apiUser() {
  return getSessionUser();
}
