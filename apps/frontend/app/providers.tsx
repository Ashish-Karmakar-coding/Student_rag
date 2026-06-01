"use client";
/**
 * apps/frontend/app/providers.tsx
 * Client-side providers wrapper (SessionProvider must be client component).
 */
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
