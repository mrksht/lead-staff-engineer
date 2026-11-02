# Stacks, Queues & Linked Lists — DSA Practice (5 of 5)

This is the file where sloppy pointer bookkeeping gets punished, not
algorithmic cleverness. Stacks and linked lists have no magic trick to
derive — the whole game is updating every reference correctly, in the right
order, every single time. Most bugs below aren't wrong-complexity bugs, they
are "forgot to update `next` before overwriting it" or "evicted from the
wrong end" bugs, and they fail silently (corrupted structure) far more often
than they crash. Same loop as the rest of this series: **attempt, then
verify**. Press ▶ Run on the stub, watch it fail, fix the body, re-run until
every assertion is `✅ PASS`, then diff against the reference solution.

## Table of Contents

- [Problem 1: Valid Parentheses (Easy)](#problem-1-valid-parentheses-easy)
- [Problem 2: Min Stack (Medium)](#problem-2-min-stack-medium)
- [Problem 3: Reverse Linked List (Easy)](#problem-3-reverse-linked-list-easy)
- [Problem 4: Linked List Cycle Detection (Easy/Medium)](#problem-4-linked-list-cycle-detection-easymedium)
- [Problem 5: Merge K Sorted Lists (Hard)](#problem-5-merge-k-sorted-lists-hard)
- [Problem 6: LFU Cache (Hard)](#problem-6-lfu-cache-hard)

---

## Problem 1: Valid Parentheses (Easy)

Given a string `s` containing only the characters `(`, `)`, `[`, `]`, `{`,
`}`, determine if the input is valid. A string is valid if every opening
bracket has a matching closing bracket of the **same type**, and brackets
close in the correct order (last opened, first closed).

**Examples**
- `"()"` → `true`
- `"()[]{}"` → `true`
- `"(]"` → `false` (wrong type)
- `"([)]"` → `false` (right types, wrong order)
- `""` → `true` (vacuously valid — no unmatched bracket exists)

**Clarifying questions a staff engineer asks**
- Can the string contain characters other than brackets (letters, digits)?
  If so, do I ignore them or is that invalid input?
- Is an empty string valid, or an error case? (Spec says valid — confirm
  this isn't assumed.)
- Is this ever going to need to report *where* the mismatch is (for a
  linter/parser use case), or just a boolean? (Changes whether a stack of
  characters is enough or you need a stack of `{char, position}`.)

### Attempt it

```js
function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((ok ? "✅ PASS" : "❌ FAIL") + " — " + label);
  if (!ok) {
    console.log("   expected:", expected);
    console.log("   actual:  ", actual);
  }
}

function isValid(s) {
  // TODO: return true iff every bracket is closed by the correct type in
  // the correct order. Target: O(n) time using a stack of open brackets.
  return false;
}

assertEqual(isValid("()"), true, "simple single pair");
assertEqual(isValid("()[]{}"), true, "all three bracket types, sequential");
assertEqual(isValid("(]"), false, "mismatched types");
assertEqual(isValid("([)]"), false, "interleaved, wrong order");
assertEqual(isValid(""), true, "empty string is vacuously valid");
assertEqual(isValid("((("), false, "unclosed opens");
```

### Approach

Every closing bracket must match the **most recently opened, still-open**
bracket — that "most recent, still open" phrasing is exactly a stack. Push
every opening bracket. On a closing bracket, pop and check it matches the
expected type; if the stack is empty (nothing to match) or the popped
bracket is the wrong type, the string is invalid immediately. After
consuming the whole string, the stack must be empty — any leftover open
brackets are unmatched.

**Complexity:** `O(n)` time, `O(n)` space worst case (all opens, e.g.
`"((((("`).

### Solution

```js
function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((ok ? "✅ PASS" : "❌ FAIL") + " — " + label);
  if (!ok) {
    console.log("   expected:", expected);
    console.log("   actual:  ", actual);
  }
}

function isValid(s) {
  const pairs = { ")": "(", "]": "[", "}": "{" };
  const stack = [];
  for (const ch of s) {
    if (ch === "(" || ch === "[" || ch === "{") {
      stack.push(ch);
    } else if (ch === ")" || ch === "]" || ch === "}") {
      if (stack.pop() !== pairs[ch]) return false;
    }
  }
  return stack.length === 0;
}

assertEqual(isValid("()"), true, "simple single pair");
assertEqual(isValid("()[]{}"), true, "all three bracket types, sequential");
assertEqual(isValid("(]"), false, "mismatched types");
assertEqual(isValid("([)]"), false, "interleaved, wrong order");
assertEqual(isValid(""), true, "empty string is vacuously valid");
assertEqual(isValid("((("), false, "unclosed opens");
```

### Common pitfalls

- Popping an empty stack (`stack.pop()` on `[]` returns `undefined`, which
  never equals any bracket character) — this works correctly in JS by
  accident because `undefined !== pairs[ch]`, but in a language without
  that implicit behavior you must explicitly check `stack.length === 0`
  before popping, or you'll throw instead of returning `false`.
- Forgetting the final `stack.length === 0` check — a string of only
  opening brackets (`"((("`) never fails the per-character loop, it only
  fails because of what's left over at the end.
- Using a `Map`/object keyed the other direction (`open -> close`) and
  trying to look ahead instead of matching against what's on the stack —
  works, but it's solving a harder problem (matching pairs by position)
  than the stack-based "what's currently open" approach needs.

### Staff-level follow-up

**"This now needs to validate brackets inside a 50MB minified JS file as
part of a linter's tokenizer — what changes?"** The algorithm doesn't
change — it's already `O(n)` single-pass. What changes is everything
around it: you can't build the whole string in memory as one JS string if
you're chasing minimal memory, so you'd stream characters from a buffer/file
descriptor and feed them into the same stack logic one token at a time. The
other real change is that a linter needs to report a *location*, not just a
boolean — so the stack holds `{char, line, col}` instead of bare characters,
and on mismatch you report both the unexpected closer's position and the
position of the open bracket it should have matched (which is sitting right
there on top of the stack).

---

## Problem 2: Min Stack (Medium)

Design a stack that supports `push(val)`, `pop()`, `top()`, and
`getMin()` — all in `O(1)` time.

**Examples**
```
push(-2)
push(0)
push(-3)
getMin()  -> -3
pop()
top()     -> 0
getMin()  -> -2
```

**Clarifying questions a staff engineer asks**
- Can `pop()`/`top()`/`getMin()` be called on an empty stack? What should
  happen — throw, return `undefined`, return a sentinel?
- Are duplicate values allowed, including duplicate *minimum* values? (This
  is the detail that breaks a naive "track min, drop it on pop" approach —
  popping one copy of the min must not lose the min if another copy is
  still in the stack.)
- Is extra `O(n)` space (one min value stored per element) acceptable, or
  does this need to be truly `O(1)` auxiliary space on top of the stack
  itself?

### Attempt it

```js
function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((ok ? "✅ PASS" : "❌ FAIL") + " — " + label);
  if (!ok) {
    console.log("   expected:", expected);
    console.log("   actual:  ", actual);
  }
}

class MinStack {
  constructor() {
    // TODO: set up whatever gives O(1) push/pop/top/getMin. Target: store
    // the running min ALONGSIDE each pushed value, so popping never loses
    // track of what the min was one level down.
    this.stack = [];
  }
  push(val) {
    // TODO
  }
  pop() {
    // TODO
  }
  top() {
    // TODO
    return undefined;
  }
  getMin() {
    // TODO
    return undefined;
  }
}

const s1 = new MinStack();
const r1 = [];
s1.push(-2);
s1.push(0);
s1.push(-3);
r1.push(s1.getMin()); // -3
s1.pop();
r1.push(s1.top());    // 0
r1.push(s1.getMin()); // -2
assertEqual(r1, [-3, 0, -2], "classic push/pop/top/getMin sequence");

const s2 = new MinStack();
s2.push(5);
assertEqual([s2.top(), s2.getMin()], [5, 5], "single element: top and min are the same value");

const s3 = new MinStack();
const r3 = [];
s3.push(1);
s3.push(1);
r3.push(s3.getMin()); // 1
s3.pop();
r3.push(s3.getMin()); // still 1, the other copy remains
s3.pop();
assertEqual(r3, [1, 1], "duplicate min values: popping one copy must not lose the min");
```

### Approach

The canonical approach: store a `{val, min}` pair at every stack frame,
where `min` is the smallest value seen **from the bottom of the stack up
through this frame**. On push, the new frame's `min` is
`Math.min(newVal, previousFrame.min)` (or just `newVal` if the stack was
empty). `pop()` just removes the top frame — the frame below it already has
the correct min baked in, so nothing needs recomputing. `getMin()` reads the
top frame's `min` directly.

The alternative — an auxiliary min-stack that only pushes a new min value
when a new minimum is reached — saves space when minima repeat rarely, but
needs careful handling so that popping the *same* minimum value twice
(duplicate mins) doesn't pop the auxiliary stack too early. The paired
`{val, min}` approach sidesteps that entire class of bug by recomputing
nothing and never needing a "should I also pop the aux stack" decision.

**Complexity:** `O(1)` time for all four operations, `O(n)` space (one
extra `min` field per element — the tradeoff explicitly called out in the
approach).

### Solution

```js
function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((ok ? "✅ PASS" : "❌ FAIL") + " — " + label);
  if (!ok) {
    console.log("   expected:", expected);
    console.log("   actual:  ", actual);
  }
}

class MinStack {
  constructor() {
    this.stack = []; // each entry: { val, min } — min is the running min AT this depth
  }
  push(val) {
    const min = this.stack.length === 0 ? val : Math.min(val, this.stack[this.stack.length - 1].min);
    this.stack.push({ val, min });
  }
  pop() {
    this.stack.pop();
  }
  top() {
    return this.stack[this.stack.length - 1].val;
  }
  getMin() {
    return this.stack[this.stack.length - 1].min;
  }
}

const s1 = new MinStack();
const r1 = [];
s1.push(-2);
s1.push(0);
s1.push(-3);
r1.push(s1.getMin()); // -3
s1.pop();
r1.push(s1.top());    // 0
r1.push(s1.getMin()); // -2
assertEqual(r1, [-3, 0, -2], "classic push/pop/top/getMin sequence");

const s2 = new MinStack();
s2.push(5);
assertEqual([s2.top(), s2.getMin()], [5, 5], "single element: top and min are the same value");

const s3 = new MinStack();
const r3 = [];
s3.push(1);
s3.push(1);
r3.push(s3.getMin()); // 1
s3.pop();
r3.push(s3.getMin()); // still 1, the other copy remains
s3.pop();
assertEqual(r3, [1, 1], "duplicate min values: popping one copy must not lose the min");
```

### Common pitfalls

- Tracking a single `this.min` field and overwriting it on push without a
  way to "restore" the previous min on pop — this is the bug that duplicate
  minimum values exposes immediately: pop the min, and now you need the
  *previous* min, which you already threw away.
- Using an auxiliary min-stack but only pushing to it when the new value is
  **strictly less** than the current min, then popping it whenever the main
  stack pops a value **equal to** the current min — if you get the
  strict-vs-equal comparison backwards on either side, duplicate-min cases
  silently break.
- Calling `Math.min(...this.stack)` (or similar) inside `getMin()` instead
  of maintaining the running min incrementally — correct, but `O(n)` per
  call, which fails the `O(1)` requirement entirely.

### Staff-level follow-up

**"This needs to back a real-time metrics dashboard tracking the min of a
sliding window of the last N events, not the whole history — does this
design still work?"** No — a stack only ever shrinks from one end (the top),
but a sliding window needs to evict from the *other* end (the oldest
event) as new ones arrive. This is a different problem: a **monotonic
deque** (double-ended queue) where you push new values from the back after
popping off any larger values already there (they can never be the window's
min while the new, smaller value is in the window), and you evict expired
old values from the front. The min is always whatever's at the front of the
deque. It's the same "maintain a running min cheaply" spirit as this
problem, but the two-sided eviction requirement is exactly why `MinStack`
doesn't generalize to it for free.

---

## Problem 3: Reverse Linked List (Easy)

Given the head of a singly linked list, reverse the list and return the new
head.

**Examples**
- `[1,2,3,4,5]` → `[5,4,3,2,1]`
- `[1]` → `[1]`
- `[]` → `[]`

**Clarifying questions a staff engineer asks**
- Iterative or recursive? (Recursive is elegant but adds `O(n)` call-stack
  space and risks a stack overflow on a long list — worth stating out loud
  which one you're defaulting to and why.)
- Can I mutate the existing nodes' `next` pointers in place, or does this
  need to return a new list leaving the original untouched?
- Singly or doubly linked? (A doubly linked list reversal also needs `prev`
  pointers swapped on every node, not just `next`.)

### Attempt it

```js
function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((ok ? "✅ PASS" : "❌ FAIL") + " — " + label);
  if (!ok) {
    console.log("   expected:", expected);
    console.log("   actual:  ", actual);
  }
}

function buildList(arr) {
  let head = null;
  let tail = null;
  for (const val of arr) {
    const node = { val, next: null };
    if (!head) {
      head = node;
      tail = node;
    } else {
      tail.next = node;
      tail = node;
    }
  }
  return head;
}

function listToArray(head) {
  const out = [];
  let curr = head;
  while (curr) {
    out.push(curr.val);
    curr = curr.next;
  }
  return out;
}

function reverseList(head) {
  // TODO: reverse the list in place and return the new head.
  // Target: O(n) time, O(1) space, three-pointer iteration
  // (prev / curr / next) — no recursion, no extra array.
  return head;
}

assertEqual(listToArray(reverseList(buildList([1, 2, 3, 4, 5]))), [5, 4, 3, 2, 1], "five-node list reverses fully");
assertEqual(listToArray(reverseList(buildList([1]))), [1], "single node reverses to itself");
assertEqual(listToArray(reverseList(buildList([]))), [], "empty list reverses to empty list");
assertEqual(listToArray(reverseList(buildList([1, 2]))), [2, 1], "two-node list swaps order");
```

### Approach

Walk the list once with three pointers: `prev` (initially `null`), `curr`
(initially `head`), and a temporary `next` saved **before** you overwrite
`curr.next`. At each step: save `curr.next`, point `curr.next` back at
`prev`, then advance both `prev` and `curr` forward by one. When `curr`
becomes `null`, `prev` is the new head. The entire bug surface of this
problem is "did you save `next` before clobbering `curr.next`" — do it in
the wrong order and you lose the rest of the list permanently.

**Complexity:** `O(n)` time, `O(1)` space (iterative — no call stack growth,
no extra array).

### Solution

```js
function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((ok ? "✅ PASS" : "❌ FAIL") + " — " + label);
  if (!ok) {
    console.log("   expected:", expected);
    console.log("   actual:  ", actual);
  }
}

function buildList(arr) {
  let head = null;
  let tail = null;
  for (const val of arr) {
    const node = { val, next: null };
    if (!head) {
      head = node;
      tail = node;
    } else {
      tail.next = node;
      tail = node;
    }
  }
  return head;
}

function listToArray(head) {
  const out = [];
  let curr = head;
  while (curr) {
    out.push(curr.val);
    curr = curr.next;
  }
  return out;
}

function reverseList(head) {
  let prev = null;
  let curr = head;
  while (curr) {
    const next = curr.next; // save before overwriting
    curr.next = prev;       // reverse the pointer
    prev = curr;             // advance prev
    curr = next;              // advance curr
  }
  return prev;
}

assertEqual(listToArray(reverseList(buildList([1, 2, 3, 4, 5]))), [5, 4, 3, 2, 1], "five-node list reverses fully");
assertEqual(listToArray(reverseList(buildList([1]))), [1], "single node reverses to itself");
assertEqual(listToArray(reverseList(buildList([]))), [], "empty list reverses to empty list");
assertEqual(listToArray(reverseList(buildList([1, 2]))), [2, 1], "two-node list swaps order");
```

### Common pitfalls

- Setting `curr.next = prev` **before** saving the original `curr.next` —
  this permanently severs the rest of the list; everything past `curr`
  becomes unreachable.
- Returning `curr` instead of `prev` at the end — when the loop exits,
  `curr` is `null` (that's the exit condition) and `prev` holds the actual
  new head.
- Forgetting the empty-list case: `head = null` should just fall through
  the loop (it never executes) and return `prev`, which is still `null` —
  correct by construction if the loop guard is `while (curr)`, but worth
  verifying rather than assuming.

### Staff-level follow-up

**"Now reverse only nodes between positions m and n (1-indexed), leaving
the rest of the list untouched — what's the extra bookkeeping?"** You need
a fourth reference: the node immediately *before* position `m` (so you can
reattach the reversed sublist to the unchanged prefix), and you must track
the **original** node at position `m` (it becomes the tail of the reversed
sublist and needs its `next` pointed at whatever originally followed
position `n`). The core three-pointer reversal loop is identical — it just
runs for `n - m + 1` iterations starting at the right node instead of the
head — but the two reattachment steps (prefix → reversed segment, reversed
segment → suffix) are exactly where off-by-one errors on `m`/`n` boundaries
live, and they're easy to get wrong under time pressure because the bug is
silent (a corrupted but non-crashing list), not a thrown exception.

---

## Problem 4: Linked List Cycle Detection (Easy/Medium)

Given the head of a linked list, determine whether the list contains a
cycle (some node's `next` eventually points back to an earlier node instead
of `null`).

**Examples**
- `[1,2,3]`, no cycle → `false`
- `[3,2,0,-4]` where the tail points back to the node at index `1` → `true`
- `[1]` where the single node points to itself → `true`

**Clarifying questions a staff engineer asks**
- Just a boolean, or do I also need to find **where** the cycle starts?
  (Same core algorithm, one extra phase — see the follow-up.)
- Can the list be empty (`head === null`)? (Must not crash; the answer is
  trivially `false`.)
- Is `O(1)` space actually required, or would a `Set` of visited node
  references (`O(n)` space, dead simple) be acceptable? (Worth stating the
  tradeoff rather than silently picking one.)

### Attempt it

```js
function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((ok ? "✅ PASS" : "❌ FAIL") + " — " + label);
  if (!ok) {
    console.log("   expected:", expected);
    console.log("   actual:  ", actual);
  }
}

function buildList(arr) {
  let head = null;
  let tail = null;
  for (const val of arr) {
    const node = { val, next: null };
    if (!head) {
      head = node;
      tail = node;
    } else {
      tail.next = node;
      tail = node;
    }
  }
  return head;
}

// Builds a list from arr, then — if pos >= 0 — links the tail's `next`
// back to the node at index `pos`, creating a cycle. pos = -1 means no cycle.
function buildListWithCycle(arr, pos) {
  const nodes = arr.map((val) => ({ val, next: null }));
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].next = nodes[i + 1];
  if (pos >= 0 && nodes.length > 0) {
    nodes[nodes.length - 1].next = nodes[pos];
  }
  return nodes.length > 0 ? nodes[0] : null;
}

function hasCycle(head) {
  // TODO: return true iff the list has a cycle.
  // Target: O(n) time, O(1) space using Floyd's slow/fast pointer technique
  // — not a Set of visited nodes (that's O(n) space).
  return false;
}

assertEqual(hasCycle(buildList([1, 2, 3])), false, "straight list, no cycle");
assertEqual(hasCycle(buildListWithCycle([3, 2, 0, -4], 1)), true, "tail wraps back to index 1");
assertEqual(hasCycle(buildListWithCycle([1], 0)), true, "single node pointing to itself");
assertEqual(hasCycle(null), false, "empty list has no cycle");
assertEqual(hasCycle(buildList([1])), false, "single node, no cycle");
```

### Approach

Floyd's cycle detection ("tortoise and hare"): advance a `slow` pointer one
node at a time and a `fast` pointer two nodes at a time. If there's no
cycle, `fast` hits `null` first and the loop exits cleanly. If there **is**
a cycle, `fast` is strictly gaining one node of distance on `slow` every
step *within* the cycle, so it's guaranteed to eventually land on the exact
same node as `slow` — they can't skip past each other on a cyclic
structure. That collision is the signal.

The harder follow-up variant — finding the cycle's **start** node, not just
"does a cycle exist" — adds a second phase after the slow/fast collision:
reset one pointer to `head`, leave the other at the collision point, then
advance both one step at a time. They meet exactly at the cycle's start.
This works because of the specific distance relationship between the
list's non-cyclic prefix length and the point of first collision — it's
not obvious without deriving it, and is a common staff-level follow-up
specifically because the "why does phase two work" reasoning is the real
test, not just reciting the two-phase algorithm.

**Complexity:** `O(n)` time, `O(1)` space — the entire point of this
approach over a `Set`-of-visited-nodes approach (which is `O(n)` time and
`O(n)` space, simpler to write but fails the space constraint).

### Solution

```js
function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((ok ? "✅ PASS" : "❌ FAIL") + " — " + label);
  if (!ok) {
    console.log("   expected:", expected);
    console.log("   actual:  ", actual);
  }
}

function buildList(arr) {
  let head = null;
  let tail = null;
  for (const val of arr) {
    const node = { val, next: null };
    if (!head) {
      head = node;
      tail = node;
    } else {
      tail.next = node;
      tail = node;
    }
  }
  return head;
}

function buildListWithCycle(arr, pos) {
  const nodes = arr.map((val) => ({ val, next: null }));
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].next = nodes[i + 1];
  if (pos >= 0 && nodes.length > 0) {
    nodes[nodes.length - 1].next = nodes[pos];
  }
  return nodes.length > 0 ? nodes[0] : null;
}

function hasCycle(head) {
  let slow = head;
  let fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) return true;
  }
  return false;
}

assertEqual(hasCycle(buildList([1, 2, 3])), false, "straight list, no cycle");
assertEqual(hasCycle(buildListWithCycle([3, 2, 0, -4], 1)), true, "tail wraps back to index 1");
assertEqual(hasCycle(buildListWithCycle([1], 0)), true, "single node pointing to itself");
assertEqual(hasCycle(null), false, "empty list has no cycle");
assertEqual(hasCycle(buildList([1])), false, "single node, no cycle");
```

### Common pitfalls

- Checking `slow === fast` **before** advancing either pointer on the first
  iteration (or initializing them as "equal" without ever moving) — both
  start at `head`, so a naive check at the top of the loop before any
  movement falsely reports a cycle on every input, cyclic or not.
- Guarding the loop with `while (fast)` instead of `while (fast &&
  fast.next)` — `fast.next.next` throws when `fast.next` is `null`, which
  happens on any even-length list with no cycle.
- Comparing node **values** (`slow.val === fast.val`) instead of node
  **references** — two different nodes can legitimately hold the same
  value; the cycle check is fundamentally about identity, not content.

### Staff-level follow-up

**"Same list, but now it's being mutated concurrently by another thread
while you're trying to detect a cycle — does Floyd's algorithm still give
a correct answer?"** No, and this is worth saying plainly rather than
hand-waving past it. Floyd's algorithm assumes a stable structure for the
duration of the walk; if another thread can rewrite `next` pointers mid-walk,
you can get false negatives (a cycle existed when you started but was
broken before `fast` caught up) or outright crashes (`fast.next` read as
`null` partway through a pointer swap that hasn't fully landed, or a node
that was unlinked and garbage collected mid-traversal in a non-GC'd
language). The real fix isn't a cleverer traversal — it's that mutable
shared linked structures need either a lock/snapshot around any traversal,
or a lock-free design with versioned/CAS pointer updates, which is a
meaningfully different (and harder) systems problem than cycle detection
itself.

---

## Problem 5: Merge K Sorted Lists (Hard)

Given an array of `k` linked lists, each already sorted in ascending order,
merge them into a single sorted linked list and return its head.

**Examples**
- `[[1,4,5],[1,3,4],[2,6]]` → `[1,1,2,3,4,4,5,6]`
- `[]` (no lists at all) → `[]`
- `[[],[1]]` (one empty list mixed in) → `[1]`
- `[[1,2,3]]` (only one list) → `[1,2,3]`

**Clarifying questions a staff engineer asks**
- How large is `k` relative to total node count `N`? (Determines whether a
  heap's `O(N log k)` or naive pairwise merging's `O(N*k)` dominates —
  they converge when `k` is small, diverge hard when `k` is large.)
- Can any of the `k` lists be empty or `null`? (Must be filtered out before
  building whatever structure tracks "current smallest across all lists.")
- Can values repeat across lists? (Doesn't change the algorithm, but
  affects what "stable merge order" even means if that's ever a
  requirement — it isn't here, any valid interleaving of equal values is
  fine.)

### Attempt it

```js
function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((ok ? "✅ PASS" : "❌ FAIL") + " — " + label);
  if (!ok) {
    console.log("   expected:", expected);
    console.log("   actual:  ", actual);
  }
}

function buildList(arr) {
  let head = null;
  let tail = null;
  for (const val of arr) {
    const node = { val, next: null };
    if (!head) {
      head = node;
      tail = node;
    } else {
      tail.next = node;
      tail = node;
    }
  }
  return head;
}

function listToArray(head) {
  const out = [];
  let curr = head;
  while (curr) {
    out.push(curr.val);
    curr = curr.next;
  }
  return out;
}

function mergeKLists(lists) {
  // TODO: merge all k sorted lists into one sorted list.
  // Target: O(N log k) time using a min-heap of size k (one candidate node
  // per still-active list), where N = total node count across all lists.
  return null;
}

assertEqual(
  listToArray(mergeKLists([buildList([1, 4, 5]), buildList([1, 3, 4]), buildList([2, 6])])),
  [1, 1, 2, 3, 4, 4, 5, 6],
  "three interleaved sorted lists merge into one sorted list"
);
assertEqual(listToArray(mergeKLists([])), [], "empty array of lists");
assertEqual(
  listToArray(mergeKLists([buildList([]), buildList([1])])),
  [1],
  "one empty list mixed with one non-empty list"
);
assertEqual(
  listToArray(mergeKLists([buildList([1, 2, 3])])),
  [1, 2, 3],
  "single already-sorted list passed through unchanged"
);
assertEqual(
  listToArray(mergeKLists([buildList([5]), buildList([1]), buildList([3])])),
  [1, 3, 5],
  "k single-node lists merge by value"
);
```

### Approach

**Two reasonable approaches exist here; this solution uses a min-heap, not
pairwise divide-and-conquer merging, and here's why.** At any point during
the merge, the next output node is the smallest among the `k` "current
front" nodes of the still-active lists. That's exactly the shape a
min-heap is built for: keep one candidate node per active list in the heap,
pop the smallest, append it to the output, and if that node has a `next`,
push `next` back in as that list's new candidate. There's no built-in heap
in vanilla JS, so this solution implements a small array-based binary
min-heap inline (`push` bubbles up, `pop` swaps the last element to the
root and bubbles down) — this is the same primitive you'd reach for to
k-way-merge sorted files that don't fit in memory, which is the realistic
production version of this problem.

The alternative — pairwise divide-and-conquer (merge lists 2-at-a-time,
recursively) — gets the same `O(N log k)` time bound without hand-rolling a
heap, and is arguably simpler to implement correctly (it only needs the
ordinary two-list merge you already know). It's a completely valid choice;
the heap is preferred here because it generalizes directly to "merge
streams that aren't all known up front" (e.g., `k` live, growing data
sources), where pairwise merging doesn't apply as cleanly.

**Complexity:** `O(N log k)` time (`N` total nodes, heap operations are
`O(log k)` and happen `N` times), `O(k)` space for the heap itself.

### Solution

```js
function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((ok ? "✅ PASS" : "❌ FAIL") + " — " + label);
  if (!ok) {
    console.log("   expected:", expected);
    console.log("   actual:  ", actual);
  }
}

function buildList(arr) {
  let head = null;
  let tail = null;
  for (const val of arr) {
    const node = { val, next: null };
    if (!head) {
      head = node;
      tail = node;
    } else {
      tail.next = node;
      tail = node;
    }
  }
  return head;
}

function listToArray(head) {
  const out = [];
  let curr = head;
  while (curr) {
    out.push(curr.val);
    curr = curr.next;
  }
  return out;
}

// Plain array-based binary min-heap, keyed by node.val. No built-in heap
// exists in vanilla JS, so this is implemented inline.
class MinHeap {
  constructor() {
    this.data = [];
  }
  size() {
    return this.data.length;
  }
  push(node) {
    this.data.push(node);
    let i = this.data.length - 1;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.data[parent].val <= this.data[i].val) break;
      [this.data[parent], this.data[i]] = [this.data[i], this.data[parent]];
      i = parent;
    }
  }
  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      let i = 0;
      const n = this.data.length;
      while (true) {
        const left = 2 * i + 1;
        const right = 2 * i + 2;
        let smallest = i;
        if (left < n && this.data[left].val < this.data[smallest].val) smallest = left;
        if (right < n && this.data[right].val < this.data[smallest].val) smallest = right;
        if (smallest === i) break;
        [this.data[smallest], this.data[i]] = [this.data[i], this.data[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

function mergeKLists(lists) {
  const heap = new MinHeap();
  for (const head of lists) {
    if (head) heap.push(head);
  }

  const dummy = { val: null, next: null };
  let tail = dummy;
  while (heap.size() > 0) {
    const node = heap.pop();
    tail.next = node;
    tail = node;
    if (node.next) heap.push(node.next);
  }
  tail.next = null;
  return dummy.next;
}

assertEqual(
  listToArray(mergeKLists([buildList([1, 4, 5]), buildList([1, 3, 4]), buildList([2, 6])])),
  [1, 1, 2, 3, 4, 4, 5, 6],
  "three interleaved sorted lists merge into one sorted list"
);
assertEqual(listToArray(mergeKLists([])), [], "empty array of lists");
assertEqual(
  listToArray(mergeKLists([buildList([]), buildList([1])])),
  [1],
  "one empty list mixed with one non-empty list"
);
assertEqual(
  listToArray(mergeKLists([buildList([1, 2, 3])])),
  [1, 2, 3],
  "single already-sorted list passed through unchanged"
);
assertEqual(
  listToArray(mergeKLists([buildList([5]), buildList([1]), buildList([3])])),
  [1, 3, 5],
  "k single-node lists merge by value"
);
```

### Common pitfalls

- Pushing `null`/empty lists into the heap without filtering first —
  `node.val` on `null` throws immediately during the first bubble-up
  comparison.
- Forgetting to terminate the output: `tail.next = null` at the end — the
  last node appended still has whatever stale `next` it had from its
  original list (which is fine if it was genuinely the last node of that
  list, i.e. `null` already, but relying on that implicitly instead of
  setting it explicitly is fragile).
- Comparing heap entries by anything other than `.val` (e.g., accidentally
  comparing the node objects themselves) — silently produces whatever
  insertion-order garbage the heap's internal array happened to have,
  not a sorted merge.
- Using `Array.prototype.sort` on a heap-array snapshot as a stand-in for
  real heap operations — gets lucky on small inputs, but it's `O(k log k)`
  per operation instead of `O(log k)`, defeating the entire point of using
  a heap over just concatenating everything and sorting once.

### Staff-level follow-up

**"k is 10,000 and each list has a million nodes, streamed from separate
network sources at different speeds — does this design still hold up?"**
The heap's `O(N log k)` bound still holds algorithmically, but the real
bottleneck becomes **backpressure**, not CPU: if one source is slow, the
heap blocks waiting for that list's next node while the other 9,999
sources keep producing, and you either buffer unboundedly (memory blowup)
or stall the whole merge on the slowest producer. This turns from a pure
algorithms problem into a streaming-systems problem — you'd want each
source wrapped in a bounded buffer/async iterator, the heap pulling
whatever's "ready now" with a timeout policy for stragglers, and an
explicit decision about correctness under a slow or dead source (wait
forever vs. a max-staleness cutoff that trades strict ordering for
liveness). The algorithm you'd whiteboard is a small piece of that actual
system.

---

## Problem 6: LFU Cache (Hard)

Design a data structure that implements a **Least Frequently Used (LFU)**
cache with a fixed capacity, supporting:
- `get(key)` — return the value if present (and count this as one more
  access, incrementing its frequency), else `-1`.
- `put(key, value)` — insert or update; if this exceeds capacity, evict the
  entry with the **lowest access frequency** first. If multiple entries tie
  for lowest frequency, evict the **least recently used** among that tied
  group.

Both operations must run in `O(1)` average time. This is the harder sibling
of the LRU Cache from file 1 of 5 — LRU only needs one ordering dimension
(recency); LFU needs two (frequency, then recency as the tiebreak within a
frequency), which is what makes the data structure genuinely harder, not
just "LRU with a counter bolted on."

**Example sequence** (capacity `2`):
```
put(1, 1)
put(2, 2)
get(1)       -> 1   (key1 freq: 1 -> 2)
put(3, 3)    -> evicts key 2 (freq 1, strictly lower than key1's freq 2)
get(2)       -> -1
get(3)       -> 3   (key3 freq: 1 -> 2)
put(4, 4)    -> key1 and key3 are now BOTH freq 2 — tie-break evicts key1,
                because key1 was accessed less recently than key3 within
                that tied group
get(1)       -> -1
get(3)       -> 3
get(4)       -> 4
```

**Clarifying questions a staff engineer asks**
- On a tie in frequency, is the tiebreak "least recently used" or "first
  inserted, ever" (those differ once a key gets re-accessed)? (Spec says
  least recently used — this is the single detail most likely to be
  implemented wrong.)
- Does `put` on an **existing** key count as an access (bump frequency), or
  only `get`? (Standard LFU semantics: yes, updating a value also bumps
  frequency — both operations signal "this entry is useful.")
- What happens on `put` when capacity is `0`? (Never store anything — worth
  confirming explicitly rather than letting it crash on an empty-bucket
  lookup.)
- Fixed capacity for the cache's lifetime, or can it change after
  construction?

### Attempt it

```js
function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((ok ? "✅ PASS" : "❌ FAIL") + " — " + label);
  if (!ok) {
    console.log("   expected:", expected);
    console.log("   actual:  ", actual);
  }
}

class LFUCache {
  constructor(capacity) {
    // TODO: track capacity and set up whatever gives O(1) get/put with
    // eviction of the LOWEST FREQUENCY entry, tie-broken by LEAST RECENTLY
    // USED among entries tied at that frequency.
    // Target structure: key -> value, key -> frequency, and
    // frequency -> an ordered set of keys (insertion order = recency
    // within that frequency bucket) — a plain Map works for the ordered
    // set since Map iterates in insertion order.
    this.capacity = capacity;
  }
  get(key) {
    // TODO
    return -1;
  }
  put(key, value) {
    // TODO
  }
}

// Test 1: classic LFU sequence (frequency-based eviction, not recency-based).
const cache1 = new LFUCache(2);
const r1 = [];
cache1.put(1, 1);
cache1.put(2, 2);
r1.push(cache1.get(1));    // 1  (key1 freq -> 2)
cache1.put(3, 3);           // evicts key2 (freq1, lower than key1's freq2)
r1.push(cache1.get(2));    // -1 (evicted)
r1.push(cache1.get(3));    // 3  (key3 freq -> 2)
cache1.put(4, 4);            // key1 and key3 both freq2 now -> tie-break evicts key1 (LRU of the tied pair)
r1.push(cache1.get(1));    // -1 (evicted)
r1.push(cache1.get(3));    // 3
r1.push(cache1.get(4));    // 4
assertEqual(r1, [1, -1, 3, -1, 3, 4], "classic LFU sequence with a frequency-tie eviction");

// Test 2: explicit tie-break scenario — two keys reach the SAME frequency,
// the one accessed longer ago must be evicted, not an arbitrary one.
const cache2 = new LFUCache(2);
const r2 = [];
cache2.put(1, 1);
cache2.put(2, 2);          // both freq 1
r2.push(cache2.get(1));   // 1, key1 -> freq 2
r2.push(cache2.get(2));   // 2, key2 -> freq 2 (now tied with key1, but key2 is more recent)
cache2.put(3, 3);          // capacity hit, freq tie at 2 -> evict key1 (least recently used of the tie)
r2.push(cache2.get(1));   // -1 (evicted)
r2.push(cache2.get(2));   // 2
r2.push(cache2.get(3));   // 3
assertEqual(r2, [1, 2, -1, 2, 3], "tie-break between two equal-frequency keys evicts the less recently used one");

// Test 3: edge case — capacity 1, repeated puts to the same key update
// value and frequency without evicting, and a new key evicts the only slot.
const cache3 = new LFUCache(1);
const r3 = [];
cache3.put(1, 1);
r3.push(cache3.get(1)); // 1
cache3.put(1, 10);       // update existing key, no eviction needed
r3.push(cache3.get(1)); // 10
cache3.put(2, 2);        // evicts key1 (only slot available)
r3.push(cache3.get(1)); // -1
r3.push(cache3.get(2)); // 2
assertEqual(r3, [1, 10, -1, 2], "capacity-1 cache: update-in-place then single eviction");

// Test 4: edge case — get on an empty cache, and capacity 0 accepts no entries.
const cache4 = new LFUCache(2);
assertEqual(cache4.get(99), -1, "get on an empty cache returns -1");
const cache5 = new LFUCache(0);
cache5.put(1, 1);
assertEqual(cache5.get(1), -1, "zero-capacity cache never stores anything");
```

### Approach

Three maps, kept in sync on every operation:
- `keyToVal: key -> value`
- `keyToFreq: key -> access count`
- `freqToKeys: frequency -> Map<key, true>` — a `Map` used as an **ordered
  set**. Because `Map` iterates in insertion order, re-inserting a key
  (delete then set) moves it to the "most recent" end of its frequency
  bucket for free, exactly like the LRU solution's trick in file 1 of 5 —
  except here it's one such ordered set *per frequency level*, not one
  global one.

Plus a `minFreq` counter tracking the current lowest frequency present
anywhere in the cache, so eviction never has to scan.

On every access (`get`, or `put` on an existing key), bump the key: remove
it from its current frequency bucket, delete that bucket if it's now empty
(and bump `minFreq` if the emptied bucket *was* `minFreq`), then insert the
key into the `frequency + 1` bucket. On eviction (`put` on a new key when
at capacity), look at `freqToKeys.get(minFreq)` — the **first** key in that
bucket's iteration order is the least recently used among the least
frequently used entries, which is exactly the tiebreak rule. Evict it, then
proceed with the normal insert-as-frequency-1 logic for the new key.

**Complexity:** `O(1)` average time for both `get` and `put` — every step
(map lookup, map delete, map set, reading the first key of an ordered set)
is `O(1)`.

### Solution

```js
function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((ok ? "✅ PASS" : "❌ FAIL") + " — " + label);
  if (!ok) {
    console.log("   expected:", expected);
    console.log("   actual:  ", actual);
  }
}

class LFUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.size = 0;
    this.minFreq = 0;
    this.keyToVal = new Map();   // key -> value
    this.keyToFreq = new Map();  // key -> access frequency
    this.freqToKeys = new Map(); // freq -> Map<key, true>, insertion order = recency within that freq
  }

  _bump(key) {
    const freq = this.keyToFreq.get(key);
    const bucket = this.freqToKeys.get(freq);
    bucket.delete(key);
    if (bucket.size === 0) {
      this.freqToKeys.delete(freq);
      if (this.minFreq === freq) this.minFreq = freq + 1;
    }
    const newFreq = freq + 1;
    this.keyToFreq.set(key, newFreq);
    if (!this.freqToKeys.has(newFreq)) this.freqToKeys.set(newFreq, new Map());
    this.freqToKeys.get(newFreq).set(key, true);
  }

  get(key) {
    if (!this.keyToVal.has(key)) return -1;
    const value = this.keyToVal.get(key);
    this._bump(key);
    return value;
  }

  put(key, value) {
    if (this.capacity <= 0) return;

    if (this.keyToVal.has(key)) {
      this.keyToVal.set(key, value);
      this._bump(key);
      return;
    }

    if (this.size >= this.capacity) {
      const minBucket = this.freqToKeys.get(this.minFreq);
      const evictKey = minBucket.keys().next().value; // least recently used among least frequent
      minBucket.delete(evictKey);
      if (minBucket.size === 0) this.freqToKeys.delete(this.minFreq);
      this.keyToVal.delete(evictKey);
      this.keyToFreq.delete(evictKey);
      this.size--;
    }

    this.keyToVal.set(key, value);
    this.keyToFreq.set(key, 1);
    if (!this.freqToKeys.has(1)) this.freqToKeys.set(1, new Map());
    this.freqToKeys.get(1).set(key, true);
    this.minFreq = 1;
    this.size++;
  }
}

// Test 1: classic LFU sequence (frequency-based eviction, not recency-based).
const cache1 = new LFUCache(2);
const r1 = [];
cache1.put(1, 1);
cache1.put(2, 2);
r1.push(cache1.get(1));    // 1  (key1 freq -> 2)
cache1.put(3, 3);           // evicts key2 (freq1, lower than key1's freq2)
r1.push(cache1.get(2));    // -1 (evicted)
r1.push(cache1.get(3));    // 3  (key3 freq -> 2)
cache1.put(4, 4);            // key1 and key3 both freq2 now -> tie-break evicts key1 (LRU of the tied pair)
r1.push(cache1.get(1));    // -1 (evicted)
r1.push(cache1.get(3));    // 3
r1.push(cache1.get(4));    // 4
assertEqual(r1, [1, -1, 3, -1, 3, 4], "classic LFU sequence with a frequency-tie eviction");

// Test 2: explicit tie-break scenario — two keys reach the SAME frequency,
// the one accessed longer ago must be evicted, not an arbitrary one.
const cache2 = new LFUCache(2);
const r2 = [];
cache2.put(1, 1);
cache2.put(2, 2);          // both freq 1
r2.push(cache2.get(1));   // 1, key1 -> freq 2
r2.push(cache2.get(2));   // 2, key2 -> freq 2 (now tied with key1, but key2 is more recent)
cache2.put(3, 3);          // capacity hit, freq tie at 2 -> evict key1 (least recently used of the tie)
r2.push(cache2.get(1));   // -1 (evicted)
r2.push(cache2.get(2));   // 2
r2.push(cache2.get(3));   // 3
assertEqual(r2, [1, 2, -1, 2, 3], "tie-break between two equal-frequency keys evicts the less recently used one");

// Test 3: edge case — capacity 1, repeated puts to the same key update
// value and frequency without evicting, and a new key evicts the only slot.
const cache3 = new LFUCache(1);
const r3 = [];
cache3.put(1, 1);
r3.push(cache3.get(1)); // 1
cache3.put(1, 10);       // update existing key, no eviction needed
r3.push(cache3.get(1)); // 10
cache3.put(2, 2);        // evicts key1 (only slot available)
r3.push(cache3.get(1)); // -1
r3.push(cache3.get(2)); // 2
assertEqual(r3, [1, 10, -1, 2], "capacity-1 cache: update-in-place then single eviction");

// Test 4: edge case — get on an empty cache, and capacity 0 accepts no entries.
const cache4 = new LFUCache(2);
assertEqual(cache4.get(99), -1, "get on an empty cache returns -1");
const cache5 = new LFUCache(0);
cache5.put(1, 1);
assertEqual(cache5.get(1), -1, "zero-capacity cache never stores anything");
```

### Common pitfalls

- Forgetting to bump `minFreq` when the bucket it points at becomes empty —
  the next eviction then reads a stale, now-nonexistent frequency bucket
  and crashes (or, worse, silently reads `undefined` and skips eviction
  entirely, leaking capacity).
- Treating `put` on an **existing** key as a fresh insert (resetting its
  frequency to 1) instead of bumping it — this is the single most common
  LFU bug: it silently converts the cache into something closer to LRU,
  because every update looks identical to a brand-new entry.
- Using an array (not a `Map`) for each frequency bucket and splicing out
  the evicted/bumped key by `indexOf` — correct, but `O(n)` per operation,
  which fails the `O(1)` requirement; the whole reason to use `Map` here is
  `O(1)` delete-by-key *and* insertion-order iteration simultaneously.
- Getting the tiebreak direction backwards — evicting the **most**
  recently used of a tied frequency group instead of the least. This is
  the exact bug the dedicated tie-break test above is designed to catch;
  it won't show up on a test with no frequency ties.

### Staff-level follow-up

**"This cache is now shared across 50 horizontally-scaled API servers, and
you need roughly-correct LFU eviction without a single point of
contention — how do you adapt this design?"** A single in-process `Map`-based
structure like this one is inherently single-node — sharing it means either
a centralized service (Redis, or similar) fronting every `get`/`put`, which
reintroduces network latency on every cache hit and defeats much of the
point of caching, or accepting a **partitioned, approximate** LFU: shard by
key hash across the 50 servers (each server owns a disjoint key range and
runs this exact algorithm locally, no coordination needed), which gives you
real per-shard LFU with zero contention but no longer tracks a single
global notion of "least frequently used" — a key that's moderately popular
on every shard might be more globally valuable than a key that's extremely
popular on just one shard, and pure sharding can't see that. Getting true
global frequency ranking would require periodically exchanging
approximate frequency counts (e.g., gossip or a shared Count-Min Sketch)
between shards — at which point you've traded perfect local `O(1)` eviction
for a distributed-systems problem, which is the right tradeoff to name
explicitly rather than pretend away.
