import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
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
            width: 380,
            height: 380,
            borderRadius: 88,
            background: "#087f5b",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 180,
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

