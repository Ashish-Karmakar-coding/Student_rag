/**
 * apps/frontend/auth.ts
 *
 * NextAuth v5 (Auth.js) configuration.
 * Exports: { handlers, auth, signIn, signOut }
 *
 * GitHub OAuth App — Authorization callback URL must be set to:
 *   https://kairo.ashishkarmakar.in/api/auth/callback/github
 *
 * This is NextAuth's native callback path. No rewrites, no custom handlers.
 */

import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

declare module "next-auth" {
  interface Session {
    user: {
      githubId: string;
      login: string;
      avatarUrl: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}

// @ts-ignore
declare module "next-auth/jwt" {
  interface JWT {
    githubId?: string;
    login?: string;
    avatarUrl?: string;
  }
}

if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
  console.error(
    "[auth] FATAL: AUTH_SECRET is not set. " +
      "Add AUTH_SECRET to your Vercel environment variables and redeploy."
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,

  // Required on Vercel — trusts x-forwarded-host so NextAuth builds correct
  // internal URLs and sets cookies for the right domain automatically.
  trustHost: true,

  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      // DO NOT override redirect_uri here.
      // With trustHost:true, NextAuth computes it from the incoming request
      // host header → https://kairo.ashishkarmakar.in/api/auth/callback/github
      // That URL must be registered as the callback in your GitHub OAuth App.
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        const p = profile as any;
        token.githubId = p.id?.toString();
        token.login = p.login;
        token.avatarUrl = p.avatar_url;
        token.email = p.email;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.githubId = (token.githubId as string) ?? "";
      session.user.login = (token.login as string) ?? session.user.name ?? "";
      session.user.avatarUrl =
        (token.avatarUrl as string) ?? session.user.image ?? "";
      session.user.email = token.email ?? "";
      return session;
    },
  },

  pages: {
    signIn: "/",
    // error page intentionally left as default (/api/auth/error)
    // so you can see the actual error name if something goes wrong
  },
});
