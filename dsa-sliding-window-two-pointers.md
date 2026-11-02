# Sliding Window & Two Pointers — DSA Practice (2 of 5)

These two techniques get taught together because they solve the same
underlying problem from opposite directions: both eliminate the redundant
re-scanning that makes a naive approach `O(n²)`. A **sliding window** fixes
one or both edges of a subrange and slides them across the input, reusing
the previous position's work instead of recomputing from scratch. **Two
pointers** walks inward from both ends (or outward from a pivot), using an
ordering invariant in the data to rule out large chunks of the search space
with a single comparison. Same loop as the first file: every problem gives
you a stub that fails on purpose — fix it, get every assertion to `✅ PASS`,
then diff your approach against the reference solution.

## Table of Contents

- [Problem 1: Maximum Sum Subarray of Size K (Easy)](#problem-1-maximum-sum-subarray-of-size-k-easy)
- [Problem 2: Container With Most Water (Medium)](#problem-2-container-with-most-water-medium)
- [Problem 3: 3Sum (Medium)](#problem-3-3sum-medium)
- [Problem 4: Longest Repeating Character Replacement (Medium)](#problem-4-longest-repeating-character-replacement-medium)
- [Problem 5: Trapping Rain Water (Hard)](#problem-5-trapping-rain-water-hard)
- [Problem 6: Minimum Window Substring (Hard)](#problem-6-minimum-window-substring-hard)

---

## Problem 1: Maximum Sum Subarray of Size K (Easy)

Given an integer array `nums` and an integer `k`, find the maximum sum of
any **contiguous subarray of exactly size `k`**. If `k` is larger than
`nums.length` (or non-positive), there is no valid window — return `null`.

**Examples**
- `nums = [2, 1, 5, 1, 3, 2], k = 3` → `9` (`5 + 1 + 3`)
- `nums = [2, 3, 4, 1, 5], k = 2` → `7` (`3 + 4`)
- `nums = [5], k = 1` → `5`
- `nums = [1, 2], k = 5` → `null` (window doesn't fit)

**Clarifying questions a staff engineer asks**
- Can `nums` contain negatives? (Changes nothing about the algorithm, but
  changes what "obviously wrong" output looks like during debugging.)
- What's the contract when `k > nums.length` — throw, return `null`, return
  `-Infinity`? Undefined behavior here is exactly the kind of thing that
  turns into a production incident.
- Is `k` fixed for the lifetime of the call, or does this need to answer
  "max sum for every `k` from 1 to n" — that's a different (and much
  harder) problem.

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

function maxSumSubarray(nums, k) {
  // TODO: return the max sum of any contiguous subarray of exactly size k,
  // or null if k is invalid for this array.
  // Target: O(n) time using a fixed-size sliding window — compute the
  // first window's sum once, then slide by subtracting the element that
  // falls out and adding the one that enters.
  return null;
}

assertEqual(maxSumSubarray([2, 1, 5, 1, 3, 2], 3), 9, "basic window of 3");
assertEqual(maxSumSubarray([2, 3, 4, 1, 5], 2), 7, "window of 2");
assertEqual(maxSumSubarray([5], 1), 5, "single element, k=1");
assertEqual(maxSumSubarray([1, 2], 5), null, "k larger than array");
```

### Approach

Brute force recomputes the sum of every window from scratch: `O(n * k)`
time. But consecutive windows overlap in `k - 1` elements — there's no
reason to re-add them. Compute the first window's sum once, then slide
one position at a time: subtract the element leaving the window (left
edge), add the element entering it (new right edge). This is the canonical
fixed-size sliding window — the window never grows or shrinks, it only
translates.

**Complexity:** `O(n)` time, `O(1)` space.

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

function maxSumSubarray(nums, k) {
  if (k <= 0 || k > nums.length) return null;

  let windowSum = 0;
  for (let i = 0; i < k; i++) windowSum += nums[i];
  let best = windowSum;

  for (let i = k; i < nums.length; i++) {
    windowSum += nums[i] - nums[i - k]; // slide: add new, drop old
    best = Math.max(best, windowSum);
  }
  return best;
}

assertEqual(maxSumSubarray([2, 1, 5, 1, 3, 2], 3), 9, "basic window of 3");
assertEqual(maxSumSubarray([2, 3, 4, 1, 5], 2), 7, "window of 2");
assertEqual(maxSumSubarray([5], 1), 5, "single element, k=1");
assertEqual(maxSumSubarray([1, 2], 5), null, "k larger than array");
```

### Common pitfalls

- Recomputing the sum from scratch on every slide (`O(n * k)`) instead of
  incrementally adjusting it — defeats the point of the technique.
- Off-by-one on the index of the element being dropped: it's `nums[i - k]`
  relative to the new right edge `i`, not `nums[i - k - 1]` or `nums[i - k + 1]`.
- Not handling `k > nums.length` explicitly — silently returning `0` or an
  incorrect sum instead of signaling "no valid window" is a correctness bug,
  not just a style nit.

### Staff-level follow-up

**"What if `k` isn't fixed — a caller passes a stream of `(index, k)`
queries and expects each answered in sublinear time?"** A single fixed-size
window answers one `k` in `O(n)`, but it discards all that work once `k`
changes. If the query set is known up front, precompute a prefix-sum array
once (`O(n)`) and answer every query in `O(n)` total by sliding windows of
each distinct `k` over the prefix sums — still linear overall, not
per-query. If queries are truly arbitrary and online, you're bounded by
`O(n)` per distinct `k` unless you accept approximate answers or restrict
the query shape (e.g., sparse table for range-max instead of range-sum,
which trades exactness in the operation you can support for `O(1)` query
time after `O(n log n)` preprocessing).

---

## Problem 2: Container With Most Water (Medium)

Given an array `height` where `height[i]` is the height of a vertical line
at position `i`, find two lines that, together with the x-axis, form a
container holding the maximum amount of water. Return that max area.

**Examples**
- `[1, 8, 6, 2, 5, 4, 8, 3, 7]` → `49` (lines at index 1 and 8: `min(8, 7) * 7`)
- `[1, 1]` → `1`
- `[1, 2, 1]` → `2` (lines at index 0 and 2: `min(1, 1) * 2`)

**Clarifying questions a staff engineer asks**
- Can heights be `0` or negative? (`0` is fine — it just means that line
  holds no water on its own but can still be one side of a container;
  negative heights usually indicate the problem means something other than
  "elevation" and is worth confirming.)
- Is the answer the *area* between two lines, or literal trapped water
  volume accounting for every line in between? (This problem is the
  former — that distinction is exactly what separates it from Trapping
  Rain Water below.)
- Are ties in height common enough to matter for which pointer moves, or
  is this array effectively random?

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

function maxArea(height) {
  // TODO: return the max area of water two lines can hold.
  // Target: O(n) time using two pointers starting at both ends, moving
  // the pointer at the SHORTER line inward each step.
  return 0;
}

assertEqual(maxArea([1, 8, 6, 2, 5, 4, 8, 3, 7]), 49, "classic example");
assertEqual(maxArea([1, 1]), 1, "two equal-height lines");
assertEqual(maxArea([1, 2, 1]), 2, "three lines");
```

### Approach

Brute force checks every pair of lines: `O(n²)`. Two pointers starting at
both ends does better by using a simple proof: for the current pair
`(left, right)`, the area is bounded by `min(height[left], height[right])`.
If `height[left] < height[right]`, moving `right` inward can never produce
a *larger* area with this `left` — the bottleneck is still `height[left]`
or worse, and the width only shrinks. So the only pointer worth moving is
the shorter one; moving it is the only way to possibly find a taller line
that raises the bottleneck. This rules out an entire set of pairs in one
comparison without ever checking them.

**Complexity:** `O(n)` time, `O(1)` space.

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

function maxArea(height) {
  let left = 0;
  let right = height.length - 1;
  let best = 0;

  while (left < right) {
    const area = Math.min(height[left], height[right]) * (right - left);
    best = Math.max(best, area);
    if (height[left] < height[right]) {
      left++;
    } else {
      right--;
    }
  }
  return best;
}

assertEqual(maxArea([1, 8, 6, 2, 5, 4, 8, 3, 7]), 49, "classic example");
assertEqual(maxArea([1, 1]), 1, "two equal-height lines");
assertEqual(maxArea([1, 2, 1]), 2, "three lines");
```

### Common pitfalls

- Moving both pointers every iteration instead of only the shorter one —
  this skips valid pairs and can miss the true maximum.
- Moving the *taller* line's pointer "to be safe" — this is backwards from
  the proof above and throws away the only pointer move that could help.
- Forgetting the loop terminates at `left < right`, not `left <= right` —
  a line can't pair with itself.

### Staff-level follow-up

**"What if heights can be updated after construction and `maxArea` is
queried repeatedly — do you recompute from scratch every time?"** The two
pointer approach is inherently a full-array scan per query — no shortcut
makes it incremental under arbitrary updates, because a single height
change anywhere can shift which pair is optimal in ways that aren't
locally predictable. If updates are frequent and queries need to be fast,
this stops being a two-pointer problem and becomes a different one:
options include a sparse table or segment tree over suffix/prefix maxima
to answer "tallest line in range" quickly, combined with some
structure-specific insight about this problem (the optimal pair's width vs.
height tradeoff) to avoid still needing `O(n)` per query — worth saying
explicitly that the clean `O(n)` two-pointer solution doesn't generalize to
the "repeated queries under mutation" variant without real additional
machinery.

---

## Problem 3: 3Sum (Medium)

Given an integer array `nums`, return all unique triplets `[a, b, c]` such
that `a + b + c === 0`. The solution set must not contain duplicate
triplets.

**Examples**
- `[-1, 0, 1, 2, -1, -4]` → `[[-1, -1, 2], [-1, 0, 1]]`
- `[0, 1, 1]` → `[]` (no triplet sums to zero)
- `[0, 0, 0]` → `[[0, 0, 0]]`

**Clarifying questions a staff engineer asks**
- Does triplet order within each result matter, or just the multiset of
  values? (For testability here, each triplet is returned sorted
  ascending.)
- Does the order of triplets in the outer result matter? (No — but it must
  be deterministic enough to test, which sorting the input gives for free.)
- How many duplicate values should I expect — is dedup overhead
  (`O(n log n)` sort plus skip-logic) actually negligible, or could a
  pathological all-duplicates input make skip-logic the real bottleneck?

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

function threeSum(nums) {
  // TODO: return all unique triplets summing to zero, each sorted
  // ascending, outer array in any order (first-found order is fine).
  // Target: O(n²) time — sort once (O(n log n)), then for each fixed
  // first element, run two pointers over the remaining sorted range.
  return [];
}

assertEqual(
  threeSum([-1, 0, 1, 2, -1, -4]),
  [[-1, -1, 2], [-1, 0, 1]],
  "classic example"
);
assertEqual(threeSum([0, 1, 1]), [], "no valid triplet");
assertEqual(threeSum([0, 0, 0]), [[0, 0, 0]], "all zeros");
```

### Approach

Brute force is three nested loops: `O(n³)`, plus a set to dedup. Sorting
first unlocks something better: fix the first element `nums[i]`, then the
remaining problem — "find two elements in the rest of the (sorted) array
summing to `-nums[i]`" — is exactly Two Sum on a sorted array, solvable
with two pointers in `O(n)`. Doing that for every `i` gives `O(n²)` total.
Sorting also makes dedup nearly free: skip `i` if it equals the previous
`i`, and after finding a match, skip past any equal values at `left` and
`right` before continuing.

**Complexity:** `O(n²)` time, `O(log n)` to `O(n)` space depending on the
sort implementation (ignoring output size).

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

function threeSum(nums) {
  const arr = [...nums].sort((a, b) => a - b);
  const result = [];

  for (let i = 0; i < arr.length - 2; i++) {
    if (i > 0 && arr[i] === arr[i - 1]) continue; // skip duplicate first element

    let left = i + 1;
    let right = arr.length - 1;
    while (left < right) {
      const sum = arr[i] + arr[left] + arr[right];
      if (sum === 0) {
        result.push([arr[i], arr[left], arr[right]]);
        while (left < right && arr[left] === arr[left + 1]) left++;
        while (left < right && arr[right] === arr[right - 1]) right--;
        left++;
        right--;
      } else if (sum < 0) {
        left++;
      } else {
        right--;
      }
    }
  }
  return result;
}

assertEqual(
  threeSum([-1, 0, 1, 2, -1, -4]),
  [[-1, -1, 2], [-1, 0, 1]],
  "classic example"
);
assertEqual(threeSum([0, 1, 1]), [], "no valid triplet");
assertEqual(threeSum([0, 0, 0]), [[0, 0, 0]], "all zeros");
```

### Common pitfalls

- Deduping with a `Set` of `JSON.stringify`-ed triplets instead of
  skip-logic during the scan — works, but throws away the `O(n²)` bound's
  cleanliness and adds real overhead for large inputs with many
  duplicates.
- Skipping duplicates on `left`/`right` *before* recording the match
  instead of after — this silently drops valid triplets.
- Forgetting to skip duplicate values for the **outer** loop variable `i`
  as well, not just `left`/`right` — all three positions can produce
  duplicate triplets if left unchecked.

### Staff-level follow-up

**"Generalize to k-Sum for arbitrary `k`, not just 3 — what's the
complexity, and where does it stop being practical?"** The standard
recursive reduction: k-Sum reduces to `(k-1)`-Sum by fixing one element and
recursing, bottoming out at Two Sum (two pointers on sorted data, `O(n)`).
That gives `O(n^(k-1))` time overall. It stops being practical fast — by
`k = 5` or `6` you're well past what's tractable for any `n` in the
thousands, and at that point the right move is usually reframing the
problem (is an approximate or probabilistic answer acceptable? can you
bound the value range and use a DP/subset-sum-style table instead of
combinatorial search?) rather than continuing to push the two-pointer
reduction further.

---

## Problem 4: Longest Repeating Character Replacement (Medium)

Given a string `s` consisting of uppercase letters and an integer `k`,
you may replace at most `k` characters with any other uppercase letter.
Return the length of the longest substring you can make consist of a
single repeating character after at most `k` replacements.

**Examples**
- `"ABAB", k = 2` → `4` (replace both `B`s with `A`, or both `A`s with `B`)
- `"AABABBA", k = 1` → `4` (e.g. `"BABB"` → replace one `A` to get `"BBBB"`)
- `"", k = 0` → `0`
- `"ABCDE", k = 1` → `2` (any 2-character window needs at most 1 replacement)

**Clarifying questions a staff engineer asks**
- Does the window need to track *which* character it's converging toward,
  or just the maximum length achievable? (Just the length here — that
  simplifies things a lot, since you never actually need to know the
  target letter.)
- Can `k` exceed the string length? (If so, the whole string trivially
  qualifies — worth confirming the function handles that without special
  casing.)
- Fixed alphabet (26 uppercase letters) or arbitrary characters? Changes
  whether a `Map` or a fixed-size array is the right frequency structure.

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

function characterReplacement(s, k) {
  // TODO: return the length of the longest substring achievable as a
  // single repeated character after at most k replacements.
  // Target: O(n) time using a variable-size sliding window with a
  // frequency count and a "shrink while invalid" loop. A window of
  // length L is valid iff (L - mostFrequentCharCountInWindow) <= k —
  // that's the number of characters you'd need to replace.
  return 0;
}

assertEqual(characterReplacement("ABAB", 2), 4, "replace to all same, k=2");
assertEqual(characterReplacement("AABABBA", 1), 4, "classic example, k=1");
assertEqual(characterReplacement("", 0), 0, "empty string");
assertEqual(characterReplacement("ABCDE", 1), 2, "all distinct, k=1");
```

### Approach

For any window, the number of replacements needed to make every character
the same is `window length - count of the most frequent character in that
window`. So: expand the window one character at a time, tracking frequency
counts and the running max frequency seen *so far* (it's safe to never
decrease this max — see pitfalls below for why). While
`(windowLength - maxFreq) > k`, the window is invalid and must shrink from
the left, decrementing the outgoing character's count. Track the best
window length seen across the whole scan.

**Complexity:** `O(n)` time (right pointer visits each character once,
left pointer only moves forward), `O(1)` space for a fixed 26-letter
alphabet, `O(min(n, alphabet size))` in general.

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

function characterReplacement(s, k) {
  const counts = new Map();
  let left = 0;
  let maxCount = 0;
  let maxLen = 0;

  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    counts.set(ch, (counts.get(ch) || 0) + 1);
    maxCount = Math.max(maxCount, counts.get(ch));

    while (right - left + 1 - maxCount > k) {
      const leftChar = s[left];
      counts.set(leftChar, counts.get(leftChar) - 1);
      left++;
    }
    maxLen = Math.max(maxLen, right - left + 1);
  }
  return maxLen;
}

assertEqual(characterReplacement("ABAB", 2), 4, "replace to all same, k=2");
assertEqual(characterReplacement("AABABBA", 1), 4, "classic example, k=1");
assertEqual(characterReplacement("", 0), 0, "empty string");
assertEqual(characterReplacement("ABCDE", 1), 2, "all distinct, k=1");
```

### Common pitfalls

- Decrementing `maxCount` when the window shrinks — it's tempting because
  it "feels" more accurate, but it's unnecessary and can make the window
  shrink incorrectly. `maxCount` only needs to be a correct *upper bound*
  from some point in the scan; once the window has achieved a given
  length, it can never need to shrink below a length it already proved
  achievable, so a stale (too-high) `maxCount` never produces a wrong
  answer, only a potentially looser "don't shrink" decision that still
  converges to the correct `maxLen`.
- Recomputing the most-frequent count by scanning the whole window on every
  step instead of maintaining it incrementally — correct but `O(n * 26)` or
  worse, defeating the point of the sliding window.
- Forgetting the window can *never* shrink below the best length already
  found — `maxLen` only grows, it's a separate variable from the window's
  current (possibly invalid-then-fixed) length.

### Staff-level follow-up

**"Same problem, but `k` is now a percentage of the current window length
(e.g., 'at most 20% of the window'), not a fixed count — how does the
invariant change?"** The validity check stops being a simple additive
bound and becomes `(windowLength - maxFreq) <= 0.2 * windowLength`, i.e.
`maxFreq >= 0.8 * windowLength`. This is still monotonic in window length
for a fixed character distribution, so the same expand-and-shrink structure
holds, but the shrink condition now depends on the *current* window length
on both sides of the inequality, meaning you can't precompute a fixed
threshold once — it has to be recomputed (cheaply, it's still `O(1)` per
step) as the window changes size. This is a good test of whether someone
actually understands the invariant or just memorized the fixed-`k` formula.

---

## Problem 5: Trapping Rain Water (Hard)

Given an array `height` representing an elevation map (one unit-width bar
per index), compute how much water it can trap after raining.

**Examples**
- `[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]` → `6`
- `[4, 2, 0, 3, 2, 5]` → `9`
- `[]` → `0`
- `[1, 2]` → `0` (no basin — water needs a wall on both sides)

**Clarifying questions a staff engineer asks**
- Is this asking for total trapped volume (sum across all positions), or
  the single deepest basin? (Total volume — this is the detail most
  likely to be assumed wrong, since Container With Most Water asks for a
  single pair's area and it's easy to conflate the two problems.)
- Are bar widths guaranteed to be `1`, or can they vary? (Assumed `1`
  here — variable widths change the water-at-position-`i` formula into an
  integral, not a simple sum.)
- Precompute-heavy (`O(n)` extra arrays) acceptable, or does this need
  `O(1)` auxiliary space specifically?

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

function trap(height) {
  // TODO: return total trapped water volume.
  // Target: O(n) time, O(1) space using two pointers from both ends,
  // each tracking a running max height seen from its own side. The
  // water trapped at the pointer that holds the SMALLER running max is
  // fully determined — move that pointer inward and add water there.
  return 0;
}

assertEqual(trap([0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]), 6, "classic example");
assertEqual(trap([4, 2, 0, 3, 2, 5]), 9, "second classic example");
assertEqual(trap([]), 0, "empty input");
assertEqual(trap([1, 2]), 0, "two elements, no basin");
```

### Approach

Water trapped above position `i` is bounded by
`min(maxHeightToTheLeft(i), maxHeightToTheRight(i)) - height[i]`. The
prefix/suffix-max-array approach computes both arrays in two `O(n)` passes
and then sums — correct, but `O(n)` extra space.

The two-pointer version collapses this to `O(1)` space using the same
bottleneck proof as Container With Most Water: walk `left` and `right`
inward, each tracking the running max height *seen from its own side so
far*. Whichever side has the **smaller** running max is the one whose
water level at the current pointer is already fully determined — the
other side's wall (whatever it eventually turns out to be) is guaranteed
to be at least as tall, because the current running max is a lower bound
on it and that lower bound already exceeds this side's. So water at that
position is exactly `thisSideMax - height[pointer]`, no matter what the
far side's actual max turns out to be. Move that pointer inward and repeat.

**Complexity:** `O(n)` time, `O(1)` space.

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

function trap(height) {
  if (height.length === 0) return 0;

  let left = 0;
  let right = height.length - 1;
  let leftMax = height[left];
  let rightMax = height[right];
  let water = 0;

  while (left < right) {
    if (leftMax < rightMax) {
      left++;
      leftMax = Math.max(leftMax, height[left]);
      water += leftMax - height[left];
    } else {
      right--;
      rightMax = Math.max(rightMax, height[right]);
      water += rightMax - height[right];
    }
  }
  return water;
}

assertEqual(trap([0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]), 6, "classic example");
assertEqual(trap([4, 2, 0, 3, 2, 5]), 9, "second classic example");
assertEqual(trap([]), 0, "empty input");
assertEqual(trap([1, 2]), 0, "two elements, no basin");
```

### Common pitfalls

- Confusing this with Container With Most Water — that problem picks the
  single best *pair* of lines; this one sums water trapped above *every*
  position. Reaching for "just find the two tallest lines" gives a wrong
  (usually too-small) answer here.
- Moving the pointer on the side with the **larger** running max instead
  of the smaller one — breaks the bottleneck proof, since that side's
  water level isn't actually determined yet.
- Not handling `height.length === 0` — `height[left]` on an empty array
  reads `undefined`, which silently poisons every downstream comparison
  instead of failing loudly.

### Staff-level follow-up

**"What if the elevation map is effectively infinite — streamed one bar at
a time, and you need a running total of trapped water so far?"** The
two-pointer approach needs both ends available, which a one-directional
stream doesn't give you. You can maintain a running `leftMax` as bars
arrive and lower-bound the water trapped so far using only completed
basins (positions where you've since seen something taller on the right),
but you cannot finalize water trapped near the *current* streaming
position until a taller-or-equal bar eventually arrives on its right — so
the running total has to be reported with an explicit "finalized up to
index X" boundary, with a backlog of not-yet-resolved positions bounded by
how long a stretch of decreasing-then-flat terrain the stream can produce.
This is the moment a two-pointer answer has to be explicitly reframed as
an online/streaming algorithm with a correctness-vs-latency tradeoff.

---

## Problem 6: Minimum Window Substring (Hard)

Given two strings `s` and `t`, return the smallest substring of `s` that
contains every character of `t` (including duplicates — if `t` has two
`a`s, the window needs at least two `a`s). If no such window exists,
return `""`.

**Examples**
- `s = "ADOBECODEBANC", t = "ABC"` → `"BANC"`
- `s = "a", t = "a"` → `"a"`
- `s = "a", t = "aa"` → `""` (`s` can't supply two `a`s)

**Clarifying questions a staff engineer asks**
- Does `t` have duplicate characters that must each be matched, or just
  distinct characters' presence? (Duplicates must each be matched here —
  this is the detail that trips up a "just track distinct chars seen"
  approach.)
- If multiple minimal-length windows exist, does it matter which one is
  returned? (No — any one of equal-minimal length is acceptable; for
  testability the examples here happen to have a unique minimum.)
- Case-sensitive matching? Is the alphabet bounded (ASCII) or could it be
  full Unicode, which affects whether a plain object/array or a `Map` is
  the right frequency structure?

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

function minWindow(s, t) {
  // TODO: return the smallest substring of s containing every character
  // of t (with multiplicity), or "" if none exists.
  // Target: O(n + m) time using a variable-size sliding window with two
  // frequency maps — `need` (built once from t) and `window` (built
  // incrementally as the window expands) — plus a counter tracking how
  // many of t's DISTINCT characters currently have their need fully met
  // inside the window. Expand right until the window is valid, then
  // shrink left while it stays valid, recording the best window each
  // time it's valid.
  return "";
}

assertEqual(minWindow("ADOBECODEBANC", "ABC"), "BANC", "classic example");
assertEqual(minWindow("a", "a"), "a", "single char match");
assertEqual(minWindow("a", "aa"), "", "impossible — s can't supply enough a's");
```

### Approach

Build a `need` map once from `t`: character → required count. As the
window expands (`right` moves forward), update a `window` map the same
way, and increment a `have` counter each time a character's count in
`window` *first reaches* its required count in `need` — not every time
that character appears, only on the transition into "satisfied." The
window is valid exactly when `have === need.size` (every distinct required
character is satisfied). Once valid, try to shrink from the left as much
as possible while staying valid, recording the window length each time —
this is the "shrink while still valid" shape, mirrored from Problem 4's
"shrink while invalid."  The key invariant: every valid window gets
recorded, and the best (shortest) one wins.

**Complexity:** `O(n + m)` time (`n = s.length`, `m = t.length`) — `right`
and `left` each traverse `s` at most once; building `need` is `O(m)`.
`O(distinct characters in t)` space.

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

function minWindow(s, t) {
  if (t.length === 0 || s.length < t.length) return "";

  const need = new Map();
  for (const ch of t) need.set(ch, (need.get(ch) || 0) + 1);

  const window = new Map();
  let have = 0;
  const required = need.size;
  let left = 0;
  let bestLen = Infinity;
  let bestLeft = 0;

  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    window.set(ch, (window.get(ch) || 0) + 1);
    if (need.has(ch) && window.get(ch) === need.get(ch)) have++;

    while (have === required) {
      if (right - left + 1 < bestLen) {
        bestLen = right - left + 1;
        bestLeft = left;
      }
      const leftChar = s[left];
      window.set(leftChar, window.get(leftChar) - 1);
      if (need.has(leftChar) && window.get(leftChar) < need.get(leftChar)) {
        have--;
      }
      left++;
    }
  }

  return bestLen === Infinity ? "" : s.substring(bestLeft, bestLeft + bestLen);
}

assertEqual(minWindow("ADOBECODEBANC", "ABC"), "BANC", "classic example");
assertEqual(minWindow("a", "a"), "a", "single char match");
assertEqual(minWindow("a", "aa"), "", "impossible — s can't supply enough a's");
```

### Common pitfalls

- Incrementing `have` on every occurrence of a needed character instead of
  only on the transition where its count *first* reaches the requirement —
  this overcounts and can mark the window valid before it actually is.
- The mirror-image bug on shrink: decrementing `have` as soon as a needed
  character's count drops at all, instead of only when it drops *below*
  the required count — a character can still satisfy its requirement with
  count `3` when only `2` are needed, so dropping to `2` shouldn't
  decrement `have`.
- Treating `t`'s characters as a `Set` (presence only) instead of a `Map`
  with counts — breaks immediately when `t` has duplicate characters.
- Using `s.length < t.length` as the *only* early-exit check — necessary
  but not sufficient; it correctly fails `("a", "aa")` but the main loop
  still needs to handle the general "ran out of `s` before `have` ever
  reached `required`" case, which the `bestLen === Infinity` check at the
  end covers.

### Staff-level follow-up

**"This needs to run against a live, continuously-appended log stream
(`s` keeps growing) with `t` fixed — can you avoid restarting the scan
from scratch every time a new character arrives?"** Yes — this is actually
one of the better-behaved problems for incremental/online adaptation. The
`window` map and `have` counter are already incremental state; appending
one character to `s` is just one more iteration of the `right` loop,
updating `window`/`have` and then running the shrink-while-valid loop as
usual. The `left` pointer monotonically moves forward across the entire
stream's lifetime (it never needs to reset backward), so the amortized
cost per newly-appended character stays `O(1)` on average even though a
single append can occasionally trigger a longer shrink sequence. The real
production question becomes memory: do you keep the full history of `s` to
be able to return actual substrings, or only enough of a rolling buffer
(bounded by the longest window you've ever needed) to reconstruct the
current best — the latter caps memory but requires evicting from that
buffer carefully so you don't discard characters still inside the active
window.
