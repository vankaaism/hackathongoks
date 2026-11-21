import type { NextConfig } from "next";

const config: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["unpdf"],
};

export default config;
