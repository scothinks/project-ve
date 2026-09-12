import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Project VE",
    short_name: "Project VE",
    description: "Project VE learning and rewards app.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f3ed",
    theme_color: "#f6f3ed",
    icons: [
      {
        src: "/brand/aperture-a2-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/aperture-a2-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/brand/aperture-a2-180.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
