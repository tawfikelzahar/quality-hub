import type { MetadataRoute } from "next";
import { SITE, SITE_TITLE } from '@/lib/site'

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Same name as the site title, so the app is not boxed into statistics only
    name: SITE_TITLE,
    short_name: SITE.shortName,
    description:
      "Quality engineering platform: SPC and capability, Gage R&R, AQL sampling, DOE, regression and more, with reports that carry your name. Arabic and English.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0A1120",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
