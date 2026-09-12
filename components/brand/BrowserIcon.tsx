import { ImageResponse } from "next/og";

// Frozen Aperture A.2 geometry; the browser-asset contract checks the SVG master.
const aperturePath = "M47 7Q50 5 54 8L79 26L70 42L52 31Q49 29 46 31L30 44Q26 48 29 52L45 69Q49 73 54 70L74 52L85 65L57 87Q49 94 40 86L12 58Q3 49 12 40Z";

export function createBrowserIcon(size: number) {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#f6f3ed" }}>
        <svg width={size} height={size} viewBox="-24 -24 144 144">
          <path fill="#583c63" d={aperturePath} />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
