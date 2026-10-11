import { ImageResponse } from "next/og";

// Shared preview image for every page. Brand mark and product line only:
// no people, no hotel or guest data. Uses next/og's bundled font, so it
// needs no network and is generated once at build time.
export const alt = "Seedha. Know what each booking channel really leaves your hotel.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PINE = "#1E6B4E";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: "#0B0F0D",
        color: "#F5F5F7",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 24,
            background: PINE,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 12,
            padding: "0 22px",
          }}
        >
          <div style={{ height: 10, borderRadius: 5, background: "#FFFFFF" }} />
          <div style={{ height: 10, borderRadius: 5, background: "#FFFFFF" }} />
        </div>
        <div style={{ fontSize: 64, fontWeight: 600 }}>Seedha</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 68, fontWeight: 600, lineHeight: 1.1, maxWidth: 980 }}>
          Know what each booking channel really leaves your hotel.
        </div>
        <div style={{ fontSize: 32, color: "#A1A1A6" }}>
          The revenue desk for owner-run hill hotels and homestays.
        </div>
      </div>
    </div>,
    { ...size },
  );
}
