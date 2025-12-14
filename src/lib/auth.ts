import { PrismaAdapter } from '@next-auth/prisma-adapter';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { prisma } from './prisma';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user) return null;

        const isValid = await compare(credentials.password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.firstName ?? user.email,
          role: user.role,
          identityFlagStatus: user.identityFlagStatus ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id?: string }).id;
        token.role = (user as { role?: string }).role;
        token.identityFlagStatus = (user as { identityFlagStatus?: string | null }).identityFlagStatus ?? null;
      }

      const userId = (token.id as string | undefined) ?? (token.sub as string | undefined);
      if (userId) {
        const subscription = await prisma.subscription.findUnique({ where: { userId } });
        if (subscription) {
          (token as Record<string, unknown>).subscriptionTier = subscription.tier;
          (token as Record<string, unknown>).subscriptionStatus = subscription.status;
          (token as Record<string, unknown>).subscriptionActive = ['active', 'trialing', 'past_due'].includes(subscription.status);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string | undefined) ?? null;
        session.user.identityFlagStatus = (token.identityFlagStatus as string | null | undefined) ?? null;

        const subscription = await prisma.subscription.findUnique({ where: { userId: session.user.id } });
        session.subscription = subscription
          ? { tier: subscription.tier, status: subscription.status, active: ['active', 'trialing', 'past_due'].includes(subscription.status) }
          : { tier: 'free', status: 'inactive', active: false };
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
