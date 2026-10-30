import { useState } from "react";
import { eventLoopExamples } from "./examples.js";
import { deriveState } from "./replay.js";

// Five small pieces, one file — each is only ever used here, so separate
// files would just be indirection for indirection's sake.

function CodePanel({ code, activeLine }) {
  const lines = code.split("\n");
  return (
    <pre className="el-code">
      {lines.map((line, i) => (
        <div key={i} className={"el-code-line" + (i + 1 === activeLine ? " active" : "")}>
          <span className="el-code-line-num">{i + 1}</span>
          {line}
        </div>
      ))}
    </pre>
  );
}

function StackPanel({ title, items, empty }) {
  // Newest item last in the array, but should render on TOP visually —
  // reverse just for display, the underlying array order is untouched.
  const display = [...items].reverse();
  return (
    <div className="el-panel">
      <div className="el-panel-title">{title}</div>
      <div className="el-panel-body el-stack">
        {display.length === 0 && <div className="el-empty">{empty}</div>}
        {display.map((label, i) => (
          <div key={i} className="el-chip el-stack-chip">{label}</div>
        ))}
      </div>
    </div>
  );
}

function QueuePanel({ title, items, empty }) {
  // Front of queue (index 0) renders first — FIFO reads left to right.
  return (
    <div className="el-panel">
      <div className="el-panel-title">{title}</div>
      <div className="el-panel-body el-queue">
        {items.length === 0 && <div className="el-empty">{empty}</div>}
        {items.map((label, i) => (
          <div key={i} className="el-chip el-queue-chip">{label}</div>
        ))}
      </div>
    </div>
  );
}

function ConsolePanel({ lines }) {
  return (
    <div className="el-panel">
      <div className="el-panel-title">Console Output</div>
      <div className="el-panel-body console-surface">
        {lines.length === 0 && <div className="console-hint">(nothing printed yet)</div>}
        {lines.map((text, i) => (
          <div key={i} className="console-line console-log">{text}</div>
        ))}
      </div>
    </div>
  );
}

export default function EventLoopVisualizer() {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const example = eventLoopExamples[exampleIndex];
  const step = example.steps[stepIndex];
  const state = deriveState(example.steps, stepIndex);

  function selectExample(i) {
    setExampleIndex(i);
    setStepIndex(0);
  }

  return (
    <div className="el-app">
      <div className="el-header">
        <select
          className="el-example-select"
          value={exampleIndex}
          onChange={(e) => selectExample(Number(e.target.value))}
        >
          {eventLoopExamples.map((ex, i) => (
            <option key={ex.id} value={i}>{ex.title}</option>
          ))}
        </select>
      </div>

      <div className="el-caption">{step.caption}</div>

      <div className="el-grid">
        <CodePanel code={example.code} activeLine={step.line} />
        <div className="el-panels">
          <StackPanel title="Call Stack" items={state.call} empty="empty" />
          <ConsolePanel lines={state.console} />
          <QueuePanel title="Microtask Queue" items={state.microtask} empty="empty" />
          <QueuePanel title="Macrotask Queue" items={state.macrotask} empty="empty" />
        </div>
      </div>

      <div className="el-controls">
        <button
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
        >
          ← Prev
        </button>
        <span className="el-step-counter">
          Step {stepIndex + 1} / {example.steps.length}
        </span>
        <button
          disabled={stepIndex === example.steps.length - 1}
          onClick={() => setStepIndex((i) => Math.min(example.steps.length - 1, i + 1))}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
