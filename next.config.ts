import type { NextConfig } from "next";

// Screenshot uploads: up to 5 × 5 MB, plus multipart overhead.
const uploadLimit = "26mb";

const nextConfig: NextConfig = {
  // Remotion's server renderer uses native binaries and webpack; keep it out of the bundle.
  serverExternalPackages: ["@remotion/bundler", "@remotion/renderer", "@remotion/vercel", "@vercel/sandbox"],
  // playwright-core loads browsers.json via a dynamic require that file tracing
  // misses; without it the server actions module fails to load on Vercel.
  // The frame check (lib/frame-check) sends the bundled film to its sandbox
  // (built before `next build` by scripts/frame-check/bundle.mjs).
  outputFileTracingIncludes: {
    "/*": ["./node_modules/playwright-core/browsers.json", "./.remotion-bundle/**/*"],
  },
  experimental: {
    serverActions: { bodySizeLimit: uploadLimit },
    proxyClientMaxBodySize: uploadLimit,
  },
};

export default nextConfig;
