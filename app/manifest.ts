import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Quality Hub — Statistical Quality Engineering Tools",
    short_name: "Quality Hub",
    description:
      "SPC control charts, Pareto analysis, DPMO, AQL sampling, Gage R&R, and more — statistical quality engineering tools online.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0fd4c8",
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
