/**
 * apps/frontend/auth.ts
 *
 * NextAuth v5 configuration (Auth.js).
 * Exports: { handlers, auth, signIn, signOut }
 * Used by: app/api/auth/[...nextauth]/route.ts and middleware.ts
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  // NextAuth v5 reads AUTH_SECRET automatically, but we also pass it
  // explicitly so it works even if only NEXTAUTH_SECRET is set in Vercel.
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,

  // Required when deploying behind a proxy (Vercel) so NextAuth trusts the
  // x-forwarded-host header and builds internal URLs correctly.
  trustHost: true,

  providers: [
    GitHub({
      clientId: process.env["GITHUB_CLIENT_ID"]!,
      clientSecret: process.env["GITHUB_CLIENT_SECRET"]!,
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
      session.user.avatarUrl = (token.avatarUrl as string) ?? session.user.image ?? "";
      session.user.email = token.email ?? "";
      return session;
    },
  },

  pages: {
    signIn: "/",    // redirect to landing page
    error: "/",
  },
});
