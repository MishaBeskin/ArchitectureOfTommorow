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
          background: "#fafaf9",
          padding: 80,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
          {[90, 160, 120].map((height, i) => (
            <div key={i} style={{ width: 48, height, background: "#9a3412" }} />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 96, fontWeight: 700, color: "#1c1917", lineHeight: 1.05 }}>{SITE_NAME}</div>
          <div style={{ fontSize: 36, color: "#57534e" }}>A showcase of new architecture projects</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
