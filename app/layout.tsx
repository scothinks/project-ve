import localFont from "next/font/local";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppInstallPrompt } from "@/components/pwa/AppInstallPrompt";
import { PwaBootstrap } from "@/components/pwa/PwaBootstrap";
import { PushEnablePrompt } from "@/components/pwa/PushEnablePrompt";

const geist = localFont({
  src: [
    { path: "./fonts/geist/Geist-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/geist/Geist-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/geist/Geist-Bold.ttf", weight: "700", style: "normal" },
    { path: "./fonts/geist/Geist-Black.ttf", weight: "900", style: "normal" },
  ],
  display: "swap",
  variable: "--font-geist",
});

export const metadata: Metadata = {
  title: "Project VE",
  description: "A learning and rewards MVP for Project VE.",
  manifest: "/manifest.webmanifest",
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
    { media: "(prefers-color-scheme: light)", color: "#fffdfa" },
    { media: "(prefers-color-scheme: dark)", color: "#171c19" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={geist.variable} lang="en">
      <body>
        <PwaBootstrap />
        {children}
        <PushEnablePrompt />
        <AppInstallPrompt />
      </body>
    </html>
  );
}
