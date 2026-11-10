import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (base local para desarrollo) no debe empaquetarse.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
