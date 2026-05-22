import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fffdfa",
        }}
      >
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: 36,
            background: "#087f5b",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 64,
            fontWeight: 800,
            letterSpacing: 0,
          }}
        >
          VE
        </div>
      </div>
    ),
    size,
  );
}

