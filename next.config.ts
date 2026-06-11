import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.igdb.com",
      },
      {
        protocol: "https",
        hostname: "images.igdb.net",
      },
      {
        protocol: "https",
        hostname: "cdn.igdb.com",
      },
    ],
  },
};

export default nextConfig;
