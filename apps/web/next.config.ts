import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/docs",
        destination: "/guide",
        permanent: false,
      },
      {
        source: "/docs/user-guide",
        destination: "/guide",
        permanent: false,
      },
      {
        source: "/help",
        destination: "/guide",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
