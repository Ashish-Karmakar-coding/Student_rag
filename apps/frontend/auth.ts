/**
 * apps/frontend/auth.ts
 *
 * NextAuth v5 configuration (Auth.js).
 * Exports: { handlers, auth, signIn, signOut }
 * Used by: app/api/auth/[...nextauth]/route.ts and middleware.ts
 *
 * GitHub OAuth App callback URL (registered in GitHub settings):
 *   https://kairo.ashishkarmakar.in/api/auth/github/callback
 *
 * That URL is handled by:
 *   app/api/auth/github/callback/route.ts
 * which rewrites the request to /api/auth/callback/github for NextAuth to process.
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

// AUTH_SECRET must be set in Vercel environment variables.
// NextAuth v5 will throw a Configuration error if it is missing.
const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

if (!secret) {
  // This will appear in Vercel deployment logs — helps diagnose ?error=Configuration
  console.error(
    "[auth] FATAL: AUTH_SECRET is not set. " +
    "Add AUTH_SECRET to your Vercel environment variables and redeploy."
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret,

  // Required when running behind Vercel's reverse proxy — lets NextAuth
  // trust x-forwarded-host and construct correct internal URLs.
  trustHost: true,

  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      // Tell GitHub exactly which URL to redirect back to after auth.
      // Must match the "Authorization callback URL" in your GitHub OAuth App settings.
      authorization: {
        params: {
          redirect_uri: "https://kairo.ashishkarmakar.in/api/auth/github/callback",
        },
      },
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
    error: "/",
  },
});
