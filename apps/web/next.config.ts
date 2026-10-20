import type { NextConfig } from "next";
import { resolve } from "node:path";

const workerOrigin = (process.env.CLOUDFLARE_WORKER_ORIGIN || "http://127.0.0.1:8787").replace(/\/$/, "");
const nextConfig: NextConfig = {
  transpilePackages: ["@loydura/chain"],
  outputFileTracingRoot: resolve(__dirname, "../.."),
  reactStrictMode: true,
  poweredByHeader: false,
  webpack(config) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };
    return config;
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${workerOrigin}/api/:path*` }];
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
      ]
    }];
  }
};
export default nextConfig;
