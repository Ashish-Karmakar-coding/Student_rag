/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/**",
      },
    ],
  },

  pageExtensions: ["ts", "tsx", "js", "jsx"],

  /**
   * Remap the GitHub OAuth callback URL to the NextAuth v5 internal handler.
   *
   * The GitHub OAuth App is registered with callback URL:
   *   /api/auth/github/callback
   *
   * NextAuth v5 internally handles:
   *   /api/auth/callback/github
   *
   * A Next.js rewrite (not a redirect) maps one to the other BEFORE any route
   * handler runs, so all cookies — including authjs.state and
   * authjs.pkce.code_verifier — are preserved identically. This is far more
   * reliable than a manual route handler that re-creates the request.
   */
  async rewrites() {
    return [
      {
        source: "/api/auth/github/callback",
        destination: "/api/auth/callback/github",
      },
    ];
  },

  experimental: {},
};

export default nextConfig;
