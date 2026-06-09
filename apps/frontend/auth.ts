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
 * next.config.mjs rewrites that path to /api/auth/callback/github before
 * any route handler runs, so NextAuth processes the callback correctly
 * with all cookies preserved.
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
      // Explicitly tell GitHub which URL to redirect back to after auth.
      // This MUST exactly match the "Authorization callback URL" in your
      // GitHub OAuth App settings.
      //
      // next.config.mjs rewrites this path to /api/auth/callback/github
      // before the Next.js router processes it.
      authorization: {
        params: {
          redirect_uri: `${
            process.env.NEXT_PUBLIC_BASE_URL ??
            process.env.NEXTAUTH_URL ??
            "http://localhost:3000"
          }/api/auth/github/callback`,
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
    // signIn page — unauthenticated users land here
    signIn: "/",
    // IMPORTANT: Do NOT set pages.error to "/" — that causes NextAuth errors
    // (like ?error=Configuration) to silently redirect to the landing page,
    // making it impossible to diagnose what's wrong. Let NextAuth use its
    // built-in /api/auth/error page so you can see the actual error.
  },
});
