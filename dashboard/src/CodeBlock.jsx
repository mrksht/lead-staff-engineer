import { useState, useMemo } from "react";
import { LiveProvider, LiveEditor, LiveError, LivePreview } from "react-live";
import { liveScope } from "./liveScope";

const IMPORT_LINE = /^\s*import .*from ['"].*['"];?\s*$/gm;
const COMPONENT_DECL =
  /(?:function|class)\s+([A-Z]\w*)|const\s+([A-Z]\w*)\s*=/g;
// Docs use a bare `{ ... }` or `[...]` to mean "details omitted" — that's
// not valid JS (unlike a real spread, which always has something after the
// dots), so it can never be evaluated. Detect it and skip live-eval instead
// of showing a permanent, unfixable parse error.
const ELLIPSIS_PLACEHOLDER = /\{\s*\.\.\.\s*\}|\[\s*\.\.\.\s*\]/;

// Docs write snippets as plain illustrative components, not runnable
// scripts. Strip imports (hooks come from scope) and, if nothing renders
// anything on its own, auto-append a render() call for the last component
// declared in the block. Best-effort: pseudo-code / server-only snippets
// (Next.js, react-query, react-router) will still show a LiveError instead
// of a preview — that's an honest signal, not a crash.
function prepareCode(raw) {
  const stripped = raw.replace(IMPORT_LINE, "").trim();
  if (/render\s*\(/.test(stripped) || /export default/.test(stripped)) {
    return stripped;
  }
  // Docs consistently declare the main component first (usually "App")
  // and helper/child components after it, so prefer "App" if present,
  // otherwise the first declared component — not the last, which would
  // pick a leaf helper instead of the thing meant to be rendered.
  const declared = [...stripped.matchAll(COMPONENT_DECL)].map(
    (m) => m[1] || m[2]
  );
  const target = declared.includes("App") ? "App" : declared[0];
  if (!target) return stripped;
  return `${stripped}\nrender(<${target} />);`;
}

export default function CodeBlock({ language, code }) {
  const isLive =
    (language === "jsx" || language === "js") &&
    !ELLIPSIS_PLACEHOLDER.test(code);
  const initialCode = useMemo(() => prepareCode(code), [code]);
  const [liveCode, setLiveCode] = useState(initialCode);
  const hasRenderCall = /render\s*\(/.test(liveCode);

  if (!isLive) {
    return (
      <pre className="static-code">
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <LiveProvider code={liveCode} scope={liveScope} noInline>
      <div className="live-block">
        <div className="live-editor-pane">
          <div className="live-pane-label">
            Edit &amp; practice
            {liveCode !== initialCode && (
              <button
                className="reset-btn"
                onClick={() => setLiveCode(initialCode)}
              >
                Reset
              </button>
            )}
          </div>
          <LiveEditor code={liveCode} onChange={setLiveCode} />
        </div>
        <div className="live-preview-pane">
          <div className="live-pane-label">Live preview</div>
          {hasRenderCall ? (
            <>
              <div className="live-preview-surface">
                <LivePreview />
              </div>
              <LiveError className="live-error" />
            </>
          ) : (
            <div className="live-preview-note">
              No UI to preview — this snippet illustrates logic, not a
              component. Add <code>render(&lt;Something /&gt;)</code> to
              try rendering something.
            </div>
          )}
        </div>
      </div>
    </LiveProvider>
  );
}
