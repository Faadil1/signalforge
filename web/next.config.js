/** @type {import('next').NextConfig} */

const VERIFIED_RUNTIME = "https://signalforge.faadil-casecraft.workers.dev";
const DEFAULT_API_URL = process.env.NODE_ENV === "development" ? VERIFIED_RUNTIME : "http://localhost:8000";
const API_URL = process.env.API_URL || DEFAULT_API_URL;
const CLOUDFLARE_STATIC_EXPORT = process.env.CLOUDFLARE_STATIC_EXPORT === "1";

function isValidApiUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const rewriteTarget = isValidApiUrl(API_URL) ? API_URL : DEFAULT_API_URL;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: CLOUDFLARE_STATIC_EXPORT ? "export" : "standalone",
  trailingSlash: CLOUDFLARE_STATIC_EXPORT,
};

if (!CLOUDFLARE_STATIC_EXPORT) {
  nextConfig.rewrites = async () => [
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
}

module.exports = nextConfig;
