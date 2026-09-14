import type { NextConfig } from "next";

// The console is deployed behind Nginx Proxy Manager, so it must stay
// origin-agnostic: no absolute URLs, no host assumptions, no server-side trust
// of a forwarded host for anything security relevant.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
