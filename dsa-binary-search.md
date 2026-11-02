# Binary Search — DSA Practice (3 of 5)

This file follows the same loop as its siblings: **attempt, then verify**.
Every problem gives you a function stub that fails on purpose — press
**▶ Run**, watch it fail, fix the body yourself, re-run until every
assertion is `✅ PASS`, then diff against the reference solution. The
`assertEqual` harness is duplicated into every block on purpose, since each
`js` block runs in total isolation. The mental shift this file is built
around: binary search isn't "search a sorted array," it's "find the
boundary of a monotonic predicate." Once you see it that way — a function
that's `true` on one side and `false` on the other, and you're hunting for
where it flips — rotated arrays, peak-finding, and "binary search on the
answer" stop looking like six different tricks and start looking like one
template applied six times.

## Table of Contents

- [Problem 1: Classic Binary Search (Easy)](#problem-1-classic-binary-search-easy)
- [Problem 2: Search in Rotated Sorted Array (Medium)](#problem-2-search-in-rotated-sorted-array-medium)
- [Problem 3: Find Peak Element (Medium)](#problem-3-find-peak-element-medium)
- [Problem 4: Kth Smallest Element in a Sorted Matrix (Medium)](#problem-4-kth-smallest-element-in-a-sorted-matrix-medium)
- [Problem 5: Median of Two Sorted Arrays (Hard)](#problem-5-median-of-two-sorted-arrays-hard)
- [Problem 6: Minimum Capacity to Ship Packages Within D Days (Medium/Hard)](#problem-6-minimum-capacity-to-ship-packages-within-d-days-mediumhard)

---

## Problem 1: Classic Binary Search (Easy)

Given a sorted array of distinct integers `nums` and an integer `target`,
return the index of `target` in `nums`, or `-1` if it's not present.

**Examples**
- `nums = [-1, 0, 3, 5, 9, 12], target = 9` → `4`
- `nums = [-1, 0, 3, 5, 9, 12], target = 2` → `-1`
- `nums = [5], target = 5` → `0`

**Clarifying questions a staff engineer asks**
- Is the array guaranteed sorted and distinct? (Duplicates don't break
  "does it exist," but they do break "return a specific index" unless the
  spec says which one.)
- Ascending or could it be descending? (Flips every comparison.)
- Integer overflow on `mid` computation — not a real concern in JS
  (doubles), but `lo + hi` instead of `lo + (hi - lo) / 2` is the classic
  bug in languages with fixed-width integers, and it's worth naming even
  here.
- Is this genuinely the whole problem, or a building block for something
  harder (it almost always is at staff level)?

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

function binarySearch(nums, target) {
  // TODO: return the index of target in nums, or -1 if absent.
  // Target: O(log n) time, O(1) space. Maintain a search range [lo, hi]
  // and halve it every iteration based on how mid compares to target.
  return -1;
}

assertEqual(binarySearch([-1, 0, 3, 5, 9, 12], 9), 4, "target in middle-right");
assertEqual(binarySearch([-1, 0, 3, 5, 9, 12], 2), -1, "target not present");
assertEqual(binarySearch([], 5), -1, "empty array");
assertEqual(binarySearch([5], 5), 0, "single element, found");
```

### Approach

Brute force is a linear scan: `O(n)`. Binary search exploits sortedness:
compare `nums[mid]` to `target`, and discard the half that can't possibly
contain it. The predicate underneath is `nums[i] >= target` — it's `false`
for a prefix of the array and `true` for the rest (since the array is
sorted), and you're looking for where that flips. Every variant in this
file is some version of that same flip-finding search, just with a
different predicate.

**Complexity:** `O(log n)` time, `O(1)` space.

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

function binarySearch(nums, target) {
  let lo = 0;
  let hi = nums.length - 1;
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

assertEqual(binarySearch([-1, 0, 3, 5, 9, 12], 9), 4, "target in middle-right");
assertEqual(binarySearch([-1, 0, 3, 5, 9, 12], 2), -1, "target not present");
assertEqual(binarySearch([], 5), -1, "empty array");
assertEqual(binarySearch([5], 5), 0, "single element, found");
```

### Common pitfalls

- `while (lo < hi)` instead of `lo <= hi` — drops the single-element
  window case and can miss the target when the range collapses to exactly
  one candidate.
- `mid = (lo + hi) / 2` without `Math.floor` — in JS this produces a
  fractional index, which silently returns `undefined` from array access
  instead of crashing loudly.
- Updating `lo`/`hi` to `mid` instead of `mid + 1`/`mid - 1` — causes an
  infinite loop when the range narrows to two elements that straddle the
  comparison.

### Staff-level follow-up

**"The array is sorted but has ~50% duplicate values clustered around the
target — does your algorithm's complexity change, and does the interview
answer change if you need *all* indices matching target, not just one?"**
Finding *a* match stays `O(log n)` regardless of duplicates — the
comparisons don't care how many other elements share a value. But finding
*every* index requires finding the left boundary and right boundary
separately (two binary searches, each hunting a different flip point:
"first index where `nums[i] >= target`" and "first index where
`nums[i] > target`"), then the full range is `O(log n)` to find but
`O(k)` to enumerate where `k` is the match count. The complexity doesn't
change for finding the boundaries — only enumerating the results costs
more, and that's unavoidable since you're materializing `k` values.

---

## Problem 2: Search in Rotated Sorted Array (Medium)

An ascending array with **no duplicates** has been rotated at some unknown
pivot (e.g., `[0,1,2,4,5,6,7]` → `[4,5,6,7,0,1,2]`). Given the rotated
array and a `target`, return its index, or `-1` if absent.

**Examples**
- `nums = [4, 5, 6, 7, 0, 1, 2], target = 0` → `4`
- `nums = [4, 5, 6, 7, 0, 1, 2], target = 3` → `-1`
- `nums = [1], target = 0` → `-1`

**Clarifying questions a staff engineer asks**
- No duplicates confirmed? (The follow-up for this problem is exactly
  "what if there are duplicates," and the answer changes the complexity
  bound, so it's worth confirming the easier version first.)
- Could the array be un-rotated (pivot at index 0)? (Your sorted-half
  check needs to handle that as a degenerate case, not a special one.)
- Single element or empty array — handled the same way as the base case?

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

function searchRotated(nums, target) {
  // TODO: return the index of target in this rotated sorted array, or -1.
  // Target: O(log n) time. At each mid, one of the two halves [lo..mid]
  // or [mid..hi] is guaranteed to be normally sorted — figure out which,
  // then check whether target falls inside THAT half's range.
  return -1;
}

assertEqual(searchRotated([4, 5, 6, 7, 0, 1, 2], 0), 4, "target in unsorted (right) half");
assertEqual(searchRotated([4, 5, 6, 7, 0, 1, 2], 3), -1, "target not present");
assertEqual(searchRotated([1], 0), -1, "single element, not found");
assertEqual(searchRotated([1, 3], 3), 1, "two elements, target at end");
assertEqual(searchRotated([5, 1, 3], 5), 0, "target at rotation pivot");
```

### Approach

Brute force is a linear scan, `O(n)`, which ignores the sortedness
entirely. The key insight: at any `mid`, comparing `nums[lo]` to
`nums[mid]` tells you which half is **normally sorted** (the rotation
point is in at most one of the two halves). Once you know which half is
sorted, a simple range check (`nums[lo] <= target < nums[mid]`, or the
mirror for the right half) tells you whether `target` could be in that
half. If it's in the sorted half's range, search there; otherwise, the
target — if it exists — must be in the other (rotated) half.

**Complexity:** `O(log n)` time, `O(1)` space.

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

function searchRotated(nums, target) {
  let lo = 0;
  let hi = nums.length - 1;
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (nums[mid] === target) return mid;
    if (nums[lo] <= nums[mid]) {
      // left half is sorted
      if (nums[lo] <= target && target < nums[mid]) hi = mid - 1;
      else lo = mid + 1;
    } else {
      // right half is sorted
      if (nums[mid] < target && target <= nums[hi]) lo = mid + 1;
      else hi = mid - 1;
    }
  }
  return -1;
}

assertEqual(searchRotated([4, 5, 6, 7, 0, 1, 2], 0), 4, "target in unsorted (right) half");
assertEqual(searchRotated([4, 5, 6, 7, 0, 1, 2], 3), -1, "target not present");
assertEqual(searchRotated([1], 0), -1, "single element, not found");
assertEqual(searchRotated([1, 3], 3), 1, "two elements, target at end");
assertEqual(searchRotated([5, 1, 3], 5), 0, "target at rotation pivot");
```

### Common pitfalls

- Using `nums[lo] < nums[mid]` instead of `<=` — when the left half has
  exactly one element (`lo === mid`), strict `<` incorrectly treats it as
  "not sorted," sending you down the wrong branch.
- Checking `target < nums[mid]` without also checking `target >=
  nums[lo]` — a half being "sorted" doesn't mean the target is in its
  range, and skipping the lower bound check causes false positives.
- Trying to find the rotation pivot first, then binary-searching within
  one static half — works, but it's two full searches instead of one,
  and the single-pass version above is the expected answer at this level.

### Staff-level follow-up

**"Same problem, but now the array can contain duplicates — what breaks,
and what's the actual worst-case complexity now?"** Duplicates break the
"which half is sorted" check: if `nums[lo] === nums[mid]`, you genuinely
can't tell which half holds the rotation point (e.g., `[1,1,1,0,1]` vs.
`[1,0,1,1,1]` look identical at `lo`/`mid`). The fix is to shrink the
range by one from whichever side is ambiguous (`lo++` or `hi--`) and
retry — but that degrades the worst case to `O(n)` on pathological inputs
like `[1,1,1,1,1,1,0,1,1]`, because you may have to shrink one element at
a time through a long run of duplicates. Stating that degradation
explicitly — "average case is still close to `O(log n)`, but worst case
is `O(n)` and here's the exact input that triggers it" — is the answer a
staff interview is looking for, not just a patched version of the code.

---

## Problem 3: Find Peak Element (Medium)

Given an integer array `nums`, a **peak** is an element strictly greater
than both its neighbors. Treat `nums[-1]` and `nums[n]` as `-infinity`
(so the first or last element can be a peak). Return the index of **any**
peak — multiple peaks may exist, and any valid one is accepted.

**Examples**
- `nums = [1]` → `0` (trivially a peak, both neighbors are `-infinity`)
- `nums = [1, 2, 3, 4, 5]` → `4` (strictly increasing; the last element is
  a peak because its right "neighbor" is `-infinity`)
- `nums = [1, 2, 3, 1]` → `2`

**Clarifying questions a staff engineer asks**
- Are duplicate adjacent values possible? (The "strictly greater" wording
  matters — a plateau of equal values is neither ascending nor
  descending, and the algorithm needs a tie-breaking rule.)
- Is any valid peak acceptable, or does the problem want a specific one
  (e.g., the global maximum)? (Changes this from `O(log n)` binary search
  to a full `O(n)` scan if it must be the global max and the array isn't
  unimodal.)
- Can the array be strictly monotonic end to end? (Yes — the `-infinity`
  boundary convention is exactly what makes that a valid, well-defined
  case instead of a special one.)

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

function findPeakElement(nums) {
  // TODO: return the index of any peak element.
  // Target: O(log n) time using binary search on the LOCAL SLOPE at mid —
  // compare nums[mid] to nums[mid + 1] to decide which direction
  // guarantees a peak.
  return -1;
}

assertEqual(findPeakElement([1]), 0, "single element is trivially a peak");
assertEqual(findPeakElement([1, 2, 3, 4, 5]), 4, "strictly increasing, peak at the end");
assertEqual(findPeakElement([1, 2, 3, 1]), 2, "unique interior peak");
assertEqual(findPeakElement([4, 3, 2, 1]), 0, "strictly decreasing, peak at the start");
```

### Approach

Brute force scans every element checking both neighbors: `O(n)`. The
binary search insight: at any `mid`, look at the slope between `mid` and
`mid + 1`.
- If `nums[mid] > nums[mid + 1]`, the slope is descending, which
  guarantees a peak exists somewhere in `[lo, mid]` (worst case, `mid`
  itself is the peak, since the `-infinity` boundary on the far side of
  `lo` has to turn the slope around eventually).
- If `nums[mid] < nums[mid + 1]`, the slope is ascending, which guarantees
  a peak exists in `(mid, hi]` by the same argument.

This is "find the boundary of a monotonic predicate" with the predicate
being "is this a descending step" — it's `false` then `true` as you scan
left to right across *some* unimodal-enough region, and you're homing in
on where it flips, same as every other problem in this file.

**Complexity:** `O(log n)` time, `O(1)` space.

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

function findPeakElement(nums) {
  let lo = 0;
  let hi = nums.length - 1;
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (nums[mid] > nums[mid + 1]) {
      // descending slope at mid -> a peak is at or before mid
      hi = mid;
    } else {
      // ascending slope at mid -> a peak is strictly after mid
      lo = mid + 1;
    }
  }
  return lo;
}

assertEqual(findPeakElement([1]), 0, "single element is trivially a peak");
assertEqual(findPeakElement([1, 2, 3, 4, 5]), 4, "strictly increasing, peak at the end");
assertEqual(findPeakElement([1, 2, 3, 1]), 2, "unique interior peak");
assertEqual(findPeakElement([4, 3, 2, 1]), 0, "strictly decreasing, peak at the start");
```

### Common pitfalls

- Comparing `nums[mid]` against `nums[mid - 1]` AND `nums[mid + 1]` and
  trying to branch on both — only the forward comparison
  (`mid` vs. `mid + 1`) is needed to decide direction; checking both
  doubles the complexity of the branching logic for no benefit.
- Setting `hi = mid - 1` on the descending case instead of `hi = mid` —
  `mid` itself might be the peak, and shrinking past it loses the answer.
- Assuming the array must be a single hump (strictly up then strictly
  down) — it doesn't have to be; any array where adjacent elements
  differ (no plateaus) works, including multiple local peaks.

### Staff-level follow-up

**"What if the array can have adjacent equal elements (plateaus), and
'peak' now means greater-than-or-equal to neighbors — does the `O(log n)`
bound survive?"** No, and this is the right answer, not a dodge: a flat
plateau like `[1, 2, 2, 2, 2, 1]` has no slope information at any
interior `mid` within the plateau — `nums[mid] === nums[mid+1]` tells you
nothing about which direction leads to a qualifying peak. You'd need to
skip across the plateau to find a direction, and an adversarial input can
make that skip cost `O(n)` in the worst case (e.g., one giant plateau with
the only qualifying boundary at one end). The honest complexity answer is
"`O(log n)` amortized for inputs without large plateaus, `O(n)` worst
case when they're allowed" — and saying that out loud, with the exact
adversarial input, is what the question is actually testing.

---

## Problem 4: Kth Smallest Element in a Sorted Matrix (Medium)

Given an `n x n` matrix where every row and every column is sorted in
ascending order, return the `k`-th smallest element in the matrix (1-indexed,
counting duplicates).

**Examples**
- `matrix = [[1,5,9],[10,11,13],[12,13,15]], k = 8` → `13`
- `matrix = [[5]], k = 1` → `5`
- `matrix = [[1,2],[1,3]], k = 3` → `2` (sorted values are `[1,1,2,3]`)

**Clarifying questions a staff engineer asks**
- Row-sorted and column-sorted, but is the matrix also sorted
  "globally" (i.e., is it a flattened sorted list)? (It's not, in
  general — that distinction is exactly why this isn't just "flatten and
  index.")
- Are duplicate values across the matrix expected, and if so, does `k`
  count them individually? (Yes here — `k` counts positions, not
  distinct values.)
- Is `n` the same for rows and columns (square matrix), or could it be
  rectangular? (Changes the row/column counting walk slightly but not the
  core idea.)

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

function kthSmallest(matrix, k) {
  // TODO: return the k-th smallest element in this row/column sorted
  // matrix. Target: O(n log(max - min)) time using binary search on the
  // VALUE RANGE [matrix[0][0], matrix[n-1][n-1]], with an O(n) counting
  // step per candidate value (walk from the bottom-left corner).
  return -1;
}

assertEqual(
  kthSmallest(
    [
      [1, 5, 9],
      [10, 11, 13],
      [12, 13, 15],
    ],
    8
  ),
  13,
  "classic 3x3 matrix, 8th smallest"
);
assertEqual(kthSmallest([[5]], 1), 5, "single-element matrix");
assertEqual(
  kthSmallest(
    [
      [1, 2],
      [1, 3],
    ],
    3
  ),
  2,
  "duplicate values at the boundary"
);
```

### Approach

This is the pivot problem in the set: binary search isn't searching the
array's *indices* anymore, it's searching the **range of possible
values** between `matrix[0][0]` (min) and `matrix[n-1][n-1]` (max). For a
candidate value `mid`, "how many elements in the matrix are `<= mid`" is
a monotonic question — the count only grows as `mid` grows — which is
exactly the monotonic predicate this file keeps coming back to. You're
hunting for the smallest `mid` where `count(<= mid) >= k`.

Counting `count(<= mid)` fast is what makes this work: start at the
**bottom-left** corner. If the current cell is `<= mid`, every cell above
it in that column is also `<= mid` (columns are sorted ascending top to
bottom, so going up only increases values — meaning going *down* from
here was safe), so add `row + 1` to the count and move right. If it's
`> mid`, move up. This walk is `O(n)` per check, not `O(n²)`, because
`row` and `col` each move monotonically in one direction.

A heap-based alternative (`O(k log n)`, pushing the next candidate from
each row as you pop) wins when `k` is small relative to `n²`; binary
search on value wins when the value range is small relative to `k` and
`n`. Neither dominates universally — that tradeoff is worth stating.

**Complexity:** `O(n log(max - min))` time, `O(1)` space.

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

function kthSmallest(matrix, k) {
  const n = matrix.length;
  let lo = matrix[0][0];
  let hi = matrix[n - 1][n - 1];

  function countLessEqual(mid) {
    // Walk from bottom-left corner: O(n) per check since matrix is sorted
    // both row-wise and column-wise.
    let count = 0;
    let row = n - 1;
    let col = 0;
    while (row >= 0 && col < n) {
      if (matrix[row][col] <= mid) {
        count += row + 1;
        col++;
      } else {
        row--;
      }
    }
    return count;
  }

  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (countLessEqual(mid) < k) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

assertEqual(
  kthSmallest(
    [
      [1, 5, 9],
      [10, 11, 13],
      [12, 13, 15],
    ],
    8
  ),
  13,
  "classic 3x3 matrix, 8th smallest"
);
assertEqual(kthSmallest([[5]], 1), 5, "single-element matrix");
assertEqual(
  kthSmallest(
    [
      [1, 2],
      [1, 3],
    ],
    3
  ),
  2,
  "duplicate values at the boundary"
);
```

### Common pitfalls

- Flattening the matrix and sorting it (`O(n² log n)`) and calling it
  "the binary search solution" — that's just brute force with extra
  steps; the actual technique is binary search on value, not on a
  flattened index.
- Walking the counting step from the **top-left** corner instead of
  bottom-left (or top-right) — from top-left, both increasing row and
  increasing column can increase the value, so there's no single
  direction that's always safe to extend, and the `O(n)` walk breaks.
- Returning `mid` directly as the answer instead of continuing to shrink
  `[lo, hi]` to a single point — `mid` is a candidate *value*, not
  necessarily a value that's actually present in the matrix, so the loop
  must converge to the smallest feasible value, not stop at the first
  "count >= k" hit.

### Staff-level follow-up

**"This matrix is actually a materialized view backed by a live,
constantly-updated OLTP table — what changes about how you'd answer 'kth
smallest' in production?"** The core algorithm assumes random-access
reads of arbitrary cells in `O(1)`, which a live table doesn't give you
cheaply, and the row/column sortedness invariant can be stale by the time
you act on it. In practice you'd either snapshot-read (accept staleness,
run this algorithm against a consistent point-in-time copy) or maintain a
separate pre-aggregated structure (e.g., a count-based index or
approximate percentile sketch like t-digest) that's updated incrementally
and answers "kth smallest" without re-scanning. The binary-search-on-value
technique still applies conceptually — you're still searching a monotonic
count function — but the `O(n)` counting step gets replaced by whatever
your pre-aggregation gives you, and that's the actual systems-design
conversation this question is probing for.

---

## Problem 5: Median of Two Sorted Arrays (Hard)

Given two sorted arrays `nums1` and `nums2` of sizes `m` and `n`, return
the median of the combined sorted array, in `O(log(min(m, n)))` time
(i.e., you may not simply merge the arrays).

**Examples**
- `nums1 = [1, 3], nums2 = [2]` → `2` (merged: `[1,2,3]`, odd length,
  median is the middle element)
- `nums1 = [1, 2], nums2 = [3, 4]` → `2.5` (merged: `[1,2,3,4]`, even
  length, median is the average of the two middle elements)
- `nums1 = [], nums2 = [1]` → `1`

**Clarifying questions a staff engineer asks**
- Can either array be empty? (Yes — and it's the case that breaks a naive
  "always compute `nums1[cut - 1]`" implementation if you don't guard the
  boundary.)
- Are duplicate values across the two arrays expected? (Doesn't change
  the algorithm — the partition logic only cares about relative order,
  not uniqueness.)
- Is `O(log(min(m, n)))` a hard requirement, or is `O(m + n)` merge
  acceptable as a first pass before optimizing? (Always worth stating the
  simple answer exists before diving into the partition trick — it proves
  you understand *why* the harder approach is needed, not just that you
  memorized it.)

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

function findMedianSortedArrays(nums1, nums2) {
  // TODO: return the median of the merged sorted array, without actually
  // merging. Target: O(log(min(m, n))) time, binary searching on how
  // many elements to take from the SHORTER array, using the partition
  // approach (left half of both arrays combined == right half, and
  // every value on the left must be <= every value on the right).
  return 0;
}

assertEqual(findMedianSortedArrays([1, 3], [2]), 2, "odd total length");
assertEqual(findMedianSortedArrays([1, 2], [3, 4]), 2.5, "even total length");
assertEqual(findMedianSortedArrays([], [1]), 1, "first array empty");
assertEqual(findMedianSortedArrays([], [2, 3]), 2.5, "first array empty, even length");
assertEqual(
  findMedianSortedArrays([1, 2], [3, 4, 5, 6, 7, 8, 9, 10]),
  5.5,
  "very different sizes"
);
```

### Approach

Brute force merges both arrays (`O(m + n)` time, `O(m + n)` space) or
merges without extra space by walking both pointers to the midpoint
(`O(m + n)` time, `O(1)` space) — both correct, neither hits the required
bound.

The `O(log(min(m, n)))` approach: binary search on **how many elements to
take from the shorter array** (call it `cut1`), which fixes how many to
take from the other array (`cut2 = half - cut1`, where `half` is the size
of the combined left partition). A partition is valid when every element
in the combined left side is `<=` every element in the combined right
side — checked with exactly 4 boundary comparisons:
`nums1[cut1-1] <= nums2[cut2]` and `nums2[cut2-1] <= nums1[cut1]`. Treat
an empty side of a cut as `-infinity` (left) or `+infinity` (right) so
the boundary comparisons degrade cleanly instead of needing special
cases. If the partition is invalid, the direction of the violation tells
you whether to shrink or grow `cut1` — binary search on that boundary.

Always searching the **shorter** array by length-swapping at the top
bounds the binary search range to `[0, m]` with `m = min(m, n)`, which is
what delivers the `log(min(m, n))` bound instead of `log(max(m, n))`.

**Complexity:** `O(log(min(m, n)))` time, `O(1)` space.

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

function findMedianSortedArrays(nums1, nums2) {
  // Always binary search on the SHORTER array to keep it O(log(min(m, n))).
  if (nums1.length > nums2.length) return findMedianSortedArrays(nums2, nums1);

  const m = nums1.length;
  const n = nums2.length;
  let lo = 0;
  let hi = m;
  const half = Math.floor((m + n + 1) / 2);

  while (lo <= hi) {
    const cut1 = lo + Math.floor((hi - lo) / 2); // elements taken from nums1
    const cut2 = half - cut1; // elements taken from nums2

    const left1 = cut1 === 0 ? -Infinity : nums1[cut1 - 1];
    const left2 = cut2 === 0 ? -Infinity : nums2[cut2 - 1];
    const right1 = cut1 === m ? Infinity : nums1[cut1];
    const right2 = cut2 === n ? Infinity : nums2[cut2];

    if (left1 <= right2 && left2 <= right1) {
      // Valid partition found.
      if ((m + n) % 2 === 1) return Math.max(left1, left2);
      return (Math.max(left1, left2) + Math.min(right1, right2)) / 2;
    } else if (left1 > right2) {
      hi = cut1 - 1; // took too much from nums1
    } else {
      lo = cut1 + 1; // took too little from nums1
    }
  }
  throw new Error("input arrays are not sorted");
}

assertEqual(findMedianSortedArrays([1, 3], [2]), 2, "odd total length");
assertEqual(findMedianSortedArrays([1, 2], [3, 4]), 2.5, "even total length");
assertEqual(findMedianSortedArrays([], [1]), 1, "first array empty");
assertEqual(findMedianSortedArrays([], [2, 3]), 2.5, "first array empty, even length");
assertEqual(
  findMedianSortedArrays([1, 2], [3, 4, 5, 6, 7, 8, 9, 10]),
  5.5,
  "very different sizes"
);
```

### Common pitfalls

- Forgetting to swap so you always search the shorter array — without
  the swap, `cut2 = half - cut1` can go negative or exceed `n`, and the
  algorithm either crashes or silently reads `undefined` as a boundary
  value.
- Not treating empty-side cuts as `±Infinity` — if `cut1 === 0`,
  `nums1[cut1 - 1]` is `nums1[-1]`, which is `undefined` in JS, and
  `undefined <= anything` is always `false`, corrupting every comparison
  downstream.
- Getting `half` off by one for even vs. odd total length — the `+1`
  inside `Math.floor((m + n + 1) / 2)` is what makes the *same* formula
  correctly handle both parities (for even totals, the left partition
  ends up exactly half; for odd, it ends up one larger, which is where
  the true median sits for the odd case). Dropping the `+1` breaks the
  odd-length case specifically, which is the kind of bug that only shows
  up on half your test inputs.

### Staff-level follow-up

**"This needs to run against two live, growing datasets — say, two
separate sharded time-series streams — where you need a running median
updated as new sorted data arrives, not computed from scratch each time.
What changes?"** The partition approach assumes static, fully-known
arrays with `O(1)` random access — none of that holds for a stream. For a
running median over a continuous stream, the standard structure is two
heaps (a max-heap for the lower half, a min-heap for the upper half),
keeping them balanced in size as elements arrive; the median is always
derivable from the heap tops in `O(1)`, with `O(log n)` insert. If the
data is sharded across two independent sorted streams rather than one,
you're back to something closer to the k-way merge problem — maintaining
a running count/position estimate per shard and periodically
re-synchronizing, since exact global median over independently-updating
shards without coordination is a distributed consensus problem in
disguise, not just an algorithms problem.

---

## Problem 6: Minimum Capacity to Ship Packages Within D Days (Medium/Hard)

A conveyor belt ships packages in order (you cannot reorder them). Given
`weights[i]` for each package and an integer `days`, find the **minimum**
ship capacity such that all packages can be shipped within `days` days.
Each day, you load packages in order onto the ship up to its capacity;
once a package would exceed capacity, the remaining packages wait for the
next day.

**Examples**
- `weights = [1,2,3,4,5,6,7,8,9,10], days = 5` → `15`
- `weights = [3,2,2,4,1,4], days = 3` → `6`
- `weights = [5], days = 1` → `5`

**Clarifying questions a staff engineer asks**
- Must packages stay in their given order, or can they be reordered to
  pack more efficiently? (Order-preserving, per the spec — this is what
  makes "capacity → days needed" a clean greedy check instead of a
  bin-packing problem.)
- Is a single package ever heavier than any feasible capacity? (No — the
  lower bound on capacity is `max(weights)`, since a package can't be
  split across days.)
- Does "within `days` days" mean exactly `days` or **at most** `days`?
  (At most — which is exactly why "minimum capacity" is well-defined:
  more capacity never increases the days needed, so the feasibility
  predicate is monotonic.)

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

function shipWithinDays(weights, days) {
  // TODO: return the minimum ship capacity such that all packages fit
  // within `days` days (order-preserving greedy loading).
  // Target: O(n log(sum - max)) time. Binary search on the ANSWER
  // (capacity itself), using a feasibility check: "given capacity X, how
  // many days are needed?" — that count is monotonically non-increasing
  // as X grows, which is what makes binary search on capacity valid.
  return 0;
}

assertEqual(
  shipWithinDays([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5),
  15,
  "classic 10-package, 5-day case"
);
assertEqual(shipWithinDays([3, 2, 2, 4, 1, 4], 3), 6, "6-package, 3-day case");
assertEqual(shipWithinDays([1, 2, 3, 1, 1], 4), 3, "4-day case");
assertEqual(shipWithinDays([5], 1), 5, "single package, single day");
```

### Approach

This is **binary search on the answer**, the most generally useful
variant in the set: instead of searching the input array, you search the
space of *possible answers* (ship capacities from `max(weights)` to
`sum(weights)`), using a feasibility function (`daysNeeded(capacity)`) as
the monotonic predicate. "Days needed" strictly decreases (or stays flat)
as capacity increases — that monotonicity is the entire justification for
binary search being valid here; it has nothing to do with the input array
being sorted, because it isn't sorted at all.

Brute force would try every capacity from `max(weights)` upward, checking
feasibility at each: `O(n * (sum - max))`, which is pseudo-polynomial and
can be enormous for large weights. Binary searching the capacity range
collapses that to `O(n log(sum - max))`: `O(log(sum - max))` capacity
guesses, each requiring one `O(n)` greedy pass to count days.

**Complexity:** `O(n log(sum(weights) - max(weights)))` time, `O(1)`
space.

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

function shipWithinDays(weights, days) {
  function daysNeeded(capacity) {
    let daysUsed = 1;
    let currentLoad = 0;
    for (const w of weights) {
      if (currentLoad + w > capacity) {
        daysUsed++;
        currentLoad = 0;
      }
      currentLoad += w;
    }
    return daysUsed;
  }

  let lo = Math.max(...weights); // capacity must fit the heaviest package
  let hi = weights.reduce((a, b) => a + b, 0); // shipping everything in 1 day

  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (daysNeeded(mid) <= days) hi = mid; // feasible: try a smaller capacity
    else lo = mid + 1; // infeasible: need more capacity
  }
  return lo;
}

assertEqual(
  shipWithinDays([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5),
  15,
  "classic 10-package, 5-day case"
);
assertEqual(shipWithinDays([3, 2, 2, 4, 1, 4], 3), 6, "6-package, 3-day case");
assertEqual(shipWithinDays([1, 2, 3, 1, 1], 4), 3, "4-day case");
assertEqual(shipWithinDays([5], 1), 5, "single package, single day");
```

### Common pitfalls

- Setting `lo = 0` instead of `lo = max(weights)` — a capacity below the
  heaviest single package is infeasible by definition (packages can't be
  split), and leaving it in the search range wastes iterations without
  causing a wrong answer, but it signals you haven't tightened the bounds
  from the problem's actual constraints.
- Off-by-one in `daysNeeded`: starting `daysUsed` at `0` instead of `1`
  (day one is always used, even if nothing ever exceeds capacity), or
  comparing `currentLoad + w >= capacity` instead of `>` (a package that
  exactly fills remaining capacity should still go on the current day).
- Binary searching on the array of weights instead of on the capacity
  range — the weights aren't sorted and searching them doesn't mean
  anything here; the entire trick is recognizing the search space is the
  *answer*, not the input.

### Staff-level follow-up

**"The feasibility check itself — `daysNeeded` — is currently `O(n)` per
call. If `n` is 10 million packages and this needs to answer repeatedly
for slightly different `days` values (e.g., an interactive 'what capacity
do I need for 3 days vs. 4 days vs. 5 days' UI), how do you avoid redoing
that full `O(n)` scan every time?"** Precompute a prefix-sum array once
(`O(n)`), so for any candidate capacity you can binary search within the
prefix sums to find each day's boundary instead of linearly scanning —
this turns each `daysNeeded` check into `O(log n)` via nested binary
search (binary search on capacity, and within each feasibility check,
binary search on the prefix sums to count days), for an overall
`O(n + log(sum) * log(n))` after the one-time `O(n)` preprocessing. For
genuinely repeated queries with different `days` values, caching feasible
capacities you've already computed and reusing the monotonic relationship
between `days` and minimum capacity (more days allowed ⇒ capacity is
non-increasing) means each subsequent query can tighten its own search
range using the previous answer instead of starting from
`[max(weights), sum(weights)]` every time.
