import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      departmentId: string;
      departmentName: string;
      mustChangePassword: boolean;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    departmentId: string;
    departmentName: string;
    mustChangePassword: boolean;
    /** Ortak DB'de pasife alındı → oturum geçersiz (lib/auth.ts jwt callback). */
    inactive?: boolean;
  }
}
