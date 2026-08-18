import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  async headers() {
    return [
      {
        source: "/maplibre/:path*",
        headers: [
          { key: "Content-Type", value: "text/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
