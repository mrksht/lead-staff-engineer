/**
 * VERSION 5: react-window v2 — The Industry Standard (Updated API)
 *
 * react-window v2 CHANGED ITS API significantly:
 * - FixedSizeList/VariableSizeList → single `List` component
 * - Children render function → `rowComponent` + `rowProps`
 * - Built-in `useDynamicRowHeight` hook for variable heights
 * - Built-in ARIA attributes (aria-posinset, aria-setsize, role="listitem")
 *
 * STAFF LESSON: This is why you pin major versions and read changelogs.
 * The v1→v2 migration changed every consumer's code.
 */

import { useState, useCallback, type ReactElement } from "react";
import { List, useDynamicRowHeight, type RowComponentProps } from "react-window";
import { generateItems, type Item } from "../utils/data";
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
const FIXED_ITEM_HEIGHT = 72;

// --- react-window v2 pattern: rowComponent with typed rowProps ---

// Define the custom props your row needs (passed via rowProps)
interface RowData {
  items: Item[];
}

// react-window v2: rowComponent receives RowComponentProps<RowData>
// which includes { index, style, ariaAttributes, ...yourRowProps }
function FixedRow({
  index,
  style,
  items,
}: RowComponentProps<RowData>): ReactElement | null {
  const item = items[index];
  return (
    <div
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        borderBottom: "1px solid #f0f0f0",
        gap: 12,
        boxSizing: "border-box",
      }}
    >
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

// Variable-height row with full content
function VariableRow({
  index,
  style,
  items,
}: RowComponentProps<RowData>): ReactElement | null {
  const item = items[index];
  return (
    <div
      style={{
        ...style,
        display: "flex",
        alignItems: "flex-start",
        padding: "12px 16px",
        borderBottom: "1px solid #f0f0f0",
        gap: 12,
        boxSizing: "border-box",
      }}
    >
      <img src={item.avatar} alt="" style={avatarStyle} loading="lazy" />
      <div style={contentStyle}>
        <div style={nameStyle}>{item.name}</div>
        <div style={emailStyle}>{item.email}</div>
        <div style={descStyle}>{item.description}</div>
        <div style={tagContainerStyle}>
          {item.tags.map((tag: string) => (
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

export default function V5ReactWindow() {
  const [items] = useState(() => generateItems(ITEM_COUNT));
  const [mode, setMode] = useState<"fixed" | "variable">("fixed");

  // v2's built-in dynamic row height hook
  const dynamicRowHeight = useDynamicRowHeight({
    defaultRowHeight: 100,
    key: mode, // reset when mode changes
  });

  // For variable sizes: compute height from data
  const getItemSize = useCallback(
    (index: number) => {
      const item = items[index];
      const baseHeight = 60;
      const descLines = Math.ceil(item.description.length / 70);
      const tagHeight = item.tags.length > 0 ? 30 : 0;
      return baseHeight + descLines * 20 + tagHeight;
    },
    [items]
  );

  // rowProps must be referentially stable for memo to work
  const rowProps: RowData = { items };

  return (
    <div>
      <PerformanceOverlay
        label={`V5: react-window v2 (${mode})`}
        itemCount={ITEM_COUNT}
      />
      <div style={headerStyle}>
        <h2>V5: react-window v2</h2>
        <p style={subtitleStyle}>
          Industry-standard library (v2 API). Single `List` component with
          `rowComponent` pattern. Toggle between fixed and variable height.
        </p>
        <div style={toggleStyle}>
          <button
            onClick={() => setMode("fixed")}
            style={mode === "fixed" ? activeBtnStyle : btnStyle}
          >
            Fixed Height
          </button>
          <button
            onClick={() => setMode("variable")}
            style={mode === "variable" ? activeBtnStyle : btnStyle}
          >
            Variable Height (function)
          </button>
        </div>

        <div style={codeBlockStyle}>
          {mode === "fixed"
            ? `// react-window v2: single List component
<List
  rowCount={${ITEM_COUNT}}
  rowHeight={${FIXED_ITEM_HEIGHT}}       // constant number → fixed height
  rowComponent={FixedRow}    // receives { index, style, ...rowProps }
  rowProps={{ items }}        // your custom data
  overscanCount={5}
  style={{ height: 600 }}
/>`
            : `// Variable height via function
<List
  rowCount={${ITEM_COUNT}}
  rowHeight={getItemSize}     // (index) => number
  rowComponent={VariableRow}
  rowProps={{ items }}
  overscanCount={5}
  style={{ height: 600 }}
/>

// Or use useDynamicRowHeight() for auto-measurement`}
        </div>
      </div>

      <div style={{ margin: "0 24px" }}>
        {mode === "fixed" ? (
          <List<RowData>
            rowCount={items.length}
            rowHeight={FIXED_ITEM_HEIGHT}
            rowComponent={FixedRow}
            rowProps={rowProps}
            overscanCount={5}
            style={{ height: 600 }}
          />
        ) : (
          <List<RowData>
            rowCount={items.length}
            rowHeight={getItemSize}
            rowComponent={VariableRow}
            rowProps={rowProps}
            overscanCount={5}
            style={{ height: 600 }}
          />
        )}
      </div>

      {/* Hidden: show the dynamic hook exists */}
      <div style={{ display: "none" }}>
        {/* useDynamicRowHeight is available for auto-measured cases */}
        {JSON.stringify(dynamicRowHeight.getAverageRowHeight())}
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
