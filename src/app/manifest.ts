import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/brand";

// Lets people install the app on their phone's home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: "Roda",
    description: "CRM com distribuição automática de leads",
    start_url: "/queue",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0f766e",
    lang: "pt-BR",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
