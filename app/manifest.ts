import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Homi — Your home, remembered",
    short_name: "Homi",
    description: "A private home maintenance journal.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f5f6f1",
    theme_color: "#1d6a4e",
    categories: ["lifestyle", "productivity"],
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}

