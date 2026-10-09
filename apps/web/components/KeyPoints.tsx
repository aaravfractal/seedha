"use client";

import { useState } from "react";

/** The page's key points, switchable between English and Hindi (Hinglish). */
export function KeyPoints({ points }: { points: { en: string[]; hi: string[] } }) {
  const [hindi, setHindi] = useState(false);
  const list = hindi ? points.hi : points.en;
  return (
    <div className="card" style={{ margin: "16px 0 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <h2 className="sub-title">{hindi ? "Mukhya baatein" : "Key points"}</h2>
        <button type="button" className="link" style={{ fontSize: 14 }} onClick={() => setHindi(!hindi)}>
          {hindi ? "Show in English" : "Hindi mein dikhao"}
        </button>
      </div>
      <ul lang={hindi ? "hi-Latn" : "en"} style={{ margin: "8px 0 0", paddingLeft: 20, listStyle: "disc" }}>
        {list.map((p) => (
          <li key={p} style={{ margin: "6px 0" }}>
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}
