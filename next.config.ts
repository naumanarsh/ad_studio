import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native module — must stay external to the server bundle.
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    serverActions: {
      // Image Studio uploads reference images through a server action.
      bodySizeLimit: "16mb",
    },
  },
};

export default nextConfig;
