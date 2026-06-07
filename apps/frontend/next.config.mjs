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

  async redirects() {
    return [
      {
        // GitHub OAuth App registered callback → NextAuth.js actual handler
        // permanent: false so the browser never caches this (critical for OAuth)
        source: "/api/auth/github/callback",
        destination: "/api/auth/callback/github",
        permanent: false,
      },
    ];
  },

  experimental: {},
};

export default nextConfig;
