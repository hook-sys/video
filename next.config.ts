import type { NextConfig } from "next";

// Screenshot uploads: up to 5 × 5 MB, plus multipart overhead.
const uploadLimit = "26mb";

const nextConfig: NextConfig = {
  // Remotion's server renderer uses native binaries and webpack; keep it out of the bundle.
  serverExternalPackages: ["@remotion/bundler", "@remotion/renderer"],
  experimental: {
    serverActions: { bodySizeLimit: uploadLimit },
    proxyClientMaxBodySize: uploadLimit,
  },
};

export default nextConfig;
