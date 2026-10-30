/**
 * VERSION 2: Basic Virtualization From Scratch (Fixed Height)
 *
 * WHAT CHANGED:
 * - Only renders items visible in the viewport
 * - Uses absolute positioning within a full-height spacer div
 * - Scroll handler calculates visible range via simple math
 *
 * WHAT'S STILL WRONG:
 * - setState on every scroll event → re-render every frame
 * - No overscan → fast scrolling shows blank space
 * - Fixed height assumption → doesn't handle variable content
 * - No memoization → all visible items re-created each render
 *
 * STAFF LESSON: This is the minimum viable virtualization.
 * Understand this before reaching for a library.
 */

import { useState, useCallback } from "react";
import { generateItems, type Item } from "../utils/data";
import { PerformanceOverlay } from "../components/PerformanceOverlay";
import {
  rowStyle,
  avatarStyle,
  contentStyle,
  nameStyle,
  emailStyle,
  statusStyle,
} from "./V1NaiveList";

const ITEM_COUNT = 10_000;
const ITEM_HEIGHT = 72; // Fixed height per row
const CONTAINER_HEIGHT = 700;

function FixedRow({ item, style }: { item: Item; style: React.CSSProperties }) {
  return (
    <div style={{ ...rowStyle, ...style, height: ITEM_HEIGHT, boxSizing: "border-box" }}>
      <img src={item.avatar} alt="" style={avatarStyle} loading="lazy" />
      <div style={contentStyle}>
        <div style={nameStyle}>{item.name}</div>
        <div style={emailStyle}>
          {item.email} · {item.company}
        </div>
      </div>
      <span
        style={{
          ...statusStyle,
          background: item.status === "active" ? "#22c55e20" : "#ef444420",
          color: item.status === "active" ? "#22c55e" : "#ef4444",
        }}
      >
        {item.status}
      </span>
    </div>
  );
}

export default function V2BasicVirtualization() {
  const [items] = useState(() => generateItems(ITEM_COUNT));
  const [scrollTop, setScrollTop] = useState(0);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // --- Core virtualization math ---
  const totalHeight = items.length * ITEM_HEIGHT;
  const startIndex = Math.floor(scrollTop / ITEM_HEIGHT);
  const endIndex = Math.min(
    items.length - 1,
    Math.floor((scrollTop + CONTAINER_HEIGHT) / ITEM_HEIGHT)
  );

  // Build only the visible items
  const visibleItems: React.ReactNode[] = [];
  for (let i = startIndex; i <= endIndex; i++) {
    visibleItems.push(
      <FixedRow
        key={i}
        item={items[i]}
        style={{
          position: "absolute",
          top: i * ITEM_HEIGHT,
          width: "100%",
        }}
      />
    );
  }

  return (
    <div>
      <PerformanceOverlay
        label="V2: Basic Virtualization"
        itemCount={ITEM_COUNT}
      />
      <div style={headerStyle}>
        <h2>V2: Basic Virtualization (From Scratch)</h2>
        <p style={subtitleStyle}>
          Fixed height ({ITEM_HEIGHT}px per row). Only{" "}
          {endIndex - startIndex + 1} of {ITEM_COUNT.toLocaleString()} items in
          DOM. Compare DOM node count with V1.
        </p>
        <p style={codeNoteStyle}>
          <strong>The math:</strong> startIndex = floor(scrollTop /{" "}
          {ITEM_HEIGHT}) = {startIndex}, endIndex = min(itemCount,
          floor((scrollTop + containerHeight) / {ITEM_HEIGHT})) = {endIndex}
        </p>
      </div>

      {/* Scroll container */}
      <div
        style={{
          height: CONTAINER_HEIGHT,
          overflow: "auto",
          position: "relative",
          border: "1px solid #e5e7eb",
          margin: "0 24px",
        }}
        onScroll={handleScroll}
      >
        {/* Spacer — creates the correct scrollbar height */}
        <div style={{ height: totalHeight, position: "relative" }}>
          {visibleItems}
        </div>
      </div>
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  padding: "20px 24px 12px",
  borderBottom: "1px solid #e5e7eb",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#666",
  marginTop: 4,
};

const codeNoteStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#7c83ff",
  marginTop: 6,
  fontFamily: "monospace",
  background: "#f8f8ff",
  padding: "6px 10px",
  borderRadius: 4,
};
