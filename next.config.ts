import type { NextConfig } from "next";

// Screenshot uploads: up to 5 × 5 MB, plus multipart overhead.
const uploadLimit = "26mb";

const nextConfig: NextConfig = {
  // Remotion's server renderer uses native binaries and webpack; keep it out of the bundle.
  serverExternalPackages: ["@remotion/bundler", "@remotion/renderer", "@remotion/vercel", "@vercel/sandbox", "@sparticuz/chromium", "playwright-core"],
  // The server render (lib/film-snapshot.ts) sends the bundled film to its
  // sandbox (built before `next build` by scripts/film/bundle.mjs).
  // The website capture (lib/website-capture.ts) runs its own serverless
  // Chromium, whose packed browser files are read at run time.
  outputFileTracingIncludes: {
    "/*": ["./.remotion-bundle/**/*", "./node_modules/@sparticuz/chromium/bin/**/*"],
  },
  experimental: {
    serverActions: { bodySizeLimit: uploadLimit },
    proxyClientMaxBodySize: uploadLimit,
  },
};

export default nextConfig;
