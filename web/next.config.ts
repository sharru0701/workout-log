import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React Compiler is stable in production build here,
  // while dev + Turbopack can produce intermittent HMR graph issues.
  reactCompiler: process.env.NODE_ENV === "production",
};

export default nextConfig;
