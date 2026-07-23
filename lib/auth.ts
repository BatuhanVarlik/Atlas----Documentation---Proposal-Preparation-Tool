import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { verifySharedCredentials } from '@/lib/shared-users';
import { syncLocalUser } from '@/lib/user-sync';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    // LAN içi kullanım — oturum uzun ömürlü ve "rolling": aktif kullanıcı fiilen
    // hiç düşmez, yalnızca 30 gün hiç kullanılmayan oturum sona erer.
    maxAge: 30 * 24 * 60 * 60, // 30 gün
    updateAge: 24 * 60 * 60, // her gün token tazelenir (kullandıkça uzar)
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'E-posta', type: 'email' },
        password: { label: 'Şifre', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // 1) Kimlik doğrulama ORTAK DB'de (tek doğruluk kaynağı).
        const shared = await verifySharedCredentials(credentials.email, credentials.password);
        if (!shared) {
          return null;
        }

        // 2) Yerel User aynasını güncelle/oluştur (domain FK'leri için). Yetki yerelde.
        const user = await syncLocalUser(shared);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          departmentId: user.departmentId,
          departmentName: user.department.name,
          mustChangePassword: shared.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as unknown as {
          id: string;
          role: string;
          departmentId: string;
          departmentName: string;
          mustChangePassword: boolean;
        };
        token.id = u.id;
        token.role = u.role;
        token.departmentId = u.departmentId;
        token.departmentName = u.departmentName;
        token.mustChangePassword = u.mustChangePassword;
      }
      // Şifre değiştikten sonra client update({ mustChangePassword: false }) çağırır.
      if (trigger === 'update' && session?.mustChangePassword === false) {
        token.mustChangePassword = false;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.departmentId = token.departmentId as string;
        session.user.departmentName = token.departmentName as string;
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};
