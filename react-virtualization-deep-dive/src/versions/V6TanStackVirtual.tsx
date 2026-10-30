/**
 * VERSION 6: @tanstack/react-virtual — Headless Virtualization
 *
 * WHY THIS IS THE MODERN CHOICE:
 * - Headless: provides the math, you own the DOM
 * - Framework-agnostic core (works in React, Vue, Solid, Svelte)
 * - Built-in dynamic measurement via measureElement
 * - No CSS opinions — you control every pixel
 *
 * KEY DIFFERENCE FROM react-window:
 * react-window gives you a component that renders a scrollable container.
 * @tanstack/virtual gives you a hook that returns positioning data —
 * you render whatever DOM you want.
 *
 * STAFF LESSON: This is the architecture you should push for in a
 * design system. The virtualization logic is separated from the
 * rendering. Your <List> component wraps the hook.
 */

import { useState, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { generateItems } from "../utils/data";
import { PerformanceOverlay } from "../components/PerformanceOverlay";
import {
  avatarStyle,
  contentStyle,
  nameStyle,
  emailStyle,
  descStyle,
  tagContainerStyle,
  tagStyle,
  statusStyle,
} from "./V1NaiveList";

const ITEM_COUNT = 10_000;
const CONTAINER_HEIGHT = 600;

export default function V6TanStackVirtual() {
  const [items] = useState(() => generateItems(ITEM_COUNT));
  const [dynamicMode, setDynamicMode] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    // In fixed mode: constant size. In dynamic mode: estimate + measure.
    estimateSize: useCallback(() => (dynamicMode ? 100 : 72), [dynamicMode]),
    overscan: 5,
    // Enable dynamic measurement
    ...(dynamicMode && {
      measureElement: (el: Element) => {
        // This is called by the virtualizer to measure actual DOM height
        // It uses ResizeObserver internally
        return el.getBoundingClientRect().height;
      },
    }),
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div>
      <PerformanceOverlay
        label={`V6: @tanstack/virtual ${dynamicMode ? "(dynamic)" : "(fixed)"}`}
        itemCount={ITEM_COUNT}
      />
      <div style={headerStyle}>
        <h2>V6: @tanstack/react-virtual (Headless)</h2>
        <p style={subtitleStyle}>
          The hook returns positioning data. You render the DOM. Toggle dynamic
          mode to see auto-measurement with measureElement.
        </p>

        <div style={toggleStyle}>
          <button
            onClick={() => setDynamicMode(false)}
            style={!dynamicMode ? activeBtnStyle : btnStyle}
          >
            Fixed Size (72px)
          </button>
          <button
            onClick={() => setDynamicMode(true)}
            style={dynamicMode ? activeBtnStyle : btnStyle}
          >
            Dynamic (measured)
          </button>
        </div>

        <div style={codeBlockStyle}>
          {`const rowVirtualizer = useVirtualizer({
  count: ${ITEM_COUNT},
  getScrollElement: () => parentRef.current,
  estimateSize: () => ${dynamicMode ? "100" : "72"},
  overscan: 5,${dynamicMode ? `
  measureElement: (el) => el.getBoundingClientRect().height,` : ""}
});

// virtualItems = [ { index, start, size, key }, ... ]
// Total size = ${rowVirtualizer.getTotalSize()}px
// Rendered items = ${virtualItems.length}`}
        </div>
      </div>

      {/* THE KEY PATTERN: You own the entire DOM structure */}
      <div
        ref={parentRef}
        style={{
          height: CONTAINER_HEIGHT,
          overflow: "auto",
          margin: "0 24px",
          border: "1px solid #e5e7eb",
        }}
      >
        {/* Inner container with total height for scrollbar */}
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {virtualItems.map((virtualRow) => {
            const item = items[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                // This ref is what enables dynamic measurement
                ref={dynamicMode ? rowVirtualizer.measureElement : undefined}
                data-index={virtualRow.index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  // Use transform instead of top for better perf
                  // (compositor layer, avoids layout recalc)
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: dynamicMode ? "flex-start" : "center",
                    padding: dynamicMode ? "12px 16px" : "0 16px",
                    height: dynamicMode ? "auto" : 72,
                    borderBottom: "1px solid #f0f0f0",
                    gap: 12,
                    boxSizing: "border-box",
                    background: "#fff",
                  }}
                >
                  <img
                    src={item.avatar}
                    alt=""
                    style={avatarStyle}
                    loading="lazy"
                  />
                  <div style={contentStyle}>
                    <div style={nameStyle}>{item.name}</div>
                    <div style={emailStyle}>
                      {item.email} · {item.company}
                    </div>
                    {dynamicMode && (
                      <>
                        <div style={descStyle}>{item.description}</div>
                        <div style={tagContainerStyle}>
                          {item.tags.map((tag) => (
                            <span key={tag} style={tagStyle}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <span
                    style={{
                      ...statusStyle,
                      background:
                        item.status === "active" ? "#22c55e20" : "#ef444420",
                      color:
                        item.status === "active" ? "#22c55e" : "#ef4444",
                    }}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            );
          })}
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
const toggleStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 10,
};
const btnStyle: React.CSSProperties = {
  padding: "6px 14px",
  fontSize: 13,
  border: "1px solid #ddd",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  color: "#555",
};
const activeBtnStyle: React.CSSProperties = {
  ...btnStyle,
  background: "#4f46e5",
  color: "#fff",
  borderColor: "#4f46e5",
};
const codeBlockStyle: React.CSSProperties = {
  marginTop: 10,
  padding: "10px 14px",
  background: "#1a1a2e",
  color: "#a5b4fc",
  borderRadius: 6,
  fontFamily: "monospace",
  fontSize: 12,
  lineHeight: 1.5,
  whiteSpace: "pre",
  overflow: "auto",
};
