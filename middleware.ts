import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

// Oturum koruması + "ilk girişte zorunlu şifre değişikliği" zorlaması.
// Token'da mustChangePassword=true ise kullanıcı /change-password dışındaki
// hiçbir korumalı sayfaya giremez; oraya yönlendirilir.
export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Zaten oturumu olan kullanıcı /login'e gelirse tekrar giriş isteme; yönlendir.
    if (path.startsWith('/login')) {
      if (token) {
        const dest = token.mustChangePassword ? '/change-password' : '/dashboard';
        // GÖRELİ yönlendirme — reverse-proxy arkasında req.url=localhost olsa bile
        // tarayıcı gerçek host'a göre çözer.
        return new NextResponse(null, { status: 302, headers: { Location: dest } });
      }
      return NextResponse.next(); // anonim → login sayfasını göster
    }

    if (token?.mustChangePassword && !path.startsWith('/change-password')) {
      return NextResponse.redirect(new URL('/change-password', req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      // /login herkese açık (anonim erişebilsin); diğer eşleşen yollar oturum ister.
      authorized: ({ token, req }) => req.nextUrl.pathname.startsWith('/login') || !!token,
    },
    pages: { signIn: '/login' },
  }
);

export const config = {
  matcher: [
    '/login',
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
