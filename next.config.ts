import type { NextConfig } from "next";

// Screenshot uploads: up to 5 × 5 MB, plus multipart overhead.
const uploadLimit = "26mb";

const nextConfig: NextConfig = {
  // Remotion's server renderer uses native binaries and webpack; keep it out of the bundle.
  serverExternalPackages: ["@remotion/bundler", "@remotion/renderer"],
  // playwright-core loads browsers.json via a dynamic require that file tracing
  // misses; without it the server actions module fails to load on Vercel.
  outputFileTracingIncludes: {
    "/*": ["./node_modules/playwright-core/browsers.json"],
  },
  experimental: {
    serverActions: { bodySizeLimit: uploadLimit },
    proxyClientMaxBodySize: uploadLimit,
  },
};

export default nextConfig;
