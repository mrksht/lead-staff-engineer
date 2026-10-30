/**
 * VERSION 4: Variable Height Virtualization (From Scratch)
 *
 * THE HARD PROBLEM:
 * When items have different heights, you can't use simple division
 * to find which item is at a given scroll offset. You need:
 * 1. A way to estimate heights before rendering
 * 2. A way to measure actual heights after rendering
 * 3. A cache to avoid re-measuring
 * 4. Binary search instead of O(1) index lookup
 *
 * WHAT THIS VERSION DOES:
 * - Estimates item heights based on content
 * - Uses ResizeObserver to measure actual rendered heights
 * - Caches measured heights in a Map (on a ref, not state)
 * - Binary search to find start index from scroll offset
 * - Recalculates positions when measurements change
 *
 * STAFF LESSON: This is where 80% of virtualization complexity lives.
 * If you can constrain your design to fixed heights, do it.
 * If you can't, understand this code before picking a library.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { generateItems, type Item } from "../utils/data";
import { PerformanceOverlay } from "../components/PerformanceOverlay";
import {
  rowStyle,
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
const CONTAINER_HEIGHT = 700;
const OVERSCAN = 5;
// Estimate height from content without rendering
function estimateHeight(item: Item): number {
  const baseHeight = 60; // avatar + name + email
  const descLines = Math.ceil(item.description.length / 60);
  const tagHeight = item.tags.length > 0 ? 28 : 0;
  return baseHeight + descLines * 18 + tagHeight;
}

// --- Measured Row Component ---
function MeasuredRow({
  item,
  index,
  top,
  onMeasure,
}: {
  item: Item;
  index: number;
  top: number;
  onMeasure: (index: number, height: number) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const measuredHeight = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
      onMeasure(index, measuredHeight);
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [index, onMeasure]);

  return (
    <div
      ref={rowRef}
      style={{
        ...rowStyle,
        position: "absolute",
        top,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <img src={item.avatar} alt="" style={avatarStyle} loading="lazy" />
      <div style={contentStyle}>
        <div style={nameStyle}>{item.name}</div>
        <div style={emailStyle}>
          {item.email} · {item.company}
        </div>
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
          background: item.status === "active" ? "#22c55e20" : "#ef444420",
          color: item.status === "active" ? "#22c55e" : "#ef4444",
        }}
      >
        {item.status}
      </span>
    </div>
  );
}

export default function V4VariableHeight() {
  const [items] = useState(() => generateItems(ITEM_COUNT));
  const [scrollTop, setScrollTop] = useState(0);
  const [, forceUpdate] = useState(0); // trigger re-render on measurement
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);

  // Height cache: index → measured height
  // Stored on ref to avoid re-renders on every measurement
  const heightCache = useRef(new Map<number, number>());

  // Get height: measured > estimated
  const getItemHeight = useCallback(
    (index: number) => {
      return heightCache.current.get(index) ?? estimateHeight(items[index]);
    },
    [items]
  );

  // Precompute offsets for all items
  // In production, you'd use a cumulative sum array or a tree structure
  const offsets = useMemo(() => {
    const result = new Float64Array(items.length);
    result[0] = 0;
    for (let i = 1; i < items.length; i++) {
      result[i] = result[i - 1] + getItemHeight(i - 1);
    }
    return result;
  }, [items, getItemHeight]);

  const totalHeight = offsets.length > 0
    ? offsets[offsets.length - 1] + getItemHeight(items.length - 1)
    : 0;

  // Binary search: find first item whose offset >= scrollTop
  const findStartIndex = useCallback(
    (offset: number) => {
      let low = 0;
      let high = items.length - 1;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (offsets[mid] < offset) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }
      return Math.max(0, low - 1);
    },
    [items.length, offsets]
  );

  // Find visible range
  const startIndex = Math.max(0, findStartIndex(scrollTop) - OVERSCAN);
  let endIndex = startIndex;
  while (
    endIndex < items.length - 1 &&
    offsets[endIndex] < scrollTop + CONTAINER_HEIGHT
  ) {
    endIndex++;
  }
  endIndex = Math.min(items.length - 1, endIndex + OVERSCAN);

  // Measurement callback
  const handleMeasure = useCallback(
    (index: number, height: number) => {
      const cached = heightCache.current.get(index);
      if (cached !== undefined && Math.abs(cached - height) < 1) return;
      heightCache.current.set(index, height);
      // Debounced re-render: batch measurements within same frame
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        forceUpdate((c) => c + 1);
      });
    },
    []
  );

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollTop(scrollRef.current.scrollTop);
    }
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Build visible items
  const visibleItems: React.ReactNode[] = [];
  for (let i = startIndex; i <= endIndex; i++) {
    visibleItems.push(
      <MeasuredRow
        key={i}
        item={items[i]}
        index={i}
        top={offsets[i]}
        onMeasure={handleMeasure}
      />
    );
  }

  return (
    <div>
      <PerformanceOverlay
        label="V4: Variable Height"
        itemCount={ITEM_COUNT}
      />
      <div style={headerStyle}>
        <h2>V4: Variable Height Virtualization (From Scratch)</h2>
        <p style={subtitleStyle}>
          Each row has different content → different height. Uses binary search
          for index lookup (O(log n) vs O(1)). ResizeObserver measures actual
          heights and caches them.
        </p>
        <div style={statsStyle}>
          <span>Measured items: {heightCache.current.size}</span>
          <span>Rendered: {endIndex - startIndex + 1}</span>
          <span>Total height: {Math.round(totalHeight).toLocaleString()}px</span>
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

const statsStyle: React.CSSProperties = {
  display: "flex",
  gap: 16,
  marginTop: 8,
  fontSize: 12,
  fontFamily: "monospace",
  color: "#7c83ff",
};
