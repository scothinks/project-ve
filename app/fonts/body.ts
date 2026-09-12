import localFont from "next/font/local";

export const bodyFont = localFont({
  src: [
    { path: "./source-sans/SourceSans3.woff2", weight: "200 900", style: "normal" },
    { path: "./source-sans/SourceSans3-Italic.woff2", weight: "200 900", style: "italic" },
  ],
  display: "swap",
  preload: false,
  variable: "--ui-font-body",
  fallback: ["Project VE Coverage", "Arial", "sans-serif"],
  adjustFontFallback: false,
});
