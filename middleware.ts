import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

// Oturum koruması + "ilk girişte zorunlu şifre değişikliği" zorlaması.
// Token'da mustChangePassword=true ise kullanıcı /change-password dışındaki
// hiçbir korumalı sayfaya giremez; oraya yönlendirilir.
export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const onChangePw = req.nextUrl.pathname.startsWith('/change-password');

    if (token?.mustChangePassword && !onChangePw) {
      return NextResponse.redirect(new URL('/change-password', req.url));
    }
    return NextResponse.next();
  },
  {
    pages: { signIn: '/login' },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/projects/:path*',
    '/modules/:path*',
    '/templates/:path*',
    '/users/:path*',
    '/settings/:path*',
    '/reports/:path*',
    '/change-password/:path*',
    // Üretilen teklif belgeleri ve şablonlar public/ altında dursa da Next.js
    // onları auth'suz statik sunmasın: middleware ile giriş zorunlu kıl.
    '/uploads/generated/:path*',
    '/uploads/templates/:path*',
  ],
};
