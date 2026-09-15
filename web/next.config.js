/** @type {import('next').NextConfig} */

const API_URL = process.env.API_URL || "http://localhost:8000";
const CLOUDFLARE_STATIC_EXPORT = process.env.CLOUDFLARE_STATIC_EXPORT === "1";

function isValidApiUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const rewriteTarget = isValidApiUrl(API_URL) ? API_URL : "http://localhost:8000";

const nextConfig = {
  output: CLOUDFLARE_STATIC_EXPORT ? "export" : "standalone",
  trailingSlash: CLOUDFLARE_STATIC_EXPORT,
  async rewrites() {
    if (CLOUDFLARE_STATIC_EXPORT) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${rewriteTarget}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${rewriteTarget}/health`,
      },
      {
        source: "/.well-known/xagent-verification.json",
        destination: `${rewriteTarget}/.well-known/xagent-verification.json`,
      },
    ];
  },
};

module.exports = nextConfig;
