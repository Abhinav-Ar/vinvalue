import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { getDb } from './db';
import { users, accounts, sessions, verificationTokens } from '../models/db/schema';

/**
 * Auth.js v5 with Google. Database sessions (revocable). Env:
 * AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET (picked up automatically). The older
 * GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET names from the original vinvalue deploy also work.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  } as never),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: 'database' },
  callbacks: {
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
}));
