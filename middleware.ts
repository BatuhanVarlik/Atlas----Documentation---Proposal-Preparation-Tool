export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/projects/:path*',
    '/modules/:path*',
    '/templates/:path*',
    '/users/:path*',
    '/settings/:path*',
    '/reports/:path*',
  ],
};
