/**
 * apps/frontend/auth.ts
 *
 * NextAuth v5 (Auth.js) configuration.
 *
 * VERCEL ENV VARS — all of these are required:
 *   AUTH_SECRET          → random 32+ char string
 *   NEXTAUTH_URL         → https://kairo.ashishkarmakar.in
 *   GITHUB_CLIENT_ID     → from GitHub OAuth App
 *   GITHUB_CLIENT_SECRET → from GitHub OAuth App
 *
 * GITHUB OAUTH APP — Authorization callback URL must be:
 *   https://kairo.ashishkarmakar.in/api/auth/github/callback
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

// DO NOT throw here — a throw at module level crashes the entire auth module,
// including the error page, producing a 500 instead of a helpful error message.
// NextAuth itself handles missing secrets with its own Configuration error.
const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
if (!secret) {
  console.error(
    "\n[auth] ⛔ AUTH_SECRET is not set!\n" +
    "  → Vercel: Project → Settings → Environment Variables\n" +
    "  → Add AUTH_SECRET = b65407f311c91ff30bf8686d061141bc214fa76c4e432c7a022dfa6b63d667c4\n" +
    "  → Then REDEPLOY\n"
  );
}

// Base URL — must be set to https://kairo.ashishkarmakar.in in Vercel.
// If missing, defaults to localhost which causes redirect_uri mismatch with GitHub.
const BASE_URL = (
  process.env.NEXTAUTH_URL ??
  process.env.NEXT_PUBLIC_BASE_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

// Must match "Authorization callback URL" in GitHub OAuth App settings exactly.
const GITHUB_CALLBACK_URL = `${BASE_URL}/api/auth/github/callback`;

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret,
  trustHost: true,

  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",

      // Send our custom callback URL to GitHub in the authorization request.
      authorization: {
        params: {
          scope: "read:user user:email",
          redirect_uri: GITHUB_CALLBACK_URL,
        },
      },

      // Override token exchange to use our callback URL as redirect_uri.
      // Without this, NextAuth computes /api/auth/callback/github internally,
      // which doesn't match the GitHub OAuth App registration → token exchange fails.
      token: {
        async request(context: any) {
          const { params, checks, provider } = context;

          console.log("[auth] token exchange → redirect_uri:", GITHUB_CALLBACK_URL);

          const body = new URLSearchParams({
            client_id: provider.clientId,
            client_secret: provider.clientSecret,
            code: params.code,
            redirect_uri: GITHUB_CALLBACK_URL,
            grant_type: "authorization_code",
          });

          if (checks?.code_verifier) {
            body.set("code_verifier", checks.code_verifier);
          }

          const response = await fetch(
            "https://github.com/login/oauth/access_token",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json",
              },
              body,
            }
          );

          if (!response.ok) {
            const text = await response.text();
            console.error("[auth] GitHub token exchange failed:", response.status, text);
            throw new Error(`GitHub token exchange failed: ${response.status}`);
          }

          const tokens = await response.json();

          if (tokens.error) {
            console.error("[auth] GitHub token error:", tokens.error, tokens.error_description);
            throw new Error(`GitHub OAuth error: ${tokens.error} — ${tokens.error_description}`);
          }

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
