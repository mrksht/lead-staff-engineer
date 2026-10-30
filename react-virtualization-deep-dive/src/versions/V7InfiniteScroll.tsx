/**
 * VERSION 7: Infinite Scroll with Simulated Data Fetching
 *
 * THE REAL-WORLD PATTERN:
 * Most production lists don't have all data upfront.
 * This combines virtualization with paginated data fetching:
 * - Load 50 items initially
 * - When user scrolls near the bottom, fetch the next page
 * - Show a loading indicator at the bottom
 * - Handle loading/error states
 *
 * WHAT THIS DEMONSTRATES:
 * - Intersection Observer-based trigger (not scroll position math)
 * - Simulated API with artificial delay
 * - Combining pagination state with virtualization
 * - Loader row at the end of the list
 *
 * STAFF LESSON: Infinite scroll + virtualization is the pattern
 * for feeds, search results, and dashboards. The key architecture
 * decision is: where does pagination state live? In this example,
 * it's local. In production, use React Query or SWR.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { type Item } from "../utils/data";
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

const PAGE_SIZE = 50;
const TOTAL_AVAILABLE = 10_000;
const FETCH_DELAY = 600; // Simulated network delay

// Simulated API
async function fetchPage(page: number): Promise<{ items: Item[]; hasMore: boolean }> {
  await new Promise((r) => setTimeout(r, FETCH_DELAY));
  const start = page * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, TOTAL_AVAILABLE);

  const items: Item[] = Array.from({ length: end - start }, (_, i) => {
    const idx = start + i;
    return {
      id: idx,
      name: `User ${idx}`,
      email: `user${idx}@example.com`,
      company: ["Acme", "Globex", "Initech", "Umbrella"][idx % 4],
      description:
        idx % 3 === 0
          ? "A longer description that wraps to multiple lines and tests variable height handling in our virtualized list."
          : "Short bio.",
      status: (["active", "inactive", "pending"] as const)[idx % 3],
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=User${idx}&size=40`,
      tags: ["eng", "design", "product"].slice(0, 1 + (idx % 3)),
    };
  });

  return { items, hasMore: end < TOTAL_AVAILABLE };
}

export default function V7InfiniteScroll() {
  const [items, setItems] = useState<Item[]>([]);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  // Fetch next page
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchPage(page);
      setItems((prev) => [...prev, ...result.items]);
      setHasMore(result.hasMore);
      setPage((p) => p + 1);
    } catch {
      setError("Failed to load. Scroll to retry.");
    } finally {
      setIsLoading(false);
    }
  }, [page, isLoading, hasMore]);

  // Initial load
  useEffect(() => {
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Total count includes a "loader" row at the end
  const totalCount = hasMore ? items.length + 1 : items.length;

  const rowVirtualizer = useVirtualizer({
    count: totalCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  // Trigger fetch when last virtual item is the loader row
  useEffect(() => {
    const lastItem = virtualItems.at(-1);
    if (!lastItem) return;
    if (lastItem.index >= items.length - 1 && hasMore && !isLoading) {
      loadMore();
    }
  }, [virtualItems, items.length, hasMore, isLoading, loadMore]);

  return (
    <div>
      <PerformanceOverlay
        label="V7: Infinite Scroll"
        itemCount={items.length}
      />
      <div style={headerStyle}>
        <h2>V7: Infinite Scroll + Virtualization</h2>
        <p style={subtitleStyle}>
          Loaded {items.length.toLocaleString()} of{" "}
          {TOTAL_AVAILABLE.toLocaleString()} items. Fetches {PAGE_SIZE} per page
          with {FETCH_DELAY}ms simulated delay. Scroll to bottom to trigger
          loading.
        </p>
        <div style={codeBlockStyle}>
          {`// The pattern: extend count by 1 for loader row
const totalCount = hasMore ? items.length + 1 : items.length;

// In render: check if index >= items.length → show loader
// In effect: when last virtual item hits loader → fetchNextPage`}
        </div>
      </div>

      <div
        ref={parentRef}
        style={{
          height: 600,
          overflow: "auto",
          margin: "0 24px",
          border: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {virtualItems.map((virtualRow) => {
            const isLoaderRow = virtualRow.index >= items.length;
            const item = items[virtualRow.index];

            return (
              <div
                key={virtualRow.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {isLoaderRow ? (
                  <div style={loaderRowStyle}>
                    {error ? (
                      <span style={{ color: "#ef4444" }}>{error}</span>
                    ) : (
                      <>
                        <div style={spinnerStyle} />
                        <span>
                          Loading page {page + 1}... ({items.length}/
                          {TOTAL_AVAILABLE})
                        </span>
                      </>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      padding: "12px 16px",
                      borderBottom: "1px solid #f0f0f0",
                      gap: 12,
                      height: "100%",
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
                          item.status === "active" ? "#22c55e20" : "#ef444420",
                        color:
                          item.status === "active" ? "#22c55e" : "#ef4444",
                      }}
                    >
                      {item.status}
                    </span>
                  </div>
                )}
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
const loaderRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  height: "100%",
  fontSize: 13,
  color: "#888",
};

const spinnerStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  border: "2px solid #e5e7eb",
  borderTopColor: "#4f46e5",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};
