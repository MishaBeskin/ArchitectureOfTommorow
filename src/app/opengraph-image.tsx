import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

export const alt = SITE_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Default social preview for every page without its own image (project pages use their cover).
 * Text only, so it never depends on fetching an external file.
 */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0f2b4f",
          padding: 80,
        }}
      >
        {/* The site logo, same shapes as app/icon.svg. */}
        <svg width="140" height="140" viewBox="62 63 1130 1130">
          <rect x="62" y="63" width="1130" height="1130" rx="230" fill="#0a2848" />
          <path
            fill="#ffffff"
            d="M146 1010 L525 236 L726 236 L1094 1010 L876 1010 L876 912 L553 285 L417 657 L670 580 L670 650 L440 727 L440 1010 Z"
          />
          <path fill="#2b6cb0" d="M670 580 L716 605 L716 950 L670 928 Z" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.05,
              textTransform: "uppercase",
            }}
          >
            {SITE_NAME}
          </div>
          <div style={{ fontSize: 36, color: "#9cc2f5" }}>
            Architectural concepts and urban visions
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
