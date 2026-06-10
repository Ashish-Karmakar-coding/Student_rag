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
};

export default nextConfig;
