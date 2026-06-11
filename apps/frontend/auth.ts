/**
 * apps/frontend/auth.ts
 *
 * NextAuth v5 (Auth.js) configuration.
 *
 * VERCEL ENV VARS — all of these are required:
 *   AUTH_SECRET          → random 32+ char string (same as NEXTAUTH_SECRET)
 *   NEXTAUTH_URL         → https://kairo.ashishkarmakar.in
 *   GITHUB_CLIENT_ID     → from GitHub OAuth App
 *   GITHUB_CLIENT_SECRET → from GitHub OAuth App
 *
 * GITHUB OAUTH APP — Authorization callback URL must be:
 *   https://kairo.ashishkarmakar.in/api/auth/callback/github
 *
 * NOTE: We use NextAuth's standard callback path /api/auth/callback/github.
 *       The proxy route at /api/auth/github/callback is kept as a safety
 *       redirect in case GitHub ever hits that path.
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

// ── Ensure AUTH_SECRET is set (NextAuth v5 reads this env var directly) ────────
if (!process.env.AUTH_SECRET && process.env.NEXTAUTH_SECRET) {
  process.env.AUTH_SECRET = process.env.NEXTAUTH_SECRET;
}

const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

// Log initialization diagnostics (presence and lengths only, to protect secrets)
console.log("[auth] NextAuth Initialization Diagnostics:", {
  hasSecret: !!secret,
  secretLength: secret?.length ?? 0,
  hasNextauthUrl: !!process.env.NEXTAUTH_URL,
  nextauthUrl: process.env.NEXTAUTH_URL ?? "not set",
  hasGithubClientId: !!process.env.GITHUB_CLIENT_ID,
  githubClientIdLength: process.env.GITHUB_CLIENT_ID?.length ?? 0,
  hasGithubClientSecret: !!process.env.GITHUB_CLIENT_SECRET,
  githubClientSecretLength: process.env.GITHUB_CLIENT_SECRET?.length ?? 0,
});

if (!secret) {
  console.error(
    "[auth] ⛔ AUTH_SECRET is missing! NextAuth v5 will fail in production.\n" +
    "Please add AUTH_SECRET to your Vercel Environment Variables and redeploy."
  );
}

if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
  console.error(
    "[auth] ⛔ GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET is missing!\n" +
    "Please ensure both are set in your Vercel Environment Variables."
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret,
  trustHost: true,
  debug: process.env.NODE_ENV !== "production",

  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
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
