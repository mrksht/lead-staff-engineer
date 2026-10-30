// Runtime companion to instrument.js. The instrumented code calls into an
// instance of this at every function entry/exit and around every
// setTimeout/.then/queueMicrotask — the REAL browser then runs everything
// for real, in real order, and this just transcribes what happened into the
// exact step shape TracePlayer already knows how to render (see
// examples.js for the shape: action/target/label/caption/line).
//
// Same console-arg formatting as JsConsoleBlock — undefined/null/functions
// need explicit handling or Array.join() silently eats them.
function formatArg(v) {
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  if (typeof v === "string") return v;
  if (typeof v === "function") return `[Function: ${v.name || "anonymous"}]`;
  if (v instanceof Error) return v.message;
  try {
    return JSON.stringify(
      v,
      (_k, val) => (typeof val === "function" ? `[Function: ${val.name || "anonymous"}]` : val),
      2
    );
  } catch {
    return String(v);
  }
}

// Real setTimeout delays would make watching a demo painfully literal (a
// 3000ms timeout would make you wait 3 real seconds). Clamp them, but
// clamping is monotonic so relative ordering between different delays is
// preserved — a 100ms and a 5000ms timer are still 100ms-clamped vs
// 400ms-clamped, so the faster one still fires first.
const MAX_CLAMPED_DELAY = 400;

export function createRecorder() {
  const steps = [];
  let pending = 0; // outstanding enqueued-but-not-yet-run micro/macrotasks
  let idleTimer = null;
  let resolveIdle = null;
  const idlePromise = new Promise((resolve) => { resolveIdle = resolve; });

  function emit(step) {
    steps.push(step);
  }

  function scheduleIdleCheck() {
    if (idleTimer) clearTimeout(idleTimer);
    // Grace window: a callback that just finished might synchronously
    // schedule ANOTHER task in the same tick — wait a beat before declaring
    // "done" so that new work has a chance to register.
    idleTimer = setTimeout(() => {
      if (pending === 0) resolveIdle();
      else scheduleIdleCheck();
    }, 60);
  }

  return {
    steps,

    push(label, line) {
      emit({ action: "push", target: "call", label, caption: `${label} starts running.`, line });
    },
    pop(label) {
      emit({ action: "pop", target: "call", label: null, caption: label ? `${label} returns.` : "Returns.", line: null });
    },

    enqueue(queue, label, line) {
      pending++;
      const kind = queue === "microtask" ? "microtask" : "macrotask";
      emit({ action: "enqueue", target: queue, label, caption: `Scheduled as a ${kind}: ${label}`, line });
    },
    dequeue(queue, label) {
      pending--;
      const kind = queue === "microtask" ? "microtask queue" : "macrotask queue";
      emit({ action: "dequeue", target: queue, label: null, caption: `Front of the ${kind} runs next: ${label}`, line: null });
      scheduleIdleCheck();
    },

    log(...args) {
      const text = args.map(formatArg).join(" ");
      emit({ action: "log", target: "console", label: text, caption: `console.log(${text})`, line: null });
      return undefined;
    },

    error(message, line) {
      emit({ action: "log", target: "console", label: `Error: ${message}`, caption: `Threw: ${message}`, line });
    },

    // Wraps a callback passed to setTimeout/setInterval. Enqueues NOW
    // (synchronously, at the call site); the returned function is what
    // actually gets handed to the real setTimeout — when the REAL timer
    // fires, it records the dequeue first, then runs the original callback
    // (which independently records its own push/pop via instrumentation).
    macrotask(fn, label, line) {
      this.enqueue("macrotask", label, line);
      const self = this;
      return function (...args) {
        self.dequeue("macrotask", label);
        return fn.apply(this, args);
      };
    },

    microtask(fn, label, line) {
      this.enqueue("microtask", label, line);
      const self = this;
      return function (...args) {
        self.dequeue("microtask", label);
        return fn.apply(this, args);
      };
    },

    clampDelay(delay) {
      const n = Number(delay) || 0;
      return Math.min(n, MAX_CLAMPED_DELAY);
    },

    // Resolves once the top-level script has finished AND every scheduled
    // task/microtask has run to completion, with a short grace window in
    // case one callback schedules another in the same tick.
    whenIdle() {
      if (pending === 0) scheduleIdleCheck();
      return idlePromise;
    },
  };
}
