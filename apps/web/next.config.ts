import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Same list as apps/web/vercel.json. `headers()` is omitted when
 * NEXT_STATIC_EXPORT=1 because `output: 'export'` cannot emit them.
 * The Capacitor build sets that variable. Vercel leaves it unset.
 */
export const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "object-src 'none'",
      "img-src 'self' data:",
      "font-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
      "connect-src 'self' https://vitals.vercel-insights.com",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const staticExport = process.env.NEXT_STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  transpilePackages: ["@an-alq/sim", "@an-alq/relay", "@an-alq/emitters"],
  turbopack: {
    root: path.resolve(here, "../.."),
  },
  ...(staticExport ? { output: "export" as const } : {}),
  ...(staticExport
    ? {}
    : {
        async headers() {
          return [{ source: "/:path*", headers: [...securityHeaders] }];
        },
      }),
};

export default nextConfig;
