# Async JavaScript — Deep Dive

Senior/Lead/Staff-level treatment of the async model interviewers and
production incidents actually probe: not "what is a Promise" but "why did
this specific `Promise.all` swallow three successful results, why does this
`await` in a loop take 10× longer than it should, and why is this fetch
still burning bandwidth after the user navigated away." Every runnable
snippet is real JS executed with `new Function` — press **▶ Run** and read
the *actual* order and output before scrolling to the explanation. Predict
first, then verify. That's the practice loop for this entire doc.

> **One thing about the runner:** each snippet runs inside a plain (non-async)
> function, so there is **no top-level `await`** here — exactly like a
> `<script>` tag or a CommonJS module. Every async example wraps its body in
> an **IIFE**: `(async () => { … })();`. That's not ceremony — it's the same
> boundary you hit in real code the moment you need `await` outside an
> `async function`. The synchronous logs after the IIFE will print *before*
> the async ones; that ordering is the lesson, not a bug.

Two helpers appear throughout. Mentally bind them now:

```js
// Resolves with `value` after `ms` ms. Our stand-in for any async success.
const delay = (ms, value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

// Rejects with an Error after `ms` ms. Our stand-in for any async failure.
const fail = (ms, message) =>
  new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));

console.log("helpers defined:", typeof delay, typeof fail);
```

We avoid real `fetch` in runnable cells (network is nondeterministic and
flaky in a practice tool); `delay`/`fail` give you the *same* timing model
you get from the network, but reproducible. Where the real-world API is
`fetch`, the code is shown and called out explicitly.

## Table of Contents

