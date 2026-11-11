import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "*.supabase.in",
      },
    ],
  },
  async headers() {
    return [
      {
        // SCORM package files set their own framing headers: the course
        // player must be able to iframe them (same origin), which DENY forbids.
        // The capstone hand-in page is left out here and gets its own rule
        // below: it records pushback answers on the learner's camera.
        source: "/((?!scorm-content/|learn/capstone/).*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Content-Security-Policy is set per-request in src/middleware.ts so
          // it can carry a nonce; defining it here too would emit conflicting
          // duplicate headers (browsers enforce the intersection).
        ],
      },
      {
        // Same headers, except camera and microphone are allowed for this
        // site itself: the MOS-100 briefing's pushback answers are recorded
        // in the browser. With camera=() the browser refused before even
        // asking the learner, and every answer fell back to an upload.
        source: "/learn/capstone/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
