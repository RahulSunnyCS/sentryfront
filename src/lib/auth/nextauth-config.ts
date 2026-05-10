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
        session.user.id = user.id;
        // Fetch tier from database
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { tier: true },
        });
        session.user.tier = dbUser?.tier || 'free';
      }
      return session;
    },
  },

  // Use NextAuth's default sign-in page (remove custom pages for now)
  // pages: {
  //   signIn: '/auth/signin',
  //   error: '/auth/error',
  // },

  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: authConfig.nextauth.secret,
};
