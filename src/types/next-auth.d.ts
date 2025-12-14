import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role?: string | null;
      identityFlagStatus?: string | null;
    } & DefaultSession['user'];
    subscription?: {
      tier: string;
      status: string;
      active: boolean;
    };
  }

  interface User {
    id: string;
    role?: string | null;
    identityFlagStatus?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string | null;
    identityFlagStatus?: string | null;
  }
}
