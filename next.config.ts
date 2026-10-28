import path from "node:path";
import type { NextConfig } from "next";

// CareerOS is standalone; never let Next infer a parent directory as the project root.
const root = path.resolve(__dirname);

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: root,
  turbopack: { root },
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
