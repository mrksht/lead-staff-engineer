import { useState, Suspense, lazy } from "react";

// Lazy load each version so switching doesn't load all at once
const V1 = lazy(() => import("./versions/V1NaiveList"));
const V2 = lazy(() => import("./versions/V2BasicVirtualization"));
const V3 = lazy(() => import("./versions/V3WithOverscan"));
const V4 = lazy(() => import("./versions/V4VariableHeight"));
const V5 = lazy(() => import("./versions/V5ReactWindow"));
const V6 = lazy(() => import("./versions/V6TanStackVirtual"));
const V7 = lazy(() => import("./versions/V7InfiniteScroll"));
const V8 = lazy(() => import("./versions/V8ProductionGrade"));

const versions = [
  {
    id: "v1",
    label: "V1: Naive",
    desc: "No virtualization",
    component: V1,
    risk: "high",
  },
  {
    id: "v2",
    label: "V2: Basic Virtual",
    desc: "Fixed height, from scratch",
    component: V2,
    risk: "medium",
  },
  {
    id: "v3",
    label: "V3: + Overscan",
    desc: "Buffered rendering",
    component: V3,
    risk: "medium",
  },
  {
    id: "v4",
    label: "V4: Variable Height",
    desc: "Dynamic measurement",
    component: V4,
    risk: "medium",
  },
  {
    id: "v5",
    label: "V5: react-window",
    desc: "Industry standard lib",
    component: V5,
    risk: "low",
  },
  {
    id: "v6",
    label: "V6: @tanstack/virtual",
    desc: "Headless, modern",
    component: V6,
    risk: "low",
  },
  {
    id: "v7",
    label: "V7: Infinite Scroll",
    desc: "Paginated fetching",
    component: V7,
    risk: "low",
  },
  {
    id: "v8",
    label: "V8: Production",
    desc: "A11y, adaptive, resilient",
    component: V8,
    risk: "none",
  },
] as const;

export default function App() {
  const [activeVersion, setActiveVersion] = useState("v1");

  const active = versions.find((v) => v.id === activeVersion)!;
  const ActiveComponent = active.component;

  return (
    <div style={appStyle}>
      {/* Sidebar navigation */}
      <nav style={sidebarStyle}>
        <div style={logoStyle}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Virtualization</div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
            Deep Dive: V1 → V8
          </div>
        </div>

        {versions.map((v) => (
          <button
            key={v.id}
            onClick={() => setActiveVersion(v.id)}
            style={{
              ...navBtnStyle,
              ...(activeVersion === v.id ? navBtnActiveStyle : {}),
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  ...dotStyle,
                  background:
                    v.risk === "high"
                      ? "#ef4444"
                      : v.risk === "medium"
                      ? "#facc15"
                      : v.risk === "low"
                      ? "#4ade80"
                      : "#3b82f6",
                }}
              />
              <span style={{ fontWeight: 600, fontSize: 13 }}>{v.label}</span>
            </div>
            <div
              style={{ fontSize: 11, color: "#888", marginTop: 2, marginLeft: 20 }}
            >
              {v.desc}
            </div>
          </button>
        ))}

        <div style={legendStyle}>
          <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 11 }}>
            PERF RISK
          </div>
          <div style={legendItemStyle}>
            <span style={{ ...dotStyle, background: "#ef4444" }} />
            High — will cause jank
          </div>
          <div style={legendItemStyle}>
            <span style={{ ...dotStyle, background: "#facc15" }} />
            Medium — works but fragile
          </div>
          <div style={legendItemStyle}>
            <span style={{ ...dotStyle, background: "#4ade80" }} />
            Low — library handles it
          </div>
          <div style={legendItemStyle}>
            <span style={{ ...dotStyle, background: "#3b82f6" }} />
            Production ready
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main style={mainStyle}>
        <Suspense
          fallback={
            <div style={loadingStyle}>Loading {active.label}...</div>
          }
        >
          <ActiveComponent />
        </Suspense>
      </main>
    </div>
  );
}

const appStyle: React.CSSProperties = {
  display: "flex",
  height: "100vh",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  background: "#f8fafc",
};

const sidebarStyle: React.CSSProperties = {
  width: 260,
  background: "#fff",
  borderRight: "1px solid #e5e7eb",
  display: "flex",
  flexDirection: "column",
  overflow: "auto",
  flexShrink: 0,
};

const logoStyle: React.CSSProperties = {
  padding: "20px 16px 16px",
  borderBottom: "1px solid #e5e7eb",
};

const navBtnStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "10px 16px",
  border: "none",
  borderBottom: "1px solid #f0f0f0",
  background: "transparent",
  cursor: "pointer",
  transition: "background 0.15s",
};

const navBtnActiveStyle: React.CSSProperties = {
  background: "#eef2ff",
  borderLeft: "3px solid #4f46e5",
};

const dotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  display: "inline-block",
  flexShrink: 0,
};

const legendStyle: React.CSSProperties = {
  padding: "16px",
  marginTop: "auto",
  borderTop: "1px solid #e5e7eb",
  fontSize: 11,
  color: "#666",
};

const legendItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginTop: 4,
};

const mainStyle: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
};

const loadingStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  fontSize: 16,
  color: "#888",
};
