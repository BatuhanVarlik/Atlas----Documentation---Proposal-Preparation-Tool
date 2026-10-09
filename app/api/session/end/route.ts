import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// GET /api/session/end — oturum çerezlerini temizleyip girişe yönlendirir.
//
// Kullanım: sayfalar oturumu okuyamadığında (ör. kullanıcı Portal'dan PASİFE alındığında —
// lib/auth.ts session callback'i boş döner) buraya yönlendirir. Doğrudan /login'e gitmek
// döngü yapar: çerez imza olarak hâlâ geçerli olduğundan middleware /login'den /dashboard'a geri atar.
// GET kabul edilir (signOut'un CSRF'li POST'u yerine) — yalnızca kendi çerezini siler, zararsızdır.
//
// GÖRELİ yönlendirme — reverse-proxy arkasında da gerçek host'a göre çözülsün (bkz. sso/consume).
const SESSION_COOKIES = ['next-auth.session-token', '__Secure-next-auth.session-token'];

export async function GET(req: Request) {
  const res = new NextResponse(null, { status: 302, headers: { Location: '/login?oturum=sonlandi' } });
  const present = (req.headers.get('cookie') ?? '')
    .split(';')
    .map((c) => c.trim().split('=')[0]);
  // Büyük JWT'ler NextAuth tarafından .0, .1 … parçalarına bölünür → hepsi silinir
  for (const name of present) {
    if (SESSION_COOKIES.some((base) => name === base || name.startsWith(base + '.'))) {
      res.cookies.set(name, '', {
        path: '/',
        maxAge: 0,
        httpOnly: true,
        sameSite: 'lax',
        secure: name.startsWith('__Secure-'),
      });
    }
  }
  return res;
}
