import localFont from "next/font/local";

// Import only in routes that contain an expressive serif passage.
export const displayFont = localFont({
  src: [
    { path: "./source-serif/SourceSerif4.woff2", weight: "200 900", style: "normal" },
    { path: "./source-serif/SourceSerif4-Italic.woff2", weight: "200 900", style: "italic" },
  ],
  display: "swap",
  preload: false,
  variable: "--ui-font-display",
  fallback: ["Project VE Coverage", "Georgia", "serif"],
  adjustFontFallback: false,
});
