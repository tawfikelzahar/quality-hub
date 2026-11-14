import type { NextConfig } from "next";

// Security headers on every response (pages, API, files in public/).
//   nosniff         the browser never guesses a file type (no HTML run from an upload)
//   Referrer-Policy other sites see only the domain, never the full address
//   X-Frame-Options the site cannot be shown inside another site's frame (clickjacking)
//   Permissions     camera, microphone and location are switched off; the site uses none
// HSTS is already sent by Vercel. A Content-Security-Policy is left for later:
// it has to list Google Analytics, Supabase and Paymob exactly, or it breaks them.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
