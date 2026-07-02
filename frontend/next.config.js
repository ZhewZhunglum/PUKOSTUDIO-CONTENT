/** @type {import('next').NextConfig} */

// Remote image patterns — always includes local MinIO for dev;
// NEXT_PUBLIC_STORAGE_DOMAIN adds the R2 (or custom) domain for prod.
const remotePatterns = [
  { protocol: "http", hostname: "localhost", port: "9000" },
  { protocol: "http", hostname: "127.0.0.1", port: "9000" },
];

const storageDomain = process.env.NEXT_PUBLIC_STORAGE_DOMAIN;
if (storageDomain) {
  const url = storageDomain.includes("://")
    ? new URL(storageDomain)
    : new URL(`https://${storageDomain}`);
  remotePatterns.push({
    protocol: url.protocol.replace(":", ""),
    hostname: url.hostname,
    port: url.port || undefined,
  });
}

const nextConfig = {
  reactStrictMode: true,
  images: { remotePatterns },

  // SSR-side API proxy (used for server components / next/fetch and direct
  // port-3847 access). Uses INTERNAL_API_URL (Docker service name) so the
  // Next.js server can reach the backend container. Client-side axios calls
  // use relative URLs (baseURL: "") and go through nginx instead.
  async rewrites() {
    const apiBase =
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://backend:8371";
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
