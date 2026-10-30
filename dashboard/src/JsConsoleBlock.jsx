import { useEffect, useRef, useState } from "react";
import { LiveProvider, LiveEditor } from "react-live";

// Plain JS fundamentals snippets aren't React components — there's no JSX to
// render, and event-loop/timing demos need REAL setTimeout/Promise ordering,
// not react-live's synchronous one-shot eval. So: reuse react-live's editor
// purely for the nice syntax-highlighted textarea (via a no-op transformCode
// so react-live never actually executes what you type), and run the code
// ourselves with `new Function` + a fake console we fully control, on an
// explicit Run click — matching how you'd actually explore event-loop
// ordering (type it, run it, read the order).
const noopTransform = () => "";

function formatArg(v) {
  // Array.prototype.join() (used below to space-join a console.log's
  // args) silently turns `undefined`/`null` into "" — that's a real console
  // mock bug, not JS behavior, so it needs an explicit early return here.
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  if (typeof v === "string") return v;
  if (typeof v === "function") return `[Function: ${v.name || "anonymous"}]`;
  if (v instanceof Error) return v.stack || String(v);
  try {
    // JSON.stringify silently drops function-valued properties — replace
    // them instead, so objects holding methods don't look empty.
    return JSON.stringify(
      v,
      (_k, val) =>
        typeof val === "function" ? `[Function: ${val.name || "anonymous"}]` : val,
      2
    );
  } catch {
    return String(v);
  }
}

export default function JsConsoleBlock({ code }) {
  const [source, setSource] = useState(code.trim());
  const [logs, setLogs] = useState([]);
  const [hasRun, setHasRun] = useState(false);
  const runIdRef = useRef(0);

  // Stale runs (leftover setTimeout/Promise callbacks from a previous Run,
  // or from before the component unmounts) must not write into the log —
  // ponytail: no timer cancellation, just ignore output tagged with an old
  // run id. Good enough for a local practice tool.
  useEffect(() => () => { runIdRef.current += 1; }, []);

  function run() {
    runIdRef.current += 1;
    const myRun = runIdRef.current;
    setLogs([]);
    setHasRun(true);

    const push = (type) => (...args) => {
      if (runIdRef.current !== myRun) return;
      setLogs((prev) => [
        ...prev,
        { type, text: args.map(formatArg).join(" ") },
      ]);
    };
    const fakeConsole = {
      log: push("log"),
      info: push("log"),
      warn: push("warn"),
      error: push("error"),
    };

    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function("console", source);
      fn(fakeConsole);
    } catch (err) {
      push("error")(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <LiveProvider code={source} onChange={setSource} transformCode={noopTransform} noInline>
      <div className="live-block js-block">
        <div className="live-editor-pane">
          <div className="live-pane-label">
            Edit &amp; run
            <span className="pane-actions">
              {source !== code.trim() && (
                <button className="reset-btn" onClick={() => setSource(code.trim())}>
                  Reset
                </button>
              )}
              <button className="run-btn" onClick={run}>
                ▶ Run
              </button>
            </span>
          </div>
          <LiveEditor />
        </div>
        <div className="live-preview-pane">
          <div className="live-pane-label">Console output</div>
          <div className="console-surface">
            {!hasRun && <div className="console-hint">Press ▶ Run to execute.</div>}
            {hasRun && logs.length === 0 && (
              <div className="console-hint">Ran with no console output.</div>
            )}
            {logs.map((l, i) => (
              <div key={i} className={`console-line console-${l.type}`}>
                {l.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </LiveProvider>
  );
}
