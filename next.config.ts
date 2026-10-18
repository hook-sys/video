import type { NextConfig } from "next";

// Screenshot uploads: up to 5 × 5 MB, plus multipart overhead.
const uploadLimit = "26mb";

const nextConfig: NextConfig = {
  // Remotion's server renderer uses native binaries and webpack; keep it out of the bundle.
  serverExternalPackages: ["@remotion/bundler", "@remotion/renderer", "@remotion/vercel", "@vercel/sandbox"],
  // The server render (lib/film-snapshot.ts) sends the bundled film to its
  // sandbox (built before `next build` by scripts/film/bundle.mjs).
  outputFileTracingIncludes: {
    "/*": ["./.remotion-bundle/**/*"],
  },
  experimental: {
    serverActions: { bodySizeLimit: uploadLimit },
    proxyClientMaxBodySize: uploadLimit,
  },
};

export default nextConfig;
