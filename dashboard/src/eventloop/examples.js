// Each example is hand-authored, not derived from running real code — we
// decide the correct step sequence ourselves (verified against real browser
// behavior in the JS Fundamentals doc), which is what makes this "small":
// no interpreter, no instrumentation, just an accurate transcript.
//
// Step shape: { action, target, label, caption, line }
//   action: "push" | "pop" | "enqueue" | "dequeue" | "log" | "note"
//   target: "call" | "microtask" | "macrotask" | "console" | "none"
//   label:  short text shown in the panel (push/enqueue/log only)
//   caption: the teaching sentence, always shown
//   line:   1-indexed source line to highlight, or null
//
// Replay rule: push/enqueue APPEND; pop/dequeue REMOVE from the correct end
// (pop = last item of call stack, dequeue = first item of the named queue).
// console.log itself gets no call-stack frame of its own — it just prints
// using whichever frame is currently on top. See the dashboard chat history
// for why: modeling it would triple the step count for a non-goal.

export const eventLoopExamples = [
  {
    id: "microtask-vs-macrotask",
    title: "Microtask vs Macrotask Ordering",
    code: [
      'console.log("script start");',
      'setTimeout(() => console.log("F: setTimeout"), 0);',
      "Promise.resolve()",
      '  .then(() => console.log("B: first .then"))',
      '  .then(() => console.log("D: second .then"));',
      'queueMicrotask(() => console.log("C: queueMicrotask"));',
      'console.log("script end");',
    ].join("\n"),
    steps: [
      { action: "push", target: "call", label: "main()", caption: "Script starts running — this is the base call stack frame for all top-level code.", line: null },
      { action: "log", target: "console", label: "script start", caption: "Line 1 runs synchronously, inside main().", line: 1 },
      { action: "enqueue", target: "macrotask", label: "() => log('F')", caption: "Line 2: setTimeout schedules its callback as a macrotask. A 0ms delay does NOT mean it runs now — it just means the minimum wait is 0.", line: 2 },
      { action: "enqueue", target: "microtask", label: "() => log('B')", caption: "Lines 3–4: Promise.resolve() is already resolved, so the FIRST .then's callback is queued as a microtask immediately.", line: 4 },
      { action: "enqueue", target: "microtask", label: "() => log('C')", caption: "Line 6: queueMicrotask adds its callback to the SAME queue, behind B. (D — the second .then — is NOT queued yet; it depends on B settling first.)", line: 6 },
      { action: "log", target: "console", label: "script end", caption: "Line 7 runs synchronously — still inside main(), before any queued callback gets a turn.", line: 7 },
      { action: "pop", target: "call", label: null, caption: "Top-level script finished. The call stack is empty — this is the moment the event loop decides what runs next.", line: null },
      { action: "note", target: "none", label: null, caption: "Rule: drain the ENTIRE microtask queue — including microtasks queued mid-drain — before running even one macrotask. Queue right now: [B, C].", line: null },
      { action: "dequeue", target: "microtask", label: "B", caption: "Microtask queue is FIFO — B is at the front.", line: null },
      { action: "push", target: "call", label: "B's callback", caption: "B's callback starts running, pushed onto the now-empty stack.", line: 4 },
      { action: "log", target: "console", label: "B: first .then", caption: "B prints its message.", line: 4 },
      { action: "enqueue", target: "microtask", label: "() => log('D')", caption: "B finishing means the promise the first .then returned just settled — so D becomes eligible NOW, and is appended to the END of the queue: [C, D]. C is still ahead of it.", line: 5 },
      { action: "pop", target: "call", label: null, caption: "B's callback returns. Stack empty again.", line: null },
      { action: "dequeue", target: "microtask", label: "C", caption: "Next in the queue: C.", line: null },
      { action: "push", target: "call", label: "C's callback", caption: "C's callback runs.", line: 6 },
      { action: "log", target: "console", label: "C: queueMicrotask", caption: "C prints its message.", line: 6 },
      { action: "pop", target: "call", label: null, caption: "C's callback returns.", line: null },
      { action: "dequeue", target: "microtask", label: "D", caption: "Only now does D get its turn — queued LATER than C (back at step 12), even though its .then() chain started earlier in the source.", line: null },
      { action: "push", target: "call", label: "D's callback", caption: "D's callback runs.", line: 5 },
      { action: "log", target: "console", label: "D: second .then", caption: "D prints its message.", line: 5 },
      { action: "pop", target: "call", label: null, caption: "D's callback returns.", line: null },
      { action: "note", target: "none", label: null, caption: "Microtask queue is now empty. ONLY NOW is the event loop allowed to pull from the macrotask queue.", line: null },
      { action: "dequeue", target: "macrotask", label: "F", caption: "F has been waiting since step 3 — macrotasks never run until every microtask, including ones queued mid-drain, has been processed.", line: null },
      { action: "push", target: "call", label: "F's callback", caption: "F's callback finally runs.", line: 2 },
      { action: "log", target: "console", label: "F: setTimeout", caption: "F prints its message.", line: 2 },
      { action: "pop", target: "call", label: null, caption: "Done. Final printed order: script start, script end, B, C, D, F.", line: null },
    ],
  },
];
