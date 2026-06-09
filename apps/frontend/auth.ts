/**
 * apps/frontend/auth.ts
 *
 * NextAuth v5 (Auth.js) configuration.
 *
 * GITHUB OAUTH APP SETTINGS (github.com → Settings → Developer Settings → OAuth Apps):
 *   Authorization callback URL → https://kairo.ashishkarmakar.in/api/auth/callback/github
 *
 * VERCEL ENV VARS REQUIRED:
 *   AUTH_SECRET      → any 32-char random string
 *   GITHUB_CLIENT_ID → from the GitHub OAuth App
 *   GITHUB_CLIENT_SECRET → from the GitHub OAuth App
 *   NEXTAUTH_URL     → https://kairo.ashishkarmakar.in   ← CRITICAL
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

const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
if (!secret) {
  console.error("[auth] FATAL: AUTH_SECRET is not set in environment variables.");
}

// The base URL of this app.
// On Vercel production this MUST be https://kairo.ashishkarmakar.in
// On local dev this is http://localhost:3000
// Set NEXTAUTH_URL in Vercel → Settings → Environment Variables.
const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

// The exact URL NextAuth will use as the OAuth callback.
// THIS MUST MATCH the "Authorization callback URL" in your GitHub OAuth App.
// Go to: github.com → Settings → Developer settings → OAuth Apps → your app → Edit
const callbackUrl = `${baseUrl}/api/auth/callback/github`;

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret,

  // Required on Vercel — trusts x-forwarded-host so NextAuth
  // correctly determines the domain for cookies and redirects.
  trustHost: true,

  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      // Explicitly set the redirect_uri so there is zero ambiguity.
      // NextAuth will send exactly this URL to GitHub's authorization endpoint.
      // GitHub will redirect back to this URL after the user authorizes.
      // This MUST match the "Authorization callback URL" in your GitHub OAuth App.
      authorization: {
        params: {
          redirect_uri: callbackUrl,
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
  },
});
