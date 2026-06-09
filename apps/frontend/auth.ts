/**
 * apps/frontend/auth.ts
 *
 * NextAuth v5 (Auth.js) configuration.
 *
 * Uses the built-in GitHub provider with a custom token.request override
 * so we can send the correct redirect_uri (/api/auth/github/callback) during
 * the token exchange — not the NextAuth-computed /api/auth/callback/github.
 *
 * GitHub OAuth App must be configured with:
 *   Authorization callback URL → https://kairo.ashishkarmakar.in/api/auth/github/callback
 *
 * Vercel env vars REQUIRED (without these, NextAuth returns 500):
 *   AUTH_SECRET      → run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *   NEXTAUTH_URL     → https://kairo.ashishkarmakar.in
 *   GITHUB_CLIENT_ID → from GitHub OAuth App settings
 *   GITHUB_CLIENT_SECRET → from GitHub OAuth App settings
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
  throw new Error(
    "[auth] AUTH_SECRET is not set. " +
    "Add it to Vercel → Project → Settings → Environment Variables, then redeploy. " +
    "Generate a value with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  );
}

// Production: https://kairo.ashishkarmakar.in
// Local dev:  http://localhost:3000
// Set NEXTAUTH_URL in Vercel → Settings → Environment Variables
const BASE_URL = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

// The callback URL registered in your GitHub OAuth App.
// This is sent as redirect_uri in BOTH authorization AND token exchange.
const GITHUB_CALLBACK_URL = `${BASE_URL}/api/auth/github/callback`;

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret,
  trustHost: true,

  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,

      // Override the redirect_uri sent to GitHub in the authorization request.
      authorization: {
        params: {
          scope: "read:user user:email",
          redirect_uri: GITHUB_CALLBACK_URL,
        },
      },

      // Override the token exchange so the redirect_uri sent to GitHub's token
      // endpoint matches the authorization redirect_uri above.
      // Without this, NextAuth computes /api/auth/callback/github for the token
      // exchange, which doesn't match the OAuth App registration → GitHub rejects it.
      token: {
        async request(context: any) {
          const { params, checks, provider } = context;

          const body = new URLSearchParams({
            client_id: provider.clientId!,
            client_secret: provider.clientSecret!,
            code: params.code!,
            redirect_uri: GITHUB_CALLBACK_URL,
            grant_type: "authorization_code",
          });

          // Include PKCE code_verifier if NextAuth generated one
          if (checks?.code_verifier) {
            body.set("code_verifier", checks.code_verifier);
          }

          const response = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Accept: "application/json",
            },
            body,
          });

          const tokens = await response.json();
          return { tokens };
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
