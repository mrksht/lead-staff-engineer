/**
 * VERSION 3: Virtualization With Overscan
 *
 * WHAT CHANGED FROM V2:
 * - Renders extra items above/below the viewport (overscan buffer)
 * - Prevents blank space during fast scrolling
 * - Uses useRef for scroll offset to avoid unnecessary re-renders
 * - Introduces requestAnimationFrame throttling on scroll handler
 *
 * STAFF LESSON: Overscan is the first real "engineering tradeoff" in
 * virtualization. More overscan = smoother scrolling but more DOM nodes.
 * The sweet spot depends on scroll behavior (mouse vs. trackpad vs. touch).
 */

import { useState, useRef, useCallback, useEffect } from "react";
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
const ITEM_HEIGHT = 72;
const CONTAINER_HEIGHT = 700;
const OVERSCAN_COUNT = 5; // Render 5 extra items above and below

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

export default function V3WithOverscan() {
  const [items] = useState(() => generateItems(ITEM_COUNT));
  const [scrollTop, setScrollTop] = useState(0);
  const rafRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- Throttled scroll handler using rAF ---
  // Without this, fast scrolling fires 100+ scroll events per second,
  // each triggering setState → re-render. rAF caps it at ~60/sec.
  const handleScroll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      if (scrollRef.current) {
        setScrollTop(scrollRef.current.scrollTop);
      }
    });
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // --- Virtualization with overscan ---
  const totalHeight = items.length * ITEM_HEIGHT;
  const rawStart = Math.floor(scrollTop / ITEM_HEIGHT);
  const rawEnd = Math.min(
    items.length - 1,
    Math.floor((scrollTop + CONTAINER_HEIGHT) / ITEM_HEIGHT)
  );

  // Apply overscan: render extra items outside viewport
  const startIndex = Math.max(0, rawStart - OVERSCAN_COUNT);
  const endIndex = Math.min(items.length - 1, rawEnd + OVERSCAN_COUNT);

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

  const renderedCount = endIndex - startIndex + 1;
  const visibleCount = rawEnd - rawStart + 1;

  return (
    <div>
      <PerformanceOverlay
        label="V3: With Overscan"
        itemCount={ITEM_COUNT}
      />
      <div style={headerStyle}>
        <h2>V3: Virtualization + Overscan</h2>
        <p style={subtitleStyle}>
          Rendering {renderedCount} items ({visibleCount} visible +{" "}
          {renderedCount - visibleCount} overscan buffer). Scroll fast — no
          blank space flashes.
        </p>
        <div style={diagramStyle}>
          <pre>{`
  ┌──────────────────────────┐
  │  ${OVERSCAN_COUNT} overscan items (above) │  ← in DOM, not visible
  ├──────────────────────────┤
  │                          │
  │  ${visibleCount} visible items         │  ← what user sees
  │                          │
  ├──────────────────────────┤
  │  ${OVERSCAN_COUNT} overscan items (below) │  ← in DOM, not visible
  └──────────────────────────┘
          `}</pre>
        </div>
      </div>

      <div
        ref={scrollRef}
        style={{
          height: CONTAINER_HEIGHT,
          overflow: "auto",
          position: "relative",
          border: "1px solid #e5e7eb",
          margin: "0 24px",
        }}
        onScroll={handleScroll}
      >
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

const diagramStyle: React.CSSProperties = {
  fontSize: 11,
  fontFamily: "monospace",
  background: "#f8f8ff",
  padding: "4px 10px",
  borderRadius: 4,
  marginTop: 8,
  color: "#7c83ff",
  lineHeight: 1.3,
};
