import { NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';
import { getSharedUserByEmail } from '@/lib/shared-users';
import { syncLocalUser } from '@/lib/user-sync';
import { verifySsoTicket } from '@/lib/sso-ticket';

export const runtime = 'nodejs';

const MAX_AGE = 30 * 24 * 60 * 60; // 30 gün (session ile aynı)

// GÖRELİ yönlendirme: Location'ı req.url'den değil, göreli path olarak veririz.
// Böylece reverse-proxy arkasında (req.url = localhost:3000 görünse bile) tarayıcı
// adres çubuğundaki gerçek host'a (ör. chronos.apvhemisan.com) göre çözer.
function redirect(path: string): NextResponse {
  return new NextResponse(null, { status: 302, headers: { Location: path } });
}

// GET /api/sso/consume?ticket=... — Portal'dan gelen SSO biletini doğrular,
// Ortak DB'den kullanıcıyı çekip yerel oturumu (NextAuth JWT çerezi) açar.
export async function GET(req: Request) {
  const ticket = new URL(req.url).searchParams.get('ticket');

  const verified = verifySsoTicket(ticket);
  if (!verified) return redirect('/login');

  const shared = await getSharedUserByEmail(verified.email);
  if (!shared || !shared.isActive) return redirect('/login');

  const user = await syncLocalUser(shared);

  const token = {
    sub: user.id,
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    departmentId: user.departmentId,
    departmentName: user.department.name,
    mustChangePassword: shared.mustChangePassword,
  };

  const encoded = await encode({ token, secret: process.env.NEXTAUTH_SECRET!, maxAge: MAX_AGE });

  // Çerez adı NEXTAUTH_URL şemasına göre (https → __Secure- öneki) — NextAuth ile aynı mantık.
  const secure = (process.env.NEXTAUTH_URL ?? '').startsWith('https://');
  const cookieName = secure ? '__Secure-next-auth.session-token' : 'next-auth.session-token';

  const res = redirect('/dashboard');
  res.cookies.set(cookieName, encoded, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    maxAge: MAX_AGE,
  });
  return res;
}