- [Promises — The State Machine](#promises--the-state-machine)
- [async / await](#async--await)
- [Promise.all — All or Nothing](#promiseall--all-or-nothing)
- [Promise.allSettled — Never Rejects](#promiseallsettled--never-rejects)
- [Promise.race — First to Settle](#promiserace--first-to-settle)
- [Promise.any — First to Succeed](#promiseany--first-to-succeed)
- [The Four Combinators, Side by Side](#the-four-combinators-side-by-side)
- [AbortController — Cancellation](#abortcontroller--cancellation)
- [Async Iterators & `for await...of`](#async-iterators--for-awaitof)
- [Interview Questions](#interview-questions)

---

## Promises — The State Machine

### The Mental Model

A Promise is a **one-way state machine** with exactly three states and two
transitions that can each happen **at most once**:

```
                 ┌──────────────┐
                 │   pending    │   (created, not yet settled)
                 └──────┬───────┘
              resolve() │ reject()
                ┌───────┴────────┐
                ▼                ▼
        ┌──────────────┐  ┌──────────────┐
        │  fulfilled   │  │   rejected   │
        │ (has value)  │  │ (has reason) │
        └──────────────┘  └──────────────┘
         └──────── settled ───────┘   ← terminal, immutable, forever
```

Once settled, a Promise is **frozen**: a second `resolve`/`reject` is
silently ignored. This immutability is *the* property everything else builds
on — a settled Promise is a reliable value you can read as many times, from
as many `.then`s, as you like, and always get the same answer.

```js
const p = new Promise((resolve, reject) => {
  resolve("first");        // wins
  resolve("second");       // ignored — already settled
  reject(new Error("no")); // ignored — already settled
});

p.then((v) => console.log("value:", v));         // "first"
p.then((v) => console.log("read again:", v));     // "first" — same, reusable
```

### The Executor Runs *Synchronously* — the `.then` Callback Does Not

The function you pass to `new Promise(executor)` runs **immediately and
synchronously**, right where you construct the Promise. What's deferred is
the *`.then`/`.catch` callback*, which always runs as a **microtask** — even
if the Promise is already settled.

```js
console.log("1: before construction");

const p = new Promise((resolve) => {
  console.log("2: inside executor (SYNC)");
  resolve();
});

p.then(() => console.log("4: .then callback (MICROTASK)"));

console.log("3: after construction (SYNC)");
// Predict the order, then Run. The executor is sync; only the .then defers.
```

### `.then` Returns a *New* Promise — Chaining Is Value Transformation

Every `.then`/`.catch`/`.finally` returns a **brand-new** Promise. What that
new Promise resolves to depends entirely on what the callback does:

```
Inside a .then callback you can:
  return a plain value   → next .then receives that value
  return a Promise        → chain WAITS for it, then unwraps its value
  throw                   → skips .then callbacks, jumps to next .catch
  return nothing          → next .then receives undefined
```

```js
const delay = (ms, value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

Promise.resolve(2)
  .then((n) => n * 10)                 // return plain value → 20
  .then((n) => delay(50, n + 5))        // return a Promise → chain WAITS, unwraps 25
  .then((n) => {
    console.log("final:", n);           // 25
    if (n > 20) throw new Error("too big");
    return n;
  })
  .then(() => console.log("this is SKIPPED"))
  .catch((err) => console.log("caught:", err.message)); // "too big"
```

The single most common beginner bug is forgetting the `return`:

```js
const delay = (ms, value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

// BROKEN: no return, so the chain does NOT wait for the inner promise.
Promise.resolve()
  .then(() => {
    delay(100, "inner").then((v) => console.log("inner resolved:", v));
    // ↑ nothing returned → the chain treats this .then as instantly done
  })
  .then(() => console.log("outer next — runs BEFORE inner resolves"));
// Run it: "outer next" prints first. That's the missing-return bug in the wild.
```

### `.catch` and `.finally`

`.catch(fn)` is exactly `.then(undefined, fn)` — it handles a rejection from
*anywhere earlier* in the chain. A single trailing `.catch` covers every
step above it, which is why chaining beats nesting:

```js
const fail = (ms, message) =>
  new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));

fail(30, "step 2 blew up")
  .then((v) => console.log("won't run:", v))
  .then((v) => console.log("won't run either:", v))
  .catch((err) => console.log("one catch handles all:", err.message))
  .finally(() => console.log("finally: always runs, gets no argument"));
```

`.finally` runs on both success and failure, receives **no argument**, and —
crucially — **passes the original settlement through unchanged** (unless it
itself throws or returns a rejected promise). It's for cleanup (hide a
spinner, close a handle), not for transforming the value.

### Gotchas That Bite in Production

- **Floating promises.** A Promise whose rejection nobody handles triggers an
  `unhandledrejection` event (and crashes Node by default in modern
  versions). Always terminate a chain with `.catch`, or `await` it inside a
  `try/catch`.
- **`.then` chained vs nested.** Nesting `.then` inside `.then` rebuilds
  callback hell with extra steps and scatters error handling. Return the
  inner promise and keep the chain flat.
- **`Promise.resolve(thenable)` adopts it.** If you resolve a Promise with an
  object that has a `.then` method, the outer Promise *waits for that
  thenable*. This is how `await` interoperates with non-native promises — and
  an occasional footgun if some object accidentally has a `.then`.
- **Constructing when you don't need to.** `new Promise((res) => res(x))` is
  just `Promise.resolve(x)`. Reaching for `new Promise` around code that's
  already promise-based is the "explicit promise construction antipattern."

---

## async / await

### What `await` Actually Does

`async`/`await` is syntactic sugar over the exact Promise machine above. Two
hard rules:

1. An `async` function **always returns a Promise.** A `return x` fulfills it
   with `x`; a `throw` rejects it.
2. `await p` **pauses the async function**, hands control back to the caller,
   and resumes the function as a **microtask** once `p` settles — unwrapping
   its fulfilled value or throwing its rejection reason.

```js
const delay = (ms, value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

(async () => {
  console.log("A: start");
  const v = await delay(50, "resolved-value");
  console.log("C: resumed with", v); // resumes as a microtask after 50ms
})();

console.log("B: sync code after the IIFE runs first");
// Order: A, B, C. The await yields control; sync code drains first.
```

### `try/catch` Replaces `.catch`

`await` turns a rejection into a thrown exception, so ordinary `try/catch`
handles async errors — the single biggest ergonomic win of `await`:

```js
const fail = (ms, message) =>
  new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));

(async () => {
  try {
    await fail(30, "network down");
    console.log("unreachable");
  } catch (err) {
    console.log("caught with try/catch:", err.message);
  } finally {
    console.log("cleanup runs regardless");
  }
})();
```

### The Sequential-vs-Parallel Mistake (the one that matters most)

Two independent async operations `await`ed on consecutive lines run **one
after the other** — you pay the sum of their durations for no reason. This is
the most common real-world async performance bug.

```js
const delay = (ms, value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

(async () => {
  const t0 = Date.now();

  // SLOW — sequential. Each await blocks the next line from even STARTING.
  const a = await delay(200, "A");
  const b = await delay(200, "B");
  console.log("sequential:", a, b, "took ~", Date.now() - t0, "ms"); // ~400ms
})();
```

```js
const delay = (ms, value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

(async () => {
  const t0 = Date.now();

  // FAST — start BOTH, then await. Kick off the promises first, await after.
  const pa = delay(200, "A");
  const pb = delay(200, "B");
  const a = await pa;
  const b = await pb;
  console.log("parallel:", a, b, "took ~", Date.now() - t0, "ms"); // ~200ms
})();
```

The rule: **`await` only when you actually need the value.** If two
operations don't depend on each other, start them both before awaiting either
(or use `Promise.all`, next section).

### Loops: `for...of` Awaits Sequentially; `.map` Goes Parallel

```js
const delay = (ms, value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));
const ids = [1, 2, 3];

(async () => {
  const t0 = Date.now();

  // Sequential: each iteration's await blocks the next. Sometimes REQUIRED
  // (rate limits, ordered writes). Often accidental and slow.
  for (const id of ids) {
    await delay(100, id);
  }
  console.log("for...of sequential took ~", Date.now() - t0, "ms"); // ~300ms
})();
```

```js
const delay = (ms, value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));
const ids = [1, 2, 3];

(async () => {
  const t0 = Date.now();

  // Parallel: .map starts all promises synchronously; Promise.all awaits them.
  const results = await Promise.all(ids.map((id) => delay(100, id)));
  console.log("map + Promise.all:", results, "took ~", Date.now() - t0, "ms"); // ~100ms
})();
```

Note: `array.forEach(async ...)` does **not** wait for anything — `forEach`
ignores the returned promises. Use `for...of` (sequential) or
`map`+`Promise.all` (parallel). Never `forEach` for async work.

### `return await` vs `return`

Inside a `try`, `return await promise` and `return promise` differ:
`return await` keeps the function's frame alive so a rejection is caught by
the *local* `catch`; a bare `return promise` hands the pending promise to the
caller and the local `catch` never sees the rejection.

```js
const fail = (ms, message) =>
  new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));

async function withReturnAwait() {
  try {
    return await fail(20, "boom"); // await → local catch fires
  } catch (err) {
    return "handled locally: " + err.message;
  }
}

async function withBareReturn() {
  try {
    return fail(20, "boom"); // no await → rejection escapes this catch
  } catch (err) {
    return "never reached: " + err.message;
  }
}

(async () => {
  console.log(await withReturnAwait()); // "handled locally: boom"
  try {
    await withBareReturn();
  } catch (err) {
    console.log("escaped to caller:", err.message); // "boom"
  }
})();
```

Outside a `try`, prefer bare `return promise` — the extra `await` just adds a
microtask tick for no benefit.

### Top-Level `await`

In a real **ES module** (`<script type="module">` or a `.mjs`/bundled file),
`await` at the top level is legal and blocks the module's evaluation until it
settles — which is why sibling importers wait for it. It is **not** legal in
a plain script or CommonJS module, which is exactly why every snippet here
wraps async work in `(async () => { … })()`.

---

## Promise.all — All or Nothing

### Semantics

`Promise.all(iterable)` returns a Promise that:

- **fulfills** with an array of results **in input order** (not completion
  order) once *every* input has fulfilled, or
- **rejects immediately** with the reason of the **first** input to reject
  ("fail-fast"), ignoring all others' outcomes.

```
all([p1, p2, p3])
  all fulfill  → [v1, v2, v3]     (order = input order, not finish order)
  any rejects  → reject(first reason), other results DISCARDED
```

```js
const delay = (ms, value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

(async () => {
  // Note the durations: results come back in INPUT order, not finish order.
  const results = await Promise.all([
    delay(300, "slow-first-in-array"),
    delay(100, "fast-second-in-array"),
    delay(200, "mid-third"),
  ]);
  console.log(results);
  // ["slow-first-in-array", "fast-second-in-array", "mid-third"]
})();
```

### Fail-Fast — and What It Doesn't Do

The moment one input rejects, `Promise.all` rejects. But the other promises
are **not cancelled** — they keep running, their results are just thrown
away. `Promise.all` has no power to abort work; that's what `AbortController`
is for.

```js
const delay = (ms, value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));
const fail = (ms, message) =>
  new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));

(async () => {
  try {
    await Promise.all([
      delay(100, "would-have-succeeded"), // still runs; result discarded
      fail(30, "first to reject wins"),
      delay(200, "also-discarded"),
    ]);
  } catch (err) {
    console.log("Promise.all rejected with:", err.message);
  }
})();
```

**The classic trap:** one failure loses *all* the successful results. If you
need "get me everything that worked, and tell me what didn't," `Promise.all`
is the wrong tool — reach for `allSettled`.

---

## Promise.allSettled — Never Rejects

### Semantics

`Promise.allSettled(iterable)` waits for **every** input to settle and
**always fulfills** (it never rejects) with an array of result descriptor
objects, in input order:

```
{ status: "fulfilled", value:  <value>  }   for each that fulfilled
{ status: "rejected",  reason: <reason> }   for each that rejected
```

Use it when you want **all outcomes regardless of individual failures**:
dashboards where each widget loads independently, batch operations where
partial success is acceptable, "settle everything then report."

```js
const delay = (ms, value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));
const fail = (ms, message) =>
  new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));

(async () => {
  const results = await Promise.allSettled([
    delay(50, "widget A data"),
    fail(30, "widget B failed"),
    delay(80, "widget C data"),
  ]);

  // Log a clean summary. (reason is an Error — pull .message for readability.)
  for (const r of results) {
    if (r.status === "fulfilled") {
      console.log("OK:", r.value);
    } else {
      console.log("ERR:", r.reason.message);
    }
  }
})();
```

A common pattern: split the descriptors into wins and losses.

```js
const delay = (ms, value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));
const fail = (ms, message) =>
  new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));

(async () => {
  const results = await Promise.allSettled([
    delay(40, 1), fail(20, "bad"), delay(60, 3),
  ]);

  const fulfilled = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);
  const rejected = results
    .filter((r) => r.status === "rejected")
    .map((r) => r.reason.message);

  console.log("succeeded:", fulfilled); // [1, 3]
  console.log("failed:", rejected);      // ["bad"]
})();
```

---

## Promise.race — First to Settle

### Semantics

`Promise.race(iterable)` settles as soon as the **first** input settles —
adopting its outcome, **whether that's fulfillment OR rejection**. "First to
finish, win or lose."

```
race([p1, p2, ...])
  → mirrors whichever settles FIRST (fulfilled → fulfill, rejected → reject)
  → the losers keep running; their outcomes are ignored
```

```js
const delay = (ms, value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));
const fail = (ms, message) =>
  new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));

(async () => {
  // The 30ms REJECTION wins the race because it settles first.
  try {
    const winner = await Promise.race([
      delay(100, "slow success"),
      fail(30, "fast failure"),
    ]);
    console.log("winner:", winner);
  } catch (err) {
    console.log("race rejected first:", err.message); // "fast failure"
  }
})();
```

### The Timeout Pattern

`race` against a timer is the classic "give up after N ms" idiom (though for
real cancellation you still want `AbortController` — `race` abandons the slow
promise but doesn't stop its work):

```js
const delay = (ms, value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

(async () => {
  try {
    const r = await withTimeout(delay(500, "eventually"), 100);
    console.log("got:", r);
  } catch (err) {
    console.log(err.message); // "timed out after 100ms"
  }
})();
```

**Gotchas:** `Promise.race([])` (empty iterable) stays **pending forever** —
there's nothing to settle it. And, like `all`, the losing promises are not
cancelled.

---

## Promise.any — First to Succeed

### Semantics

`Promise.any(iterable)` fulfills with the value of the **first input to
fulfill**, **ignoring rejections**. It only rejects if **every** input
rejects — and then it rejects with an **`AggregateError`** whose `.errors`
array holds every reason.

```
any([p1, p2, ...])
  first FULFILLMENT wins          (rejections along the way are ignored)
  all reject → AggregateError { errors: [reason1, reason2, ...] }
```

This is `race`'s optimistic sibling: `race` cares about the first to
*settle* (win or lose); `any` cares about the first to *succeed*.

```js
const delay = (ms, value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));
const fail = (ms, message) =>
  new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));

(async () => {
  // The fast FAILURE is ignored; the first SUCCESS wins.
  const winner = await Promise.any([
    fail(20, "mirror 1 down"),
    delay(80, "mirror 2 ok"),
    delay(200, "mirror 3 ok"),
  ]);
  console.log("first success:", winner); // "mirror 2 ok"
})();
```

When everything fails, inspect `AggregateError.errors`:

```js
const fail = (ms, message) =>
  new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));

(async () => {
  try {
    await Promise.any([
      fail(20, "A failed"),
      fail(40, "B failed"),
      fail(60, "C failed"),
    ]);
  } catch (err) {
    console.log("name:", err.name);                         // "AggregateError"
    console.log("all reasons:", err.errors.map((e) => e.message));
    // ["A failed", "B failed", "C failed"]
  }
})();
```

`Promise.any([])` rejects immediately with an `AggregateError` (there are no
promises that *could* fulfill).

---

## The Four Combinators, Side by Side

| Combinator            | Fulfills when…                     | Rejects when…                          | Result shape                          | Cancels losers? |
| --------------------- | ---------------------------------- | -------------------------------------- | ------------------------------------- | --------------- |
| `Promise.all`         | **all** fulfill                    | **any** rejects (first reason)         | `[v1, v2, …]` (input order)           | No              |
| `Promise.allSettled`  | **always** (all settle)            | never                                  | `[{status, value|reason}, …]`         | No              |
| `Promise.race`        | first **settles** as fulfilled     | first **settles** as rejected          | single value / reason                 | No              |
| `Promise.any`         | first **fulfills**                 | **all** reject → `AggregateError`      | single value / `AggregateError`       | No              |

Two facts unify the table: **none of them cancel anything** (cancellation is
`AbortController`'s job, next), and result **order** only matters for `all`
and `allSettled`, which preserve *input* order regardless of finish order.

Picking the right one:

- Need every result, fail if any fails → **`all`**
- Need every outcome, tolerate failures → **`allSettled`**
- Need the fastest answer, even if it's an error (timeouts) → **`race`**
- Need the fastest *success*, tolerate some failures (redundant mirrors) →
  **`any`**

---

## AbortController — Cancellation

### The Model

Promises have no built-in cancellation. `AbortController` is the standard
signalling mechanism layered on top: one controller owns a `signal`, you pass
that `signal` into abortable operations, and calling `controller.abort()`
flips the signal and notifies every listener.

```
const controller = new AbortController()
        │
        ├─ controller.signal   → hand to fetch()/addEventListener/your own code
        ├─ controller.abort(reason?)   → sets signal.aborted = true, fires "abort"
        │
signal.aborted   → boolean, is it aborted yet?
signal.reason    → why (defaults to an AbortError DOMException)
signal.addEventListener("abort", …)     → react to cancellation
signal.throwIfAborted()                  → throw reason if already aborted
```

### The `fetch` Pattern (real-world)

This is the canonical use. `fetch` natively understands `signal`; aborting
rejects the fetch promise with an `AbortError` **and** actually tears down
the network request:

```js
// Real fetch — shown, not run (network is nondeterministic in this tool).
async function loadUser(id, signal) {
  const res = await fetch(`/api/users/${id}`, { signal });
  return res.json();
}

const controller = new AbortController();
loadUser(42, controller.signal).catch((err) => {
  if (err.name === "AbortError") console.log("request cancelled");
  else throw err;
});

// e.g. user navigated away / typed a new search term:
controller.abort();
```

### Making Your *Own* Async Abortable

Any promise-based operation can honor a signal. The pattern: check
`signal.aborted` up front, then subscribe to the `abort` event and reject +
clean up when it fires.

```js
function abortableDelay(ms, value, signal) {
  return new Promise((resolve, reject) => {
    // Already aborted before we even start? Bail immediately.
    if (signal.aborted) return reject(signal.reason);

    const id = setTimeout(() => resolve(value), ms);

    // On abort: stop the pending work AND reject, so awaiters unblock.
    signal.addEventListener("abort", () => {
      clearTimeout(id);       // the crucial cleanup — kill the real work
      reject(signal.reason);
    }, { once: true });
  });
}

const controller = new AbortController();

(async () => {
  try {
    await abortableDelay(500, "done", controller.signal);
    console.log("completed");
  } catch (err) {
    console.log("aborted:", err.name); // "AbortError"
  }
})();

// Cancel after 100ms — before the 500ms work would finish.
setTimeout(() => controller.abort(), 100);
```

### Built-in Conveniences

`AbortSignal.timeout(ms)` gives you a signal that auto-aborts after `ms` —
the cleanest way to express "cancel this if it takes too long," and it
*actually* cancels (unlike the `Promise.race` timeout, which only abandons):

```js
function abortableDelay(ms, value, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const id = setTimeout(() => resolve(value), ms);
    signal.addEventListener("abort", () => {
      clearTimeout(id);
      reject(signal.reason);
    }, { once: true });
  });
}

(async () => {
  try {
    // Self-aborting signal — no manual controller.abort() needed.
    await abortableDelay(500, "done", AbortSignal.timeout(100));
    console.log("completed");
  } catch (err) {
    console.log("timed out via signal:", err.name); // "TimeoutError"
  }
})();
```

`AbortSignal.any([sig1, sig2, …])` composes signals: the derived signal
aborts as soon as **any** input aborts — perfect for "cancel if the user
navigates away **or** a 5s timeout hits."

```js
function abortableDelay(ms, value, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const id = setTimeout(() => resolve(value), ms);
    signal.addEventListener("abort", () => {
      clearTimeout(id);
      reject(signal.reason);
    }, { once: true });
  });
}

const userNav = new AbortController();
const combined = AbortSignal.any([userNav.signal, AbortSignal.timeout(1000)]);

(async () => {
  try {
    await abortableDelay(5000, "done", combined);
  } catch (err) {
    console.log("cancelled by whichever fired first:", err.name);
  }
})();

// Simulate the user navigating away at 200ms — beats the 1000ms timeout.
setTimeout(() => userNav.abort(new DOMException("navigated", "AbortError")), 200);
```

### Gotchas

- **Abort doesn't undo side effects.** It rejects the promise and (if you
  wired it) stops *pending* work. Anything already committed — a row written,
  bytes already sent — stays committed. Design cleanup accordingly.
- **You must actually honor the signal.** Passing a signal into code that
  ignores it does nothing. `fetch` honors it; your custom promise only does
  if you subscribe to `abort` (as above).
- **`AbortError` vs `TimeoutError`.** Manual `abort()` rejects with an
  `AbortError`; `AbortSignal.timeout` rejects with a `TimeoutError`. Branch on
  `err.name` if you need to tell "user cancelled" from "took too long."
- **Reusability.** A controller is single-use — once aborted, its signal is
  aborted forever. Make a fresh `AbortController` per operation (e.g. per
  keystroke in a typeahead).

---

## Async Iterators & `for await...of`

### The Protocol

A **sync** iterator's `next()` returns `{ value, done }`. An **async**
iterator's `next()` returns a **Promise** of `{ value, done }` — so each step
can be awaited. An object is async-iterable if it has a
**`[Symbol.asyncIterator]()`** method returning such an iterator, and
**`for await...of`** is the syntax that drives it, awaiting each step.

```
sync : obj[Symbol.iterator]().next()      → { value, done }
async: obj[Symbol.asyncIterator]().next() → Promise<{ value, done }>

for await (const x of asyncIterable) { … }   ← awaits every next()
```

```js
const delay = (ms, value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const asyncCountdown = {
  [Symbol.asyncIterator]() {
    let n = 3;
    return {
      next() {
        if (n === 0) return Promise.resolve({ value: undefined, done: true });
        return delay(60, { value: n--, done: false }); // each step is async
      },
    };
  },
};

(async () => {
  for await (const n of asyncCountdown) {
    console.log("tick:", n); // 3, 2, 1 — one every ~60ms
  }
  console.log("liftoff");
})();
```

### Async Generators — the Ergonomic Way

Hand-writing `next()` is tedious. An **async generator** (`async function*`)
gives you the same protocol for free: `yield` produces values, `await` pauses
between them, and the object it returns is already async-iterable.

```js
const delay = (ms, value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

async function* fetchPages() {
  let page = 1;
  while (page <= 3) {
    const data = await delay(50, `page ${page} rows`); // simulate a paged API
    yield data;
    page++;
  }
}

(async () => {
  for await (const rows of fetchPages()) {
    console.log("received:", rows);
  }
  console.log("all pages consumed");
})();
```

This is the natural model for **paginated APIs** and **streams**: the
consumer writes a plain `for await...of` loop and never manages page cursors
or buffering — the generator yields the next chunk only when asked, and only
after its `await` resolves (lazy, backpressure-friendly).

### Cleanup, `break`, and Errors

If you `break` (or `throw`) out of a `for await...of`, the loop calls the
iterator's `return()` — which in a generator runs any **`finally`** block.
That's where you release resources (close a cursor, a file handle, a socket):

```js
const delay = (ms, value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

async function* withCleanup() {
  try {
    let i = 0;
    while (true) {
      yield await delay(30, i++);
    }
  } finally {
    console.log("finally: released the resource"); // runs on break!
  }
}

(async () => {
  for await (const n of withCleanup()) {
    console.log("got:", n);
    if (n === 2) break; // triggers the generator's finally on the way out
  }
  console.log("loop exited cleanly");
})();
```

A `throw` inside the loop body, or a rejected `next()`, propagates like any
async error — wrap the `for await...of` in `try/catch` to handle it, and the
generator's `finally` still runs.

### Concurrency Caveat

`for await...of` is **sequential by design** — it awaits each `next()` before
requesting the following one. That's correct for ordered streams, but if you
have N independent async items and want them concurrent, don't reach for an
async iterator; use `map` + `Promise.all` (or `allSettled`) instead. Async
iterators model *ordered, pull-based* streams, not *parallel fan-out*.

---

## Interview Questions

Rapid-fire, senior/staff calibrated — the goal isn't reciting a definition,
it's predicting *behavior* and explaining the mechanism, the way every
runnable example above asked you to.

**Q: Does the function passed to `new Promise()` run synchronously or asynchronously?**
The **executor runs synchronously**, immediately, at construction time. Only
the `.then`/`.catch`/`.finally` *callbacks* are deferred — and they run as
microtasks, even when the promise is already settled.

**Q: `setTimeout(fn, 0)` vs `Promise.resolve().then(fn)` — which runs first and why?**
The Promise callback. It's a **microtask**; the timeout is a **macrotask**.
The event loop fully drains the microtask queue before running the next
macrotask, so a resolved promise's `.then` always beats a `setTimeout(…, 0)`.

**Q: Two independent awaits on consecutive lines — what's the performance bug?**
They run **sequentially**: the second operation doesn't even *start* until the
first resolves, so you pay the sum of durations. Fix: start both promises
first (or `Promise.all`), then await — paying only the max.

**Q: `Promise.all` vs `Promise.allSettled` — when does the difference bite?**
`all` is fail-fast: one rejection rejects the whole thing and you **lose every
successful result**. `allSettled` never rejects and hands back every outcome
as `{status, value|reason}`. Use `allSettled` when partial success is
acceptable (dashboards, batch jobs).

**Q: `Promise.race` vs `Promise.any`?**
`race` settles on the **first to settle** — win *or* lose (a fast rejection
wins). `any` settles on the **first to fulfill**, ignoring rejections, and
only rejects (with an `AggregateError`) if **all** reject. `race` for
timeouts; `any` for "fastest healthy replica."

**Q: What does `Promise.all` do to the other promises when one rejects?**
Nothing — they keep running to completion; their results are simply
discarded. No combinator cancels anything. Cancellation requires
`AbortController`.

**Q: What does `Promise.race([])` resolve to?**
It never settles — it stays pending forever, because an empty iterable gives
it nothing to mirror. (`Promise.any([])`, by contrast, rejects immediately
with an `AggregateError`.)

**Q: Inside a `try`, why might `return somePromise` skip the local `catch` but `return await somePromise` not?**
`return await` keeps the current async frame on the stack, so a rejection is
thrown *inside* this function and the local `catch` sees it. A bare
`return promise` hands the still-pending promise to the caller and unwinds
this frame first — the rejection surfaces in the caller, not the local
`catch`.

**Q: Why does `array.forEach(async (x) => await work(x))` not wait?**
`forEach` ignores return values, so it fires off all the async callbacks and
returns immediately without awaiting any of them. Use `for...of` for
sequential awaiting or `Promise.all(array.map(...))` for parallel.

**Q: How do you actually cancel a `fetch`, and what does "cancel" guarantee?**
Pass `controller.signal` to `fetch`, then call `controller.abort()`. The
fetch promise rejects with an `AbortError` and the network request is torn
down. It does **not** undo side effects already committed on the server — it
stops in-flight work, not completed work.

**Q: Difference between a sync iterator and an async iterator, concretely?**
A sync iterator's `next()` returns `{value, done}`; an async iterator's
`next()` returns a **Promise** of `{value, done}`, and it lives under
`Symbol.asyncIterator`. `for await...of` drives the async one, awaiting each
step — sequentially, by design.

**Q: You have 50 independent URLs to fetch as fast as possible. Async iterator or `Promise.all`?**
`Promise.all` (or `allSettled`) over `urls.map(fetchFn)`. `for await...of` is
pull-based and sequential — it's for *ordered streams*, not parallel fan-out.
