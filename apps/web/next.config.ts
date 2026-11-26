import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.VAHAKIN_BUILD_DIR || ".next",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
