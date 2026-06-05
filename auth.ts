import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import PostgresAdapter from "@auth/pg-adapter";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  adapter: PostgresAdapter(pool),
  providers: [Google],
  callbacks: {
    session({ session, user }) {
      // Expose user.id on the session so API routes can use it
      session.user.id = user.id;
      return session;
    },
  },
});
