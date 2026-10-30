import { useFPSCounter, useRenderMetrics } from "../hooks/usePerformance";

interface Props {
  label: string;
  itemCount: number;
  onScrollStart?: () => void;
  onScrollEnd?: () => void;
}

export function PerformanceOverlay({ label, itemCount }: Props) {
  const metrics = useRenderMetrics(label);
  const { fps, start, stop } = useFPSCounter();

  return (
    <div style={overlayStyle}>
      <div style={titleStyle}>{label}</div>
      <div style={gridStyle}>
        <span style={labelStyle}>Initial Render:</span>
        <span style={getValueStyle(metrics.renderTime, 100, 500)}>
          {metrics.renderTime}ms
        </span>

        <span style={labelStyle}>DOM Nodes:</span>
        <span style={getValueStyle(metrics.domNodes, 1000, 5000)}>
          {metrics.domNodes.toLocaleString()}
        </span>

        <span style={labelStyle}>Heap (MB):</span>
        <span>{metrics.heapUsed || "N/A"}</span>

        <span style={labelStyle}>Items:</span>
        <span>{itemCount.toLocaleString()}</span>

        <span style={labelStyle}>Scroll FPS:</span>
        <span style={getValueStyle(120 - fps, 0, 30)}>{fps}</span>
      </div>
      <div style={buttonRowStyle}>
        <button onClick={start} style={btnStyle}>
          Start FPS
        </button>
        <button onClick={stop} style={btnStyle}>
          Stop FPS
        </button>
      </div>
    </div>
  );
}

// --- Styles ---

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 12,
  right: 12,
  background: "#1a1a2e",
  color: "#e0e0e0",
  padding: "12px 16px",
  borderRadius: 8,
  fontSize: 13,
  fontFamily: "monospace",
  zIndex: 9999,
  minWidth: 220,
  boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
  border: "1px solid #333",
};

const titleStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 14,
  marginBottom: 8,
  color: "#7c83ff",
  borderBottom: "1px solid #333",
  paddingBottom: 6,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto auto",
  gap: "4px 12px",
};

const labelStyle: React.CSSProperties = { color: "#888" };

function getValueStyle(
  value: number,
  warnThreshold: number,
  dangerThreshold: number
): React.CSSProperties {
  let color = "#4ade80"; // green
  if (value > dangerThreshold) color = "#ef4444"; // red
  else if (value > warnThreshold) color = "#facc15"; // yellow
  return { color, fontWeight: 600 };
}

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 8,
};

const btnStyle: React.CSSProperties = {
  flex: 1,
  padding: "4px 8px",
  fontSize: 11,
  background: "#333",
  color: "#ccc",
  border: "1px solid #555",
  borderRadius: 4,
  cursor: "pointer",
};
