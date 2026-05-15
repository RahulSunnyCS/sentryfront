/**
 * NextAuth Configuration
 *
 * Handles authentication with GitHub and Google OAuth providers.
 * Only active when AUTH_ENABLED=true and AUTH_PROVIDER=nextauth.
 */

import { NextAuthOptions } from 'next-auth';
import GitHubProvider from 'next-auth/providers/github';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import { authConfig } from '@/lib/features';

// Extend session user type
interface ExtendedUser {
  id: string;
  tier?: string;
}

export const nextAuthConfig: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    GitHubProvider({
      clientId: authConfig.nextauth.github.id,
      clientSecret: authConfig.nextauth.github.secret,
    }),
    GoogleProvider({
      clientId: authConfig.nextauth.google.clientId,
      clientSecret: authConfig.nextauth.google.clientSecret,
    }),
  ],

  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        const extendedUser = session.user as typeof session.user & ExtendedUser;
        extendedUser.id = user.id;
        // Fetch tier from database
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { tier: true },
        });
        extendedUser.tier = dbUser?.tier || 'free';
      }
      return session;
    },
  },

  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: authConfig.nextauth.secret,

  events: {
    async createUser({ user }) {
      // OAuth sign-ups have already proven their email via the provider.
      // Mark emailVerified immediately so they bypass the verification gate.
      if (user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: new Date() },
        });
      }
    },
  },
};
