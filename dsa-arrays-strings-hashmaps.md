# Arrays, Strings & Hash Maps — DSA Practice (1 of 5)

This file (and the four siblings covering sliding window/two pointers,
binary search, trees/BFS/DFS, and stacks/queues/linked lists) follows a
different loop than the theory deep-dives: **attempt, then verify**, not
predict-then-verify. Every problem gives you a function stub that fails on
purpose — press **▶ Run**, watch it fail, fix the body yourself, re-run
until every assertion is `✅ PASS`. Only after that do you get the reference
solution in its own block, so you can diff your approach against it. The
test harness (`assertEqual`) is duplicated into every block on purpose:
each `js` block runs in total isolation (no shared imports across blocks),
so copy-paste-run has to work standalone every time.

At staff level, nobody cares that you can produce the optimal solution from
memory — they care whether you can derive it, state its complexity
correctly, and reason about what changes under different constraints
(memory-bound input, concurrent access, streaming data). Every problem ends
with that follow-up question; answering it out loud is the actual practice.

## Table of Contents

- [Problem 1: Two Sum (Easy)](#problem-1-two-sum-easy)
- [Problem 2: Group Anagrams (Medium)](#problem-2-group-anagrams-medium)
- [Problem 3: Longest Substring Without Repeating Characters (Medium)](#problem-3-longest-substring-without-repeating-characters-medium)
- [Problem 4: Top K Frequent Elements (Medium)](#problem-4-top-k-frequent-elements-medium)
- [Problem 5: Product of Array Except Self (Medium)](#problem-5-product-of-array-except-self-medium)
- [Problem 6: LRU Cache (Hard)](#problem-6-lru-cache-hard)

---

## Problem 1: Two Sum (Easy)

Given an array of integers `nums` and an integer `target`, return the
indices of the two numbers that add up to `target`. Exactly one valid pair
exists. You may not use the same element twice.

**Examples**
- `nums = [2, 7, 11, 15], target = 9` → `[0, 1]` (`2 + 7`)
- `nums = [3, 2, 4], target = 6` → `[1, 2]` (`2 + 4`)
- `nums = [3, 3], target = 6` → `[0, 1]`

**Clarifying questions a staff engineer asks**
- Is the array sorted? (If yes, two pointers beats a hash map on space.)
- Can `nums` contain negative numbers or duplicates? (Both allowed here —
  it changes what "complement already seen" means.)
- Is there guaranteed to be exactly one solution, or do I need to handle
  zero/multiple matches?
- What's the expected scale — is `O(n²)` genuinely unacceptable, or is this
  a warm-up before a harder follow-up?

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

function twoSum(nums, target) {
  // TODO: return [i, j] (i < j) such that nums[i] + nums[j] === target.
  // Target: single pass, O(n) time, using a hash map of value -> index.
  return [];
}

assertEqual(twoSum([2, 7, 11, 15], 9), [0, 1], "basic case");
assertEqual(twoSum([3, 2, 4], 6), [1, 2], "target not at the start");
assertEqual(twoSum([3, 3], 6), [0, 1], "duplicate values");
```

### Approach

Brute force checks every pair: `O(n²)` time, `O(1)` space. The hash map
trick trades space for time: walk the array once, and before inserting the
current value, check whether its **complement** (`target - nums[i]`) was
already seen. If it was, you've found your pair in one pass — you never
need to look ahead, only behind.

**Complexity:** `O(n)` time, `O(n)` space (worst case, every value distinct
and unseen until the last element).

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

function twoSum(nums, target) {
  const seen = new Map(); // value -> index
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) return [seen.get(complement), i];
    seen.set(nums[i], i);
  }
  return [];
}

assertEqual(twoSum([2, 7, 11, 15], 9), [0, 1], "basic case");
assertEqual(twoSum([3, 2, 4], 6), [1, 2], "target not at the start");
assertEqual(twoSum([3, 3], 6), [0, 1], "duplicate values");
```

### Common pitfalls

- Inserting `nums[i]` into the map **before** checking its complement —
  this silently allows an element to pair with itself when `target === 2 *
  nums[i]`, which is invalid (the problem requires two *distinct* indices).
- Returning values instead of indices (easy to misread the problem).
- Assuming sorted input and reaching for two pointers when the array isn't
  actually sorted.

### Staff-level follow-up

**"What if `nums` is sorted and doesn't fit in memory, streamed from
disk?"** Two pointers needs random access to both ends, which a stream
doesn't give you cheaply. The hash-map approach generalizes better here:
process the stream once, keep a bounded or disk-backed map of value→index.
If the data is sorted *and* fits on disk with random access (e.g.,
memory-mapped), two pointers from both ends still works with `O(1)`
auxiliary memory — the real question is which constraint (memory vs. random
access) is actually binding.

---

## Problem 2: Group Anagrams (Medium)

Given an array of strings, group the ones that are anagrams of each other.
Return the groups in any order, but each group's strings should preserve
their original relative order (for testability here, groups are returned
in first-seen order).

**Examples**
- `["eat", "tea", "tan", "ate", "nat", "bat"]` →
  `[["eat","tea","ate"], ["tan","nat"], ["bat"]]`
- `[""]` → `[[""]]`
- `["a"]` → `[["a"]]`

**Clarifying questions a staff engineer asks**
- What's the alphabet — ASCII lowercase only, or full Unicode? (Sorting
  Unicode graphemes correctly is not the same as sorting UTF-16 code
  units — surrogate pairs and combining characters can sort "wrong" with a
  naive `.sort()`.)
- Average string length vs. number of strings — does that change whether
  sorting each string (`O(k log k)`) or counting characters (`O(k)`) wins?
- Is memory or latency the binding constraint? (Changes whether you'd ever
  consider a rolling/incremental hash instead of a full key per string.)

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

function groupAnagrams(strs) {
  // TODO: group strings that are anagrams of each other.
  // Target: O(n * k log k) time (n = strs.length, k = avg string length),
  // using a hash map keyed by each string's canonical (sorted) form.
  return [];
}

assertEqual(
  groupAnagrams(["eat", "tea", "tan", "ate", "nat", "bat"]),
  [["eat", "tea", "ate"], ["tan", "nat"], ["bat"]],
  "groups anagrams, preserving first-seen order"
);
assertEqual(groupAnagrams([""]), [[""]], "single empty string");
assertEqual(groupAnagrams(["a"]), [["a"]], "single character");
```

### Approach

Two strings are anagrams iff they have the same multiset of characters.
Sorting each string's characters produces a canonical key that's identical
for every anagram in the group — use that key in a `Map<string, string[]>`.

A faster-per-string alternative for small fixed alphabets (e.g., lowercase
English): build a 26-length character-count array and join it into a key
string (`"2,0,1,0,..."`). That's `O(k)` per string instead of `O(k log k)`,
at the cost of a longer, less human-readable key and an alphabet
assumption baked into the code.

**Complexity (sort-key version):** `O(n * k log k)` time, `O(n * k)` space.

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

function groupAnagrams(strs) {
  const groups = new Map(); // sortedKey -> original strings
  for (const s of strs) {
    const key = s.split("").sort().join("");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  return [...groups.values()];
}

assertEqual(
  groupAnagrams(["eat", "tea", "tan", "ate", "nat", "bat"]),
  [["eat", "tea", "ate"], ["tan", "nat"], ["bat"]],
  "groups anagrams, preserving first-seen order"
);
assertEqual(groupAnagrams([""]), [[""]], "single empty string");
assertEqual(groupAnagrams(["a"]), [["a"]], "single character");
```

### Common pitfalls

- Using `strs.sort()` on the *array itself* instead of sorting each
  string's characters — that sorts the list of words alphabetically, which
  has nothing to do with anagram grouping.
- Forgetting `Map` preserves insertion order in JS (spec-guaranteed since
  ES2015) and reaching for a plain object, which stringifies numeric-looking
  keys and has historically inconsistent ordering guarantees for edge
  cases — not a problem here, but worth knowing *why* `Map` is the safer
  default for "preserve insertion order" logic.

### Staff-level follow-up

**"What changes if there are a billion strings and you can't hold them all
in memory?"** This becomes a classic external grouping/shuffle problem:
hash each string's canonical key, partition strings across files/buckets by
`hash(key) % numBuckets`, then group within each bucket (which now fits in
memory) independently. This is the same shape as a MapReduce shuffle
phase — the canonical key *is* the map output key.

---

## Problem 3: Longest Substring Without Repeating Characters (Medium)

Given a string `s`, find the length of the longest substring without
repeating characters.

**Examples**
- `"abcabcbb"` → `3` (`"abc"`)
- `"bbbbb"` → `1` (`"b"`)
- `"pwwkew"` → `3` (`"wke"` — note it's a *substring*, not subsequence, so
  `"pwke"` doesn't count)
- `""` → `0`

**Clarifying questions a staff engineer asks**
- Substring (contiguous) or subsequence? (Completely different problem —
  this one is contiguous, which is what makes sliding window applicable.)
- Case-sensitive? Full Unicode or ASCII?
- Do I need the substring itself or just its length? (Changes what the
  window needs to track.)

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

function lengthOfLongestSubstring(s) {
  // TODO: return the length of the longest substring with no repeated
  // characters. Target: O(n) time using a sliding window + hash map of
  // char -> most recent index.
  return 0;
}

assertEqual(lengthOfLongestSubstring("abcabcbb"), 3, "repeats cycle back");
assertEqual(lengthOfLongestSubstring("bbbbb"), 1, "all same character");
assertEqual(lengthOfLongestSubstring("pwwkew"), 3, "substring, not subsequence");
assertEqual(lengthOfLongestSubstring(""), 0, "empty string");
```

### Approach

This is technically a sliding-window problem living here because the
window state *is* a hash map (`char -> last index seen`) — it's the bridge
problem into the next file. Brute force checks every substring: `O(n²)` or
`O(n³)` depending on how you check uniqueness. The window approach expands
`end` one character at a time; when a repeat is found *inside the current
window* (not just "seen before, ever" — this distinction is the #1 bug),
jump `start` forward to just past that repeat's last occurrence, not back
to zero and not by one.

**Complexity:** `O(n)` time — each character is visited by `end` once, and
`start` only ever moves forward. `O(min(n, alphabet size))` space.

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

function lengthOfLongestSubstring(s) {
  const lastSeen = new Map(); // char -> most recent index
  let start = 0;
  let best = 0;
  for (let end = 0; end < s.length; end++) {
    const ch = s[end];
    // Only react to a repeat if it's INSIDE the current window — a char
    // seen long ago, before `start`, is irrelevant and already excluded.
    if (lastSeen.has(ch) && lastSeen.get(ch) >= start) {
      start = lastSeen.get(ch) + 1;
    }
    lastSeen.set(ch, end);
    best = Math.max(best, end - start + 1);
  }
  return best;
}

assertEqual(lengthOfLongestSubstring("abcabcbb"), 3, "repeats cycle back");
assertEqual(lengthOfLongestSubstring("bbbbb"), 1, "all same character");
assertEqual(lengthOfLongestSubstring("pwwkew"), 3, "substring, not subsequence");
assertEqual(lengthOfLongestSubstring(""), 0, "empty string");
```

### Common pitfalls

- Resetting `start` to `0` on any repeat instead of to `lastSeen.get(ch) +
  1` — this degrades to `O(n²)` and gives wrong answers for strings with
  multiple distinct repeats (e.g., `"abba"`).
- The exact bug `lastSeen.has(ch)` without the `>= start` guard: a
  character seen *before* the current window started is stale information
  and must not move `start` backward or re-trigger a jump.

### Staff-level follow-up

**"Same problem, but now find the longest substring with *at most K*
repeating characters allowed — how does the window logic change?"** You now
need a full frequency count inside the window, not just "last seen index."
Shrink `start` while `distinctChars.size > k` (or similar constraint on
counts), incrementing/decrementing counts as the window moves rather than
recomputing from scratch — the general pattern for every "longest window
satisfying constraint X" problem.

---

## Problem 4: Top K Frequent Elements (Medium)

Given an integer array `nums` and an integer `k`, return the `k` most
frequent elements.

**Examples**
- `nums = [1,1,1,2,2,3], k = 2` → `[1, 2]`
- `nums = [1], k = 1` → `[1]`
- `nums = [4,4,4,6,6,2], k = 2` → `[4, 6]`

**Clarifying questions a staff engineer asks**
- Are ties possible, and if so, is any valid order of tied elements
  acceptable, or is there a tiebreak rule (first-seen, smallest value)?
- Is `k` always `<=` the number of distinct elements?
- Is `O(n log n)` (sort by frequency) genuinely too slow, or is bucket sort
  only needed to hit `O(n)`?

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

function topKFrequent(nums, k) {
  // TODO: return the k most frequent elements.
  // Target: O(n) time using counting + bucket sort by frequency
  // (buckets indexed 0..n, since max possible frequency is n).
  return [];
}

assertEqual(topKFrequent([1, 1, 1, 2, 2, 3], 2), [1, 2], "two tiers of frequency");
assertEqual(topKFrequent([1], 1), [1], "single element");
assertEqual(topKFrequent([4, 4, 4, 6, 6, 2], 2), [4, 6], "distinct frequency tiers");
```

### Approach

Count frequencies with a hash map: `O(n)`. Sorting distinct values by
frequency is `O(d log d)` (`d` = distinct count) — fine, but a heap of size
`k` (`O(d log k)`) or **bucket sort** (`O(n)` overall) beats it when you
need the true linear bound. Bucket sort works because frequency is bounded
by `n`: make an array of `n + 1` buckets, bucket `f` holds every value with
frequency `f`, then walk buckets from highest to lowest collecting values
until you have `k`.

**Complexity:** `O(n)` time, `O(n)` space (bucket array dominates).

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

function topKFrequent(nums, k) {
  const counts = new Map();
  for (const n of nums) counts.set(n, (counts.get(n) || 0) + 1);

  const buckets = Array.from({ length: nums.length + 1 }, () => []);
  for (const [value, freq] of counts) buckets[freq].push(value);

  const result = [];
  for (let freq = buckets.length - 1; freq >= 1 && result.length < k; freq--) {
    for (const value of buckets[freq]) {
      result.push(value);
      if (result.length === k) break;
    }
  }
  return result;
}

assertEqual(topKFrequent([1, 1, 1, 2, 2, 3], 2), [1, 2], "two tiers of frequency");
assertEqual(topKFrequent([1], 1), [1], "single element");
assertEqual(topKFrequent([4, 4, 4, 6, 6, 2], 2), [4, 6], "distinct frequency tiers");
```

### Common pitfalls

- Sorting the full `[value, freq]` entries array and calling it `O(n)` — a
  comparison sort is `O(d log d)` at best; only bucket placement (no
  comparisons) gets you true linear time, and only because frequency has a
  known bound (`n`).
- Off-by-one on bucket array size — frequency can legitimately equal `n`
  (every element identical), so the array needs `n + 1` slots, not `n`.

### Staff-level follow-up

**"What if this needs to run continuously over a live, unbounded stream —
`topK` queried repeatedly as new elements arrive?"** Exact counts over an
unbounded stream need unbounded memory. In practice you'd reach for an
approximate structure — a **Count-Min Sketch** for frequency estimates plus
a bounded min-heap of current top-k candidates — trading exactness for
`O(1)`-ish update time and fixed memory. This is the point where "just use
a hash map" stops being the right answer, and it's worth saying so
explicitly rather than forcing the exact-count approach onto a problem it
no longer fits.

---

## Problem 5: Product of Array Except Self (Medium)

Given an integer array `nums`, return an array `result` where `result[i]`
equals the product of every element in `nums` except `nums[i]`. You must
do this **without division** and in `O(n)` time.

**Examples**
- `[1, 2, 3, 4]` → `[24, 12, 8, 6]`
- `[-1, 1, 0, -3, 3]` → `[0, 0, 9, 0, 0]`

**Clarifying questions a staff engineer asks**
- Why no division? (Because zeros in the input make "total product ÷
  nums[i]" undefined or wrong — worth stating this is *why* the
  constraint exists, not just complying with it blindly.)
- Is extra `O(n)` space for the output array itself acceptable, or does
  "constant extra space" mean literally no auxiliary array beyond the
  required output?
- Can values overflow a 32-bit int in a language that cares about that?
  (Not an issue in JS's doubles until very large inputs, but it's the kind
  of constraint a staff interview expects you to flag.)

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

function productExceptSelf(nums) {
  // TODO: return result[i] = product of all nums except nums[i].
  // No division. Target: O(n) time, O(1) EXTRA space (beyond the output
  // array) using a prefix-products pass then a suffix-products pass.
  return [];
}

assertEqual(productExceptSelf([1, 2, 3, 4]), [24, 12, 8, 6], "no zeros");
assertEqual(productExceptSelf([-1, 1, 0, -3, 3]), [0, 0, 9, 0, 0], "contains a zero");
```

### Approach

`result[i]` is "product of everything to the left" × "product of
everything to the right." Compute prefix products left-to-right into
`result` directly (no extra array), then do a second pass right-to-left
multiplying in the running suffix product. Two passes, one array, no
division, and zeros are handled automatically — a zero anywhere just zeroes
out every result position except its own.

**Complexity:** `O(n)` time, `O(1)` extra space (the output array doesn't
count against the "constant space" constraint — it's the required return
value).

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

function productExceptSelf(nums) {
  const n = nums.length;
  const result = new Array(n).fill(1);

  let prefix = 1;
  for (let i = 0; i < n; i++) {
    result[i] = prefix;
    prefix *= nums[i];
  }

  let suffix = 1;
  for (let i = n - 1; i >= 0; i--) {
    result[i] *= suffix;
    suffix *= nums[i];
  }

  return result;
}

assertEqual(productExceptSelf([1, 2, 3, 4]), [24, 12, 8, 6], "no zeros");
assertEqual(productExceptSelf([-1, 1, 0, -3, 3]), [0, 0, 9, 0, 0], "contains a zero");
```

### Common pitfalls

- Reaching for `totalProduct / nums[i]` — breaks immediately on any zero
  input, and the constraint explicitly forbids division anyway.
- Using two separate arrays for prefix and suffix products instead of
  folding the suffix pass directly into `result` — works, but fails the
  `O(1)` extra space bar if that's actually required.

### Staff-level follow-up

**"What if there are two zeros in the input?"** Walk through it: every
`result[i]` where `i` isn't one of the zero indices gets multiplied by
`0` in either the prefix or suffix pass (whichever zero is on its side),
so it becomes `0`. The two zero positions themselves also get `0`, because
each one's product excludes itself but *includes* the other zero. Net
result: the entire output is all zeros — worth stating out loud rather than
assuming, since it's a one-line change in reasoning that's easy to get
wrong under pressure.

---

## Problem 6: LRU Cache (Hard)

Design a data structure that implements a **Least Recently Used (LRU)**
cache with a fixed capacity, supporting:
- `get(key)` — return the value if present (and mark it as recently used),
  else `-1`.
- `put(key, value)` — insert or update; if this exceeds capacity, evict the
  least recently used entry first.

Both operations must run in `O(1)` average time.

**Example sequence** (capacity `2`):
```
put(1, 1)
put(2, 2)
get(1)       -> 1
put(3, 3)    -> evicts key 2 (1 was just used, 2 wasn't)
get(2)       -> -1
put(4, 4)    -> evicts key 1
get(1)       -> -1
get(3)       -> 3
get(4)       -> 4
```

**Clarifying questions a staff engineer asks**
- Does `get` count as a "use" that resets recency? (Yes, per the spec
  above — this is the detail most likely to be assumed wrong.)
- Single-threaded, or does this need to be safe under concurrent
  access? (Changes everything — see the follow-up.)
- Fixed capacity for the cache's lifetime, or does `capacity` ever change
  after construction?
- Is `O(1)` *average* (hash map amortized) acceptable, or strictly
  worst-case guaranteed?

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

class LRUCache {
  constructor(capacity) {
    // TODO: track capacity and set up whatever structure gives O(1)
    // get/put with eviction of the LEAST recently used entry.
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

const cache = new LRUCache(2);
cache.put(1, 1);
cache.put(2, 2);
const results = [];
results.push(cache.get(1));    // 1
cache.put(3, 3);                // evicts key 2
results.push(cache.get(2));    // -1
cache.put(4, 4);                 // evicts key 1
results.push(cache.get(1));    // -1
results.push(cache.get(3));    // 3
results.push(cache.get(4));    // 4

assertEqual(results, [1, -1, -1, 3, 4], "full LRU sequence");
```

### Approach

The textbook answer is a hash map (key → node) plus a doubly linked list
ordered by recency, so both "move to front" and "evict from back" are
`O(1)` pointer rewrites with no array shifting.

There's a JS-specific shortcut worth knowing *and* being able to justify:
`Map` is spec-guaranteed (ECMA-262) to iterate in **insertion order**, and
re-inserting an existing key (`delete` then `set`) moves it to the end of
that order. That gives you LRU recency ordering for free — `.keys().next()`
reads the least-recently-used key in `O(1)`. This is legitimate production
code, not a trick — but in an interview, say explicitly that you know the
"real" `O(1)` mechanism is a hand-rolled doubly linked list, and that
you're choosing `Map` because the guarantee is real and the code is
simpler. An interviewer who wants to see you build the linked list by hand
will ask you to drop the "no language sugar" constraint on top.

**Complexity:** `O(1)` average for both `get` and `put`.

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

class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map(); // insertion order == recency order
  }
  get(key) {
    if (!this.map.has(key)) return -1;
    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value); // re-insert = mark most recently used
    return value;
  }
  put(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.capacity) {
      const oldestKey = this.map.keys().next().value; // least recently used
      this.map.delete(oldestKey);
    }
  }
}

const cache = new LRUCache(2);
cache.put(1, 1);
cache.put(2, 2);
const results = [];
results.push(cache.get(1));
cache.put(3, 3);
results.push(cache.get(2));
cache.put(4, 4);
results.push(cache.get(1));
results.push(cache.get(3));
results.push(cache.get(4));

assertEqual(results, [1, -1, -1, 3, 4], "full LRU sequence");
```

### Common pitfalls

- Forgetting that `get` must also refresh recency — a cache where only
  `put` affects ordering isn't LRU, it's insertion-order eviction (closer
  to FIFO).
- With the hand-rolled doubly-linked-list version: forgetting to update
  **both** neighbor pointers when unlinking a node (classic off-by-one that
  corrupts the list silently rather than crashing, which makes it worse).
- Evicting from the wrong end — most-recently-used and
  least-recently-used are easy to swap under pressure; name your sentinel
  nodes `head`/`tail` consistently and pick one end for "most recent," then
  never deviate.

### Staff-level follow-up

**"This cache now needs to be safe under concurrent reads and writes from
multiple threads/requests — what breaks, and how do you fix it?"** Every
mutation here (`Map.delete` + `Map.set`, or linked-list pointer rewrites)
is multiple non-atomic steps. Two concurrent `put`s can interleave and
corrupt the structure (e.g., both read "size > capacity" as true,
decide to evict, and the eviction logic races). The fix is a single
coarse-grained lock around `get`/`put` (simple, but serializes all
access — a real throughput cost for a cache meant to reduce latency), or a
sharded cache (hash the key to one of `N` independently-locked shards,
trading perfect global LRU ordering for concurrency). This is the exact
moment a "cache the implementation" interview question turns into a
systems question about lock granularity and throughput tradeoffs — which
is precisely why it shows up at staff level.
