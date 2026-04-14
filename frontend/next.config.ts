import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/earn/v2", destination: "/earn", permanent: true },
      { source: "/positions/v2", destination: "/positions", permanent: true },
    ];
  },
};

export default nextConfig;
