/**
 * apps/frontend/auth.ts
 *
 * NextAuth v5 (Auth.js) configuration.
 *
 * Uses a CUSTOM GitHub OAuth provider (not the built-in one) so we can
 * explicitly set redirect_uri in BOTH the authorization request AND the
 * token exchange request. This is the only way to reliably use a non-standard
 * callback path (/api/auth/github/callback) with NextAuth v5.
 *
 * GitHub OAuth App must be configured with:
 *   Authorization callback URL → https://kairo.ashishkarmakar.in/api/auth/github/callback
 *
 * Vercel env vars required:
 *   NEXTAUTH_URL     → https://kairo.ashishkarmakar.in
 *   AUTH_SECRET      → any 32+ char random string
 *   GITHUB_CLIENT_ID → from GitHub OAuth App
 *   GITHUB_CLIENT_SECRET → from GitHub OAuth App
 */

import NextAuth from "next-auth";

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
  console.error("[auth] FATAL: AUTH_SECRET is not set in Vercel environment variables.");
}

// Production: https://kairo.ashishkarmakar.in
// Local dev:  http://localhost:3000
// Set NEXTAUTH_URL in Vercel → Settings → Environment Variables
const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

// The exact callback URL registered in the GitHub OAuth App.
// GitHub → Settings → Developer Settings → OAuth Apps → your app
// Authorization callback URL = this value exactly.
const GITHUB_CALLBACK_URL = `${BASE_URL}/api/auth/github/callback`;

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret,

  // Required on Vercel so NextAuth trusts the x-forwarded-host header
  // and sets cookies for the correct domain.
  trustHost: true,

  providers: [
    {
      id: "github",
      name: "GitHub",
      type: "oauth" as const,

      // Step 1: Send user to GitHub for authorization.
      // redirect_uri MUST match the "Authorization callback URL" in GitHub OAuth App.
      authorization: {
        url: "https://github.com/login/oauth/authorize",
        params: {
          scope: "read:user user:email",
          redirect_uri: GITHUB_CALLBACK_URL,
        },
      },

      // Step 2: Exchange the code for an access token.
      // We control redirect_uri explicitly here — this is the critical fix.
      // Without this, NextAuth computes /api/auth/callback/github which doesn't
      // match the GitHub OAuth App registration → token exchange fails.
      token: {
        url: "https://github.com/login/oauth/access_token",
        async request(context: any) {
          const { params, checks, provider } = context;
          const body = new URLSearchParams({
            client_id: provider.clientId!,
            client_secret: provider.clientSecret!,
            code: params.code!,
            redirect_uri: GITHUB_CALLBACK_URL, // ← same as authorization
            grant_type: "authorization_code",
          });
          // Include PKCE code verifier if present (NextAuth v5 enables PKCE by default)
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

      // Step 3: Fetch the authenticated user's profile from GitHub.
      userinfo: {
        url: "https://api.github.com/user",
        async request(context: any) {
          const { tokens } = context;
          const response = await fetch("https://api.github.com/user", {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
              Accept: "application/vnd.github.v3+json",
              "User-Agent": "StudyTutor/1.0",
            },
          });
          return response.json();
        },
      },

      // Step 4: Map the raw GitHub profile to NextAuth's normalized user object.
      profile(profile: any) {
        return {
          id: profile.id.toString(),
          name: profile.name ?? profile.login,
          email: profile.email ?? null,
          image: profile.avatar_url,
        };
      },

      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      checks: ["pkce", "state"],
    },
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
