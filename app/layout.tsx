import { WelcomeProgressSync } from "@/components/entry/WelcomeProgressSync";
import { bodyFont } from "./fonts/body";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppInstallPrompt } from "@/components/pwa/AppInstallPrompt";
import { PwaBootstrap } from "@/components/pwa/PwaBootstrap";
import { PushEnablePrompt } from "@/components/pwa/PushEnablePrompt";

export const metadata: Metadata = {
  title: "Project VE",
  description: "A learning and rewards MVP for Project VE.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: { url: "/brand/aperture-a2-32.png", sizes: "32x32", type: "image/png" },
    apple: { url: "/brand/aperture-a2-180.png", sizes: "180x180", type: "image/png" },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Project VE",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f3ed" },
    { media: "(prefers-color-scheme: dark)", color: "#201c23" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={bodyFont.variable} lang="en">
      <body>
        <PwaBootstrap />
        <WelcomeProgressSync />
        {children}
        <PushEnablePrompt />
        <AppInstallPrompt />
      </body>
    </html>
  );
}
