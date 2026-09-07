import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import PostgresAdapter from "@auth/pg-adapter";
import { db } from "@/models/database";

export const authController = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET || (process.env.NODE_ENV === "development" ? "autoiq-local-development-only-secret" : undefined),
  adapter: PostgresAdapter(db),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
