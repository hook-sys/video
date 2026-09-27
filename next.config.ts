import type { NextConfig } from "next";

// Screenshot uploads: up to 5 × 5 MB, plus multipart overhead.
const uploadLimit = "26mb";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: uploadLimit },
    proxyClientMaxBodySize: uploadLimit,
  },
};

export default nextConfig;
