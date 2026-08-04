import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Homi — Your home, remembered",
    short_name: "Homi",
    description:
      "A private home journal for maintenance, equipment, repairs, warranties and documents.",
    start_url: "/dashboard?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#f4f6f8",
    theme_color: "#1d6a4e",
    categories: ["utilities", "productivity", "lifestyle"],
    lang: "en",
    dir: "ltr",
    icons: [
      {
        src: "/pwa/icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon/512?maskable=1",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Scan equipment",
        short_name: "Scan",
        description: "Scan a barcode or serial number to open an equipment record.",
        url: "/scan?source=shortcut",
        icons: [{ src: "/pwa/icon/192?glyph=scan", sizes: "192x192" }],
      },
      {
        name: "Create maintenance",
        short_name: "Maintenance",
        description: "Schedule a new maintenance task.",
        url: "/maintenance?new=1&source=shortcut",
        icons: [
          { src: "/pwa/icon/192?glyph=maintenance", sizes: "192x192" },
        ],
      },
      {
        name: "Declare a repair",
        short_name: "Repair",
        description: "Record a repair issue.",
        url: "/repairs?new=1&source=shortcut",
        icons: [{ src: "/pwa/icon/192?glyph=repair", sizes: "192x192" }],
      },
      {
        name: "Open calendar",
        short_name: "Calendar",
        description: "Open the Homi household calendar.",
        url: "/calendar?source=shortcut",
        icons: [{ src: "/pwa/icon/192?glyph=calendar", sizes: "192x192" }],
      },
    ],
    screenshots: [
      {
        src: "/pwa/screenshot/1280/720",
        sizes: "1280x720",
        type: "image/png",
        form_factor: "wide",
        label: "Homi home dashboard",
      },
      {
        src: "/pwa/screenshot/390/844",
        sizes: "390x844",
        type: "image/png",
        form_factor: "narrow",
        label: "Homi mobile dashboard",
      },
    ],
  };
}
