import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Scoped strictly to the embeddable public form — allows it to be framed on a business
        // owner's own site (<iframe src=".../f/[slug]">). Does not affect "/", "/review", or
        // "/api/*". No X-Frame-Options is set here, since a permissive CSP frame-ancestors is
        // the modern replacement and the two can conflict.
        source: "/f/:slug*",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
    ];
  },
};

export default nextConfig;
