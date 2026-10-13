/**
 * Inline SVG line icons for the 40 amenities and the ways to reach a hotel
 * (shapes in lib/amenityIcons.ts). One colour (currentColor), decorative
 * only: the label next to each icon is the accessible text.
 */
import type { AmenityId } from "@/lib/amenities";
import { AMENITY_ICONS, REACH_ICONS } from "@/lib/amenityIcons";
import type { IconShape } from "@/lib/amenityIcons";

function Svg({ shapes, className }: { shapes: readonly IconShape[]; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {shapes.map((shape, i) =>
        "d" in shape ? (
          <path key={i} d={shape.d} />
        ) : "cx" in shape ? (
          <circle
            key={i}
            cx={shape.cx}
            cy={shape.cy}
            r={shape.r}
            {...(shape.fill ? { fill: "currentColor", stroke: "none" } : {})}
          />
        ) : (
          <rect key={i} x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.rx} />
        ),
      )}
    </svg>
  );
}

/** The icon for one of the 40 amenities. */
export function AmenityIcon({ id, className }: { id: AmenityId; className?: string }) {
  return <Svg shapes={AMENITY_ICONS[id]} className={className} />;
}

/** The icon for a way to reach the hotel. */
export function ReachIcon({ mode, className }: { mode: "road" | "rail" | "air"; className?: string }) {
  return <Svg shapes={REACH_ICONS[mode]} className={className} />;
}
