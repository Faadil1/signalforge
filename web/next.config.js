/** @type {import('next').NextConfig} */

const API_URL = process.env.API_URL || "http://localhost:8000";

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
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${rewriteTarget}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;