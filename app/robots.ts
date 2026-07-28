import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/features", "/how-it-works", "/privacy", "/terms", "/contact"], disallow: ["/dashboard", "/homes", "/rooms", "/assets", "/maintenance", "/repairs", "/documents", "/notifications", "/members", "/settings", "/onboarding", "/api/"] },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

