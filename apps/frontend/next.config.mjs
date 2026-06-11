/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Silence TypeScript and ESLint errors during `next build` on Vercel.
  // Type-safety is enforced locally via `pnpm type-check`.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

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

  experimental: {},

  async rewrites() {
    const backendUrl = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
