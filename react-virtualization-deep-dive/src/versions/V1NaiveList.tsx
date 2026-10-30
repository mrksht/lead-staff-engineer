/**
 * VERSION 1: Naive Rendering — No Virtualization
 *
 * WHY THIS EXISTS:
 * This is the baseline. Renders ALL 10,000 items into the DOM.
 * Open DevTools → Performance tab → scroll. You'll see:
 * - 10,000+ DOM nodes created on mount
 * - Initial render takes 500ms-2s
 * - Scroll FPS drops below 30
 * - Memory usage spikes
 *
 * STAFF LESSON: This is what teams ship when they don't measure.
 * "It works on my machine" with 50 items. Falls apart at 5,000.
 */

import { useState } from "react";
import { generateItems, type Item } from "../utils/data";
import { PerformanceOverlay } from "../components/PerformanceOverlay";

const ITEM_COUNT = 10_000;

function NaiveRow({ item }: { item: Item }) {
  return (
    <div style={rowStyle}>
      <img src={item.avatar} alt="" style={avatarStyle} loading="lazy" />
      <div style={contentStyle}>
        <div style={nameStyle}>{item.name}</div>
        <div style={emailStyle}>{item.email}</div>
        <div style={descStyle}>{item.description}</div>
        <div style={tagContainerStyle}>
          {item.tags.map((tag) => (
            <span key={tag} style={tagStyle}>
              {tag}
            </span>
          ))}
        </div>
      </div>
      <span
        style={{
          ...statusStyle,
          background:
            item.status === "active"
              ? "#22c55e20"
              : item.status === "pending"
              ? "#facc1520"
              : "#ef444420",
          color:
            item.status === "active"
              ? "#22c55e"
              : item.status === "pending"
              ? "#facc15"
              : "#ef4444",
        }}
      >
        {item.status}
      </span>
    </div>
  );
}

export default function V1NaiveList() {
  const [items] = useState(() => generateItems(ITEM_COUNT));

  return (
    <div>
      <PerformanceOverlay label="V1: Naive (No Virtualization)" itemCount={ITEM_COUNT} />
      <div style={headerStyle}>
        <h2>V1: Naive Rendering</h2>
        <p style={subtitleStyle}>
          All {ITEM_COUNT.toLocaleString()} items rendered into the DOM. Watch
          the metrics panel — initial render time and DOM node count are the
          killers.
        </p>
      </div>
      <div style={listContainerStyle}>
        {items.map((item) => (
          <NaiveRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

// --- Shared row styles (reused across versions) ---
export const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  padding: "12px 16px",
  borderBottom: "1px solid #f0f0f0",
  gap: 12,
  background: "#fff",
};

export const avatarStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: "50%",
  flexShrink: 0,
  background: "#e5e7eb",
};

export const contentStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

export const nameStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 14,
  color: "#111",
};

export const emailStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#888",
  marginTop: 2,
};

export const descStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#555",
  marginTop: 4,
  lineHeight: 1.4,
};

export const tagContainerStyle: React.CSSProperties = {
  display: "flex",
  gap: 4,
  marginTop: 6,
  flexWrap: "wrap",
};

export const tagStyle: React.CSSProperties = {
  fontSize: 11,
  padding: "2px 6px",
  borderRadius: 4,
  background: "#eef2ff",
  color: "#4f46e5",
};

export const statusStyle: React.CSSProperties = {
  fontSize: 11,
  padding: "4px 8px",
  borderRadius: 12,
  fontWeight: 600,
  flexShrink: 0,
  marginTop: 2,
};

const headerStyle: React.CSSProperties = {
  padding: "20px 24px 12px",
  borderBottom: "1px solid #e5e7eb",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#666",
  marginTop: 4,
};

const listContainerStyle: React.CSSProperties = {
  height: "calc(100vh - 120px)",
  overflow: "auto",
};
