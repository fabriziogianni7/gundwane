import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost"],
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
