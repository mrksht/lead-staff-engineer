# Trees, BFS & DFS — DSA Practice (4 of 5)

BFS vs. DFS isn't a style choice — it's dictated by what the problem
actually needs. Need shortest path, level-by-level structure, or "closest
first"? That's BFS, full stop. Need to explore every path, carry
path-dependent state (a running bound, a visited set, a partial sum), or
backtrack? That's DFS. The six problems below cover both traversal styles
on trees, plus the moment a tree problem becomes a graph problem: the
same six lines of cycle-detection on this file.

## Table of Contents

- [Problem 1: Binary Tree Level Order Traversal (Easy/Medium)](#problem-1-binary-tree-level-order-traversal-easymedium)
- [Problem 2: Maximum Depth of Binary Tree (Easy)](#problem-2-maximum-depth-of-binary-tree-easy)
- [Problem 3: Validate Binary Search Tree (Medium)](#problem-3-validate-binary-search-tree-medium)
- [Problem 4: Lowest Common Ancestor of a Binary Tree (Medium)](#problem-4-lowest-common-ancestor-of-a-binary-tree-medium)
- [Problem 5: Serialize and Deserialize Binary Tree (Hard)](#problem-5-serialize-and-deserialize-binary-tree-hard)
- [Problem 6: Course Schedule (Medium)](#problem-6-course-schedule-medium)

---

## Problem 1: Binary Tree Level Order Traversal (Easy/Medium)

Given the root of a binary tree, return the values of its nodes grouped by
level, top to bottom, left to right within each level.

**Examples**
- `[3,9,20,null,null,15,7]` →
  ```
      3
     / \
    9  20
      /  \
     15   7
  ```
  → `[[3], [9, 20], [15, 7]]`
- `[]` (empty tree) → `[]`
- `[1]` (single node) → `[[1]]`

**Clarifying questions a staff engineer asks**
- Is the tree guaranteed non-empty? (If `root` can be `null`, that's the
  first branch to handle, before touching a queue at all.)
- Do I need the values only, or the actual node references per level (the
  latter matters if a caller wants to mutate level-by-level)?
- Is there a node-count or depth bound that would make an iterative queue
  preferable to a level-tracked recursive DFS for stack-depth reasons?

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

function buildTree(arr) {
  // Level-order array with null for missing children, e.g.
  // [3,9,20,null,null,15,7]. Matches LeetCode's BFS-queue encoding:
  // null nodes are never expanded, only non-null nodes consume the next
  // two array slots for their children. Returns { val, left, right } or
  // null for an empty tree.
  if (!arr || arr.length === 0 || arr[0] === null) return null;
  const root = { val: arr[0], left: null, right: null };
  const queue = [root];
  let i = 1;
  while (queue.length > 0 && i < arr.length) {
    const node = queue.shift();
    if (i < arr.length) {
      const leftVal = arr[i++];
      if (leftVal !== null) {
        node.left = { val: leftVal, left: null, right: null };
        queue.push(node.left);
      }
    }
    if (i < arr.length) {
      const rightVal = arr[i++];
      if (rightVal !== null) {
        node.right = { val: rightVal, left: null, right: null };
        queue.push(node.right);
      }
    }
  }
  return root;
}

function levelOrder(root) {
  // TODO: return an array of arrays, one per level, left to right.
  // Target: O(n) time using an explicit queue — process one full level
  // at a time, collecting the next level's nodes as you go.
  return [];
}

assertEqual(
  levelOrder(buildTree([3, 9, 20, null, null, 15, 7])),
  [[3], [9, 20], [15, 7]],
  "standard balanced tree"
);
assertEqual(levelOrder(buildTree([])), [], "empty tree");
assertEqual(levelOrder(buildTree([1])), [[1]], "single node");
assertEqual(
  levelOrder(buildTree([1, 2, 3, 4, null, null, 5])),
  [[1], [2, 3], [4, 5]],
  "unbalanced, null gaps skipped correctly"
);
```

### Approach

DFS can do this (track depth, push into `result[depth]`), but BFS is the
natural fit because the problem's unit of work *is* a level — a queue
processes nodes in the exact order a level needs. Snapshot the current
queue's length before the inner loop; that length is "how many nodes are
in this level," which lets you drain exactly that many nodes (pushing
their children for the next round) without a level ever bleeding into the
next one.

**Complexity:** `O(n)` time (every node enqueued and dequeued once),
`O(n)` space worst case (a fully unbalanced level, e.g. the last level of a
complete tree, can hold up to `n/2` nodes in the queue at once).

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

function buildTree(arr) {
  if (!arr || arr.length === 0 || arr[0] === null) return null;
  const root = { val: arr[0], left: null, right: null };
  const queue = [root];
  let i = 1;
  while (queue.length > 0 && i < arr.length) {
    const node = queue.shift();
    if (i < arr.length) {
      const leftVal = arr[i++];
      if (leftVal !== null) {
        node.left = { val: leftVal, left: null, right: null };
        queue.push(node.left);
      }
    }
    if (i < arr.length) {
      const rightVal = arr[i++];
      if (rightVal !== null) {
        node.right = { val: rightVal, left: null, right: null };
        queue.push(node.right);
      }
    }
  }
  return root;
}

function levelOrder(root) {
  if (root === null) return [];
  const result = [];
  let queue = [root];
  while (queue.length > 0) {
    const level = [];
    const next = [];
    for (const node of queue) {
      level.push(node.val);
      if (node.left) next.push(node.left);
      if (node.right) next.push(node.right);
    }
    result.push(level);
    queue = next;
  }
  return result;
}

assertEqual(
  levelOrder(buildTree([3, 9, 20, null, null, 15, 7])),
  [[3], [9, 20], [15, 7]],
  "standard balanced tree"
);
assertEqual(levelOrder(buildTree([])), [], "empty tree");
assertEqual(levelOrder(buildTree([1])), [[1]], "single node");
assertEqual(
  levelOrder(buildTree([1, 2, 3, 4, null, null, 5])),
  [[1], [2, 3], [4, 5]],
  "unbalanced, null gaps skipped correctly"
);
```

### Common pitfalls

- Using `queue.shift()` in a tight loop on a plain array in a language/
  runtime where that's `O(n)` (it's a real cost in JS too, just not the
  focus here) — for huge trees, a proper ring-buffer or linked-list queue
  avoids the hidden quadratic blowup.
- Forgetting to snapshot the level size (or swap to a fresh `next` array)
  before draining — pushing children directly into the same queue you're
  iterating merges levels together.
- Not handling `root === null` up front and letting the queue-init logic
  throw on `null.val`.

### Staff-level follow-up

**"The tree has 50 million nodes and doesn't fit in memory as a live
object graph — how do you compute level order over it?"** You stop
representing the tree as pointers and switch to an external, serialized
form (adjacency list on disk, or the preorder-with-markers format from
Problem 5) read via a streaming parser. BFS's core requirement — "know
which nodes are at depth `d` before moving to depth `d+1`" — maps onto an
external **frontier file**: write node IDs for the current level to disk,
process them, write the next level's IDs to a new file, repeat. This is
exactly how large-scale graph BFS (e.g., web crawl frontier expansion) is
done at a scale where "just hold it all in RAM" stops being an option.

---

## Problem 2: Maximum Depth of Binary Tree (Easy)

Given the root of a binary tree, return its maximum depth — the number of
nodes along the longest path from the root down to the farthest leaf.

**Examples**
- `[3,9,20,null,null,15,7]` → `3`
- `[]` (empty tree) → `0`
- `[1]` (single node) → `1`
- `[1,2,null,3,null,4]` (left-skewed chain) → `4`

**Clarifying questions a staff engineer asks**
- Does "depth" count nodes (root is depth 1) or edges (root is depth 0)?
  (This example set counts nodes — confirm the convention before writing a
  single line, it's the easiest thing to get silently wrong.)
- Is the tree bounded in height, or could it be deep enough that recursion
  risks a stack overflow? (Changes whether iterative BFS is the safer
  default, not just an "alternative.")
- Balanced or potentially pathologically skewed? (A skewed tree makes
  recursive depth == call-stack depth, which matters for the above.)

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

function buildTree(arr) {
  if (!arr || arr.length === 0 || arr[0] === null) return null;
  const root = { val: arr[0], left: null, right: null };
  const queue = [root];
  let i = 1;
  while (queue.length > 0 && i < arr.length) {
    const node = queue.shift();
    if (i < arr.length) {
      const leftVal = arr[i++];
      if (leftVal !== null) {
        node.left = { val: leftVal, left: null, right: null };
        queue.push(node.left);
      }
    }
    if (i < arr.length) {
      const rightVal = arr[i++];
      if (rightVal !== null) {
        node.right = { val: rightVal, left: null, right: null };
        queue.push(node.right);
      }
    }
  }
  return root;
}

function maxDepth(root) {
  // TODO: return the max depth (node count on the longest root-to-leaf
  // path). Target: O(n) time, simple recursive DFS — depth of a node is
  // 1 + max(depth of left child, depth of right child), with null as the
  // base case returning 0.
  return 0;
}

assertEqual(maxDepth(buildTree([3, 9, 20, null, null, 15, 7])), 3, "standard balanced tree");
assertEqual(maxDepth(buildTree([])), 0, "empty tree");
assertEqual(maxDepth(buildTree([1])), 1, "single node");
assertEqual(maxDepth(buildTree([1, 2, null, 3, null, 4])), 4, "left-skewed chain");
```

### Approach

This is the canonical "trust the recursion" problem: `maxDepth(node)` is
`0` for `null`, otherwise `1 + max(maxDepth(node.left),
maxDepth(node.right))`. No explicit stack management needed — the call
stack *is* the DFS stack.

The iterative BFS alternative: run the same level-order queue drain as
Problem 1, incrementing a counter once per level instead of collecting
values. It does strictly more bookkeeping (queue + next-level array) for
the same answer, but it avoids recursion depth scaling with tree height —
worth defaulting to if the tree could be deep enough to blow a call stack
(a few hundred thousand nodes in a skewed/degenerate tree, depending on
runtime stack size).

**Complexity:** `O(n)` time either way (every node visited once), `O(h)`
space for recursive DFS (`h` = height, call stack) vs. `O(w)` for
iterative BFS (`w` = max width, queue) — pick based on whether the tree is
expected to be tall-and-thin or short-and-wide.

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

function buildTree(arr) {
  if (!arr || arr.length === 0 || arr[0] === null) return null;
  const root = { val: arr[0], left: null, right: null };
  const queue = [root];
  let i = 1;
  while (queue.length > 0 && i < arr.length) {
    const node = queue.shift();
    if (i < arr.length) {
      const leftVal = arr[i++];
      if (leftVal !== null) {
        node.left = { val: leftVal, left: null, right: null };
        queue.push(node.left);
      }
    }
    if (i < arr.length) {
      const rightVal = arr[i++];
      if (rightVal !== null) {
        node.right = { val: rightVal, left: null, right: null };
        queue.push(node.right);
      }
    }
  }
  return root;
}

function maxDepth(root) {
  if (root === null) return 0;
  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}

assertEqual(maxDepth(buildTree([3, 9, 20, null, null, 15, 7])), 3, "standard balanced tree");
assertEqual(maxDepth(buildTree([])), 0, "empty tree");
assertEqual(maxDepth(buildTree([1])), 1, "single node");
assertEqual(maxDepth(buildTree([1, 2, null, 3, null, 4])), 4, "left-skewed chain");
```

### Common pitfalls

- Off-by-one on the base case — returning `1` instead of `0` for `null`
  double-counts the "virtual" leaf-below-a-leaf and inflates every depth
  by one.
- Computing `max(leftDepth, rightDepth)` *before* recursing (i.e., trying
  to short-circuit) — both subtrees must actually be visited; there's no
  valid early exit for "depth," unlike, say, a existence check.
- Assuming recursion is always fine — on a sufficiently pathological
  (near-linked-list) input, recursive DFS can stack-overflow where
  iterative BFS wouldn't.

### Staff-level follow-up

**"How would you compute max depth for a million independent trees as
fast as possible, given multiple cores?"** Each tree's depth computation
is embarrassingly parallel relative to the others — dispatch one tree per
worker (thread pool, worker_threads in Node, or a map step in a
distributed job) and reduce with a simple max over results. Within a
single very large tree, parallelizing further is possible but has
diminishing returns: you'd split at some depth threshold and fan out
subtree computations, but the coordination overhead (spawning tasks,
collecting results) usually outweighs the win unless subtrees are
themselves enormous — know the difference between "many small
independent problems" (trivially parallel) and "one problem parallelized
internally" (much harder to get a net win from).

---

## Problem 3: Validate Binary Search Tree (Medium)

Given the root of a binary tree, determine if it is a valid **binary
search tree (BST)**: for every node, all values in its left subtree are
strictly less than the node's value, and all values in its right subtree
are strictly greater.

**Examples**
- `[5,3,8,1,4,7,9]` → `true` (valid, balanced BST)
- `[5,1,8,null,null,4,9]` → `false` — the classic trap: `4` is less than
  its immediate parent `8` (looks locally fine), but `4` is also in `5`'s
  *right* subtree, where every value must exceed `5`. `4 < 5` violates the
  global constraint even though it satisfies the local one.
- `[1]` → `true` (single node, vacuously valid)
- `[2,2,2]` → `false` (duplicate values violate strict inequality)

**Clarifying questions a staff engineer asks**
- Strict inequality (`<`, `>`) or are equal values on one side allowed?
  (Most BST definitions are strict — no duplicates — but this is the kind
  of assumption to state out loud before writing the bound check.)
- Can node values be arbitrarily large, to the point where `Infinity`/
  `-Infinity` sentinels for the initial bounds could collide with real
  data? (Not an issue with plain JS numbers in practice, but worth
  flagging as a language-dependent assumption — it *would* matter in a
  language with fixed-width integers.)
- Is an empty tree considered valid? (Yes, by convention — confirm it
  rather than assume.)

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

function buildTree(arr) {
  if (!arr || arr.length === 0 || arr[0] === null) return null;
  const root = { val: arr[0], left: null, right: null };
  const queue = [root];
  let i = 1;
  while (queue.length > 0 && i < arr.length) {
    const node = queue.shift();
    if (i < arr.length) {
      const leftVal = arr[i++];
      if (leftVal !== null) {
        node.left = { val: leftVal, left: null, right: null };
        queue.push(node.left);
      }
    }
    if (i < arr.length) {
      const rightVal = arr[i++];
      if (rightVal !== null) {
        node.right = { val: rightVal, left: null, right: null };
        queue.push(node.right);
      }
    }
  }
  return root;
}

function isValidBST(root) {
  // TODO: return true iff every node's value falls strictly between the
  // tightening (lowerBound, upperBound) inherited from its ancestors —
  // NOT just a check against its immediate children. Target: O(n) time,
  // single DFS pass carrying bounds down through recursive calls.
  return false;
}

assertEqual(isValidBST(buildTree([5, 3, 8, 1, 4, 7, 9])), true, "valid balanced BST");
assertEqual(
  isValidBST(buildTree([5, 1, 8, null, null, 4, 9])),
  false,
  "classic trap: 4 passes local check against 8 but violates global lower bound of 5"
);
assertEqual(isValidBST(buildTree([1])), true, "single node");
assertEqual(isValidBST(buildTree([])), true, "empty tree is vacuously valid");
assertEqual(isValidBST(buildTree([2, 2, 2])), false, "duplicate values violate strict BST ordering");
```

### Approach

The naive/wrong approach checks `node.val > node.left.val && node.val <
node.right.val` — i.e., only the immediate children. That's necessary but
not sufficient: a node two or more levels down can violate a constraint
inherited from a much higher ancestor (exactly the `[5,1,8,null,null,4,9]`
trap above). The fix is carrying a `(lowerBound, upperBound)` range down
through the recursion: the root starts with `(-Infinity, Infinity)`;
descending left tightens the upper bound to the parent's value, descending
right tightens the lower bound. Every node must fall strictly inside its
inherited range, not just satisfy a comparison with its direct children.

An alternative: an in-order traversal of a valid BST produces values in
strictly increasing order — collect the traversal and check it's sorted
with no duplicates. Same complexity, different mental model (global
invariant on the traversal vs. local invariant propagated through
recursion).

**Complexity:** `O(n)` time (every node visited once), `O(h)` space for
the recursion stack (`h` = tree height).

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

function buildTree(arr) {
  if (!arr || arr.length === 0 || arr[0] === null) return null;
  const root = { val: arr[0], left: null, right: null };
  const queue = [root];
  let i = 1;
  while (queue.length > 0 && i < arr.length) {
    const node = queue.shift();
    if (i < arr.length) {
      const leftVal = arr[i++];
      if (leftVal !== null) {
        node.left = { val: leftVal, left: null, right: null };
        queue.push(node.left);
      }
    }
    if (i < arr.length) {
      const rightVal = arr[i++];
      if (rightVal !== null) {
        node.right = { val: rightVal, left: null, right: null };
        queue.push(node.right);
      }
    }
  }
  return root;
}

function isValidBST(root) {
  function dfs(node, lowerBound, upperBound) {
    if (node === null) return true;
    if (node.val <= lowerBound || node.val >= upperBound) return false;
    return dfs(node.left, lowerBound, node.val) && dfs(node.right, node.val, upperBound);
  }
  return dfs(root, -Infinity, Infinity);
}

assertEqual(isValidBST(buildTree([5, 3, 8, 1, 4, 7, 9])), true, "valid balanced BST");
assertEqual(
  isValidBST(buildTree([5, 1, 8, null, null, 4, 9])),
  false,
  "classic trap: 4 passes local check against 8 but violates global lower bound of 5"
);
assertEqual(isValidBST(buildTree([1])), true, "single node");
assertEqual(isValidBST(buildTree([])), true, "empty tree is vacuously valid");
assertEqual(isValidBST(buildTree([2, 2, 2])), false, "duplicate values violate strict BST ordering");
```

### Common pitfalls

- **The trap that defines this problem**: validating only
  `node.val < node.left.val` / `node.val > node.right.val` against
  immediate children. This passes for inputs where a deep node violates a
  constraint from a distant ancestor, not a parent — always propagate
  tightening bounds, never just compare one level down.
- Using non-strict comparisons (`<=`/`>=`) when the spec requires strict
  ordering — silently accepts trees with duplicate values as valid BSTs.
- Seeding initial bounds with finite sentinels (e.g., `-Infinity` replaced
  by `Number.MIN_SAFE_INTEGER`) that could theoretically collide with real
  node values at the extremes — use actual infinities when the language
  supports them.

### Staff-level follow-up

**"The tree has 10 million nodes and you need to validate it without
loading the whole thing into memory — what changes?"** The bound-
propagation DFS is already memory-light relative to the tree itself
(`O(h)` stack, not `O(n)`), so the real constraint becomes *where the tree
lives*. If it's on disk as a serialized structure (adjacency list, or the
preorder format from Problem 5), you stream-parse node-by-node in
preorder, carrying the same `(lowerBound, upperBound)` pair through an
explicit stack instead of the call stack — same algorithm, same
complexity, just trading implicit recursion for an explicit stack so you
control memory and can checkpoint/resume mid-validation if the stream is
interrupted. The invariant you're propagating doesn't change; only the
mechanism carrying it does.

---

## Problem 4: Lowest Common Ancestor of a Binary Tree (Medium)

Given the root of a binary tree (**not** a BST — no ordering property to
exploit) and two nodes `p` and `q` guaranteed to exist in the tree, find
their lowest common ancestor: the deepest node that has both `p` and `q`
as descendants (a node is allowed to be its own descendant).

**Examples** (tree `[3,5,1,6,2,0,8,null,null,7,4]`)
```
          3
        /   \
       5     1
      / \   / \
     6   2 0   8
        / \
       7   4
```
- `p = 5, q = 1` → `3` (different subtrees of the root — root is the split
  point)
- `p = 5, q = 4` → `5` (`4` is a descendant of `5` — `5` itself is the
  answer)
- `p = 7, q = 4` → `2` (both are leaves sharing an immediate parent)

**Clarifying questions a staff engineer asks**
- Is this a BST, where I could exploit value ordering to avoid visiting
  both subtrees? (Explicitly not here — general tree, no shortcuts from
  ordering, must actually search both sides.)
- Are `p` and `q` guaranteed to both exist in the tree? (Changes whether
  the function needs a "not found" path, or can assume success.)
- Can `p` be an ancestor of `q` (or vice versa)? (Yes, per the LCA
  definition — a node can be its own ancestor — the second example above
  exercises exactly this.)
- Are node references unique/identity-comparable, or could I only have
  values to search by? (Matters for how `p`/`q` are actually passed in —
  by reference, which is what the recursion below bubbles.)

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

function buildTree(arr) {
  if (!arr || arr.length === 0 || arr[0] === null) return null;
  const root = { val: arr[0], left: null, right: null };
  const queue = [root];
  let i = 1;
  while (queue.length > 0 && i < arr.length) {
    const node = queue.shift();
    if (i < arr.length) {
      const leftVal = arr[i++];
      if (leftVal !== null) {
        node.left = { val: leftVal, left: null, right: null };
        queue.push(node.left);
      }
    }
    if (i < arr.length) {
      const rightVal = arr[i++];
      if (rightVal !== null) {
        node.right = { val: rightVal, left: null, right: null };
        queue.push(node.right);
      }
    }
  }
  return root;
}

function findNode(root, val) {
  // Test helper only: locates the actual node reference for a given
  // value, since the real lowestCommonAncestor signature takes node
  // references (p, q), not values.
  if (root === null) return null;
  if (root.val === val) return root;
  return findNode(root.left, val) || findNode(root.right, val);
}

function lowestCommonAncestor(root, p, q) {
  // TODO: return the node that is the lowest common ancestor of p and q.
  // Target: O(n) time, single DFS pass. At each node, recurse into both
  // children; if a subtree's recursive call "finds" p or q, that result
  // bubbles up. A node where BOTH sides bubble up a find is the LCA.
  return null;
}

const tree = buildTree([3, 5, 1, 6, 2, 0, 8, null, null, 7, 4]);
const lca1 = lowestCommonAncestor(tree, findNode(tree, 5), findNode(tree, 1));
assertEqual(lca1 && lca1.val, 3, "p and q in different subtrees -> root is LCA");

const lca2 = lowestCommonAncestor(tree, findNode(tree, 5), findNode(tree, 4));
assertEqual(lca2 && lca2.val, 5, "q is a deep descendant of p -> p itself is the LCA");

const lca3 = lowestCommonAncestor(tree, findNode(tree, 7), findNode(tree, 4));
assertEqual(lca3 && lca3.val, 2, "two leaves sharing an immediate parent");

const singleNodeTree = buildTree([1]);
const lca4 = lowestCommonAncestor(singleNodeTree, singleNodeTree, singleNodeTree);
assertEqual(lca4 && lca4.val, 1, "edge case: p and q are the same single node");
```

### Approach

Because this is a general tree (no BST ordering to exploit), there's no
shortcut for "which subtree to search" — you must explore both sides.
The recursive pattern: `dfs(node)` returns `node` itself if `node` is `p`,
`q`, or `null`; otherwise it recurses into both children and inspects what
bubbled up. If *both* sides bubble up a non-null result, `node` is the
split point where `p` and `q`'s paths diverge — that makes `node` the LCA.
If only one side bubbles up something, pass that straight through
(handles the "one is an ancestor of the other" case: the ancestor itself
bubbles all the way up unchanged, since it matches `node === p` or
`node === q` the moment it's reached).

Contrast with a BST: there, you can compare `p.val`/`q.val` against
`node.val` and descend into exactly one subtree, no backtracking needed,
`O(h)` time with no exploration of the other side at all. The general-tree
version must potentially touch every node.

**Complexity:** `O(n)` time (every node visited once in the worst case),
`O(h)` space (recursion stack).

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

function buildTree(arr) {
  if (!arr || arr.length === 0 || arr[0] === null) return null;
  const root = { val: arr[0], left: null, right: null };
  const queue = [root];
  let i = 1;
  while (queue.length > 0 && i < arr.length) {
    const node = queue.shift();
    if (i < arr.length) {
      const leftVal = arr[i++];
      if (leftVal !== null) {
        node.left = { val: leftVal, left: null, right: null };
        queue.push(node.left);
      }
    }
    if (i < arr.length) {
      const rightVal = arr[i++];
      if (rightVal !== null) {
        node.right = { val: rightVal, left: null, right: null };
        queue.push(node.right);
      }
    }
  }
  return root;
}

function findNode(root, val) {
  if (root === null) return null;
  if (root.val === val) return root;
  return findNode(root.left, val) || findNode(root.right, val);
}

function lowestCommonAncestor(root, p, q) {
  if (root === null || root === p || root === q) return root;
  const left = lowestCommonAncestor(root.left, p, q);
  const right = lowestCommonAncestor(root.right, p, q);
  if (left && right) return root; // p and q found in different subtrees -> root is the split point
  return left || right; // bubble up whichever side found something (or null)
}

const tree = buildTree([3, 5, 1, 6, 2, 0, 8, null, null, 7, 4]);
const lca1 = lowestCommonAncestor(tree, findNode(tree, 5), findNode(tree, 1));
assertEqual(lca1 && lca1.val, 3, "p and q in different subtrees -> root is LCA");

const lca2 = lowestCommonAncestor(tree, findNode(tree, 5), findNode(tree, 4));
assertEqual(lca2 && lca2.val, 5, "q is a deep descendant of p -> p itself is the LCA");

const lca3 = lowestCommonAncestor(tree, findNode(tree, 7), findNode(tree, 4));
assertEqual(lca3 && lca3.val, 2, "two leaves sharing an immediate parent");

const singleNodeTree = buildTree([1]);
const lca4 = lowestCommonAncestor(singleNodeTree, singleNodeTree, singleNodeTree);
assertEqual(lca4 && lca4.val, 1, "edge case: p and q are the same single node");
```

### Common pitfalls

- Comparing by *value* (`node.val === p.val`) instead of by *reference*
  (`node === p`) — breaks the moment the tree contains duplicate values,
  since the real problem identifies `p` and `q` as specific node objects,
  not values.
- Mishandling the "one is an ancestor of the other" case by requiring
  *both* sides to return non-null before considering a node a candidate —
  the correct logic also accepts a single non-null bubble-up as the
  answer when recursion unwinds without ever finding a second match.
- Forgetting that `root === p || root === q` must be checked *before*
  recursing into children — otherwise you could recurse past the node you
  were looking for and lose it.

### Staff-level follow-up

**"What if this query runs millions of times per second against the same
static tree — is per-query O(n) acceptable?"** No — if the tree is
static and queries are frequent, precompute once: do a single DFS to
record each node's parent pointer and depth, then answer each LCA query in
`O(h)` by walking both nodes up to equal depth and then together until
they match (or in `O(log n)` with binary lifting / Euler tour + sparse
table for `O(1)` queries after `O(n log n)` preprocessing). The core
tradeoff is identical to the classic "online vs. offline" query shape:
one-off query → the `O(n)` DFS above is fine; repeated queries against a
fixed structure → pay a preprocessing cost once to make every subsequent
query far cheaper.

---

## Problem 5: Serialize and Deserialize Binary Tree (Hard)

Design an algorithm to encode a binary tree into a single string
(`serialize`) and decode that string back into the exact same tree
structure (`deserialize`). The round trip must preserve structure exactly
— including which children are missing — not just the set of values.

**Examples**
- `buildTree([1])` → `serialize` → `"1,#,#"` → `deserialize` → a tree
  identical in structure to the original single-node tree.
- `buildTree([])` (`null` root) → `serialize` → `"#"` → `deserialize` →
  `null`.
- `buildTree([3,9,20,null,null,15,7])` → round trip reproduces the exact
  same shape.

**Clarifying questions a staff engineer asks**
- Does the encoding need to be human-readable/compact, or is correctness
  the only bar? (Changes whether you'd reach for preorder-with-markers vs.
  a tighter binary/varint encoding.)
- Can node values contain the delimiter character itself (e.g., a comma
  inside a string value)? (If values aren't guaranteed numeric/delimiter-
  free, you need length-prefixing or escaping, not naive `split(",")`.)
- Does the tree need to survive serialize/deserialize across different
  language runtimes (e.g., written by a Node service, read by a Python
  one)? (Pushes toward a strictly-specified wire format rather than
  anything JS-object-specific.)

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

function buildTree(arr) {
  if (!arr || arr.length === 0 || arr[0] === null) return null;
  const root = { val: arr[0], left: null, right: null };
  const queue = [root];
  let i = 1;
  while (queue.length > 0 && i < arr.length) {
    const node = queue.shift();
    if (i < arr.length) {
      const leftVal = arr[i++];
      if (leftVal !== null) {
        node.left = { val: leftVal, left: null, right: null };
        queue.push(node.left);
      }
    }
    if (i < arr.length) {
      const rightVal = arr[i++];
      if (rightVal !== null) {
        node.right = { val: rightVal, left: null, right: null };
        queue.push(node.right);
      }
    }
  }
  return root;
}

function serialize(root) {
  // TODO: encode the tree into a single comma-separated string using
  // preorder traversal (node, then left, then right), with "#" marking
  // a null child. Target: O(n) time/space.
  return "";
}

function deserialize(data) {
  // TODO: decode the string produced by serialize() back into the exact
  // same { val, left, right } tree structure. Target: O(n) time —
  // consume tokens in the same preorder sequence they were written in.
  return null;
}

assertEqual(serialize(buildTree([1])), "1,#,#", "preorder encoding of a single node");
assertEqual(serialize(buildTree([])), "#", "preorder encoding of an empty tree");

const original1 = buildTree([3, 9, 20, null, null, 15, 7]);
assertEqual(
  deserialize(serialize(original1)),
  original1,
  "round-trip on standard balanced tree preserves structure"
);

assertEqual(deserialize(serialize(buildTree([]))), null, "round-trip on empty tree returns null");

const original2 = buildTree([1, 2, null, 3, null, 4]);
assertEqual(
  deserialize(serialize(original2)),
  original2,
  "round-trip on left-skewed unbalanced tree preserves structure"
);
```

### Approach

Preorder (node, then left subtree, then right subtree) is the natural
choice because it's self-describing when nulls are marked explicitly: the
very first token tells you the root (or that the tree is empty), and
every subsequent token's position is fully determined by the recursive
structure you're rebuilding — no need to separately encode subtree
lengths. `serialize` does a DFS, pushing the node's value or `"#"` for
`null`, joined by commas. `deserialize` walks the same token list with a
shared index, consuming exactly one token per `null` and three logical
"slots" (value, left-subtree-result, right-subtree-result) per real node
— the recursion structure mirrors `serialize`'s exactly, which is why
preorder-with-markers round-trips losslessly without extra metadata.

Level-order (BFS) with markers also works but needs more careful queue
bookkeeping on the decode side; preorder's recursive symmetry between
encode and decode makes it the cleaner default here.

**Complexity:** `O(n)` time and space for both directions (every node
visited once, string length proportional to node count).

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

function buildTree(arr) {
  if (!arr || arr.length === 0 || arr[0] === null) return null;
  const root = { val: arr[0], left: null, right: null };
  const queue = [root];
  let i = 1;
  while (queue.length > 0 && i < arr.length) {
    const node = queue.shift();
    if (i < arr.length) {
      const leftVal = arr[i++];
      if (leftVal !== null) {
        node.left = { val: leftVal, left: null, right: null };
        queue.push(node.left);
      }
    }
    if (i < arr.length) {
      const rightVal = arr[i++];
      if (rightVal !== null) {
        node.right = { val: rightVal, left: null, right: null };
        queue.push(node.right);
      }
    }
  }
  return root;
}

function serialize(root) {
  const vals = [];
  function dfs(node) {
    if (node === null) {
      vals.push("#");
      return;
    }
    vals.push(String(node.val));
    dfs(node.left);
    dfs(node.right);
  }
  dfs(root);
  return vals.join(",");
}

function deserialize(data) {
  const vals = data.split(",");
  let i = 0;
  function dfs() {
    const token = vals[i++];
    if (token === "#") return null;
    const node = { val: Number(token), left: null, right: null };
    node.left = dfs();
    node.right = dfs();
    return node;
  }
  return dfs();
}

assertEqual(serialize(buildTree([1])), "1,#,#", "preorder encoding of a single node");
assertEqual(serialize(buildTree([])), "#", "preorder encoding of an empty tree");

const original1 = buildTree([3, 9, 20, null, null, 15, 7]);
assertEqual(
  deserialize(serialize(original1)),
  original1,
  "round-trip on standard balanced tree preserves structure"
);

assertEqual(deserialize(serialize(buildTree([]))), null, "round-trip on empty tree returns null");

const original2 = buildTree([1, 2, null, 3, null, 4]);
assertEqual(
  deserialize(serialize(original2)),
  original2,
  "round-trip on left-skewed unbalanced tree preserves structure"
);
```

### Common pitfalls

- Using a single global mutable index variable without care in
  `deserialize` — easy to get right in JS via closure (as above), but a
  classic bug in languages without closures over mutable locals: the
  index must be threaded through or shared via a mutable reference, not
  copied by value across recursive calls.
- Forgetting to mark nulls at all (just recording non-null values in
  preorder) — without explicit null markers, the decoder can't tell where
  one subtree ends and another begins; preorder values alone are
  ambiguous for anything but a full/complete binary tree.
- Assuming values never contain the delimiter — naive `split(",")`
  silently corrupts data if a value could legitimately contain a comma
  (not an issue with plain numeric values here, but a real production
  concern for arbitrary string payloads).

### Staff-level follow-up

**"This tree gets serialized and sent over the network between services
— what changes about the format?"** Three things stop being
implementation details and start being contract: (1) **versioning** — add
a format-version prefix so a future encoding change doesn't silently
break old consumers; (2) **size** — a text format with commas and
digit-strings is wasteful at scale; a binary format (fixed-width value
encoding, a length-prefixed byte stream, or an existing scheme like
Protocol Buffers with a `oneof` for null/value) cuts payload size
significantly; (3) **robustness** — network payloads can be truncated,
reordered, or corrupted, so you'd want a checksum/length header and
explicit error handling in `deserialize` rather than trusting `vals[i++]`
to always return a well-formed token. The algorithmic core (preorder with
null markers) doesn't change; everything around it protecting against a
hostile or unreliable transport does.

---

## Problem 6: Course Schedule (Medium)

There are `numCourses` courses labeled `0` to `numCourses - 1`. You're
given `prerequisites`, where `prerequisites[i] = [course, prereq]` means
you must take `prereq` before `course`. Return `true` if it's possible to
finish all courses, `false` otherwise.

This is a graph problem, not a tree problem — the same DFS you've been
running on trees for the last five problems applies directly to a general
graph, with one new wrinkle: **graphs can have cycles**, and a tree by
definition can't. "Can all courses be finished" is exactly "does this
directed graph have a cycle" — if it does, some set of courses depends on
itself, directly or transitively, and can never be scheduled.

**Examples**
- `numCourses = 2, prerequisites = [[1, 0]]` → `true` (take `0`, then `1`)
- `numCourses = 2, prerequisites = [[1, 0], [0, 1]]` → `false` (`0` needs
  `1`, `1` needs `0` — direct cycle)
- `numCourses = 4, prerequisites = [[1,0],[2,0],[3,1],[3,2]]` → `true`
  (diamond-shaped dependency graph, no cycle, multiple valid orders exist)

**Clarifying questions a staff engineer asks**
- Is this asking "is it possible" (boolean) or "give me a valid order"
  (topological sort)? (Different return type, same core cycle-detection
  machinery — Kahn's algorithm naturally produces an order as a byproduct;
  pure DFS cycle detection doesn't unless you record the postorder.)
- Can `prerequisites` contain duplicate or self-referential entries (a
  course listed as its own prerequisite)? (A self-loop is trivially a
  cycle — worth confirming the input isn't assumed pre-validated.)
- DFS-based cycle detection or Kahn's (BFS, in-degree-based) topological
  sort — any preference, or is either acceptable? (Both are `O(V + E)`;
  DFS is usually less code, Kahn's generalizes more naturally to "give me
  an actual order" and parallelizes better since each round processes all
  zero-in-degree nodes at once.)

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

function canFinish(numCourses, prerequisites) {
  // TODO: return true iff the dependency graph has no cycle.
  // Target: O(V + E) time. Build an adjacency list (prereq -> course),
  // then DFS from every unvisited node using a 3-state marker
  // (unvisited / currently-visiting / done) — revisiting a
  // currently-visiting node means you've found a cycle.
  return false;
}

assertEqual(canFinish(2, [[1, 0]]), true, "simple linear dependency, no cycle");
assertEqual(canFinish(2, [[1, 0], [0, 1]]), false, "direct two-node cycle");
assertEqual(
  canFinish(4, [[1, 0], [2, 0], [3, 1], [3, 2]]),
  true,
  "diamond-shaped DAG, multiple paths but no cycle"
);
assertEqual(
  canFinish(3, [[1, 0], [2, 1], [0, 2]]),
  false,
  "longer three-node cycle: 0 -> 1 -> 2 -> 0"
);
```

### Approach

Build an adjacency list: an edge `prereq -> course` for each pair (taking
`prereq` unlocks `course`). This is identical in spirit to the
`left`/`right` pointers in every tree problem above, generalized to "zero
or more children" instead of "exactly two," plus the possibility of
revisiting a node through a different path — which a tree's "no cycles"
guarantee rules out by construction.

DFS with a 3-state marker per node (`UNVISITED`, `VISITING`, `DONE`)
detects cycles directly: entering `dfs(node)`, mark it `VISITING`; if a
recursive call reaches a node already marked `VISITING`, that's a back
edge — a cycle. If a DFS from a node completes with no cycle found, mark
it `DONE` so other DFS calls can short-circuit through it without
re-exploring.

The BFS alternative, **Kahn's algorithm**: compute in-degree for every
node, repeatedly remove (and decrement neighbors' in-degree for) any node
with in-degree `0`. If you remove all `numCourses` nodes, there's no
cycle; if you get stuck with nodes remaining and none at in-degree `0`,
those remaining nodes form a cycle. Kahn's is the natural fit if you also
need the actual course order, since the removal sequence *is* a valid
topological order.

**Complexity:** `O(V + E)` time (every node and edge visited once;
`V` = `numCourses`, `E` = `prerequisites.length`), `O(V + E)` space for
the adjacency list.

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

function canFinish(numCourses, prerequisites) {
  const graph = Array.from({ length: numCourses }, () => []);
  for (const [course, prereq] of prerequisites) {
    graph[prereq].push(course); // edge: prereq -> course
  }

  const UNVISITED = 0, VISITING = 1, DONE = 2;
  const state = new Array(numCourses).fill(UNVISITED);

  function hasCycleFrom(node) {
    if (state[node] === VISITING) return true; // back edge -> cycle
    if (state[node] === DONE) return false; // already proven cycle-free
    state[node] = VISITING;
    for (const next of graph[node]) {
      if (hasCycleFrom(next)) return true;
    }
    state[node] = DONE;
    return false;
  }

  for (let i = 0; i < numCourses; i++) {
    if (hasCycleFrom(i)) return false;
  }
  return true;
}

assertEqual(canFinish(2, [[1, 0]]), true, "simple linear dependency, no cycle");
assertEqual(canFinish(2, [[1, 0], [0, 1]]), false, "direct two-node cycle");
assertEqual(
  canFinish(4, [[1, 0], [2, 0], [3, 1], [3, 2]]),
  true,
  "diamond-shaped DAG, multiple paths but no cycle"
);
assertEqual(
  canFinish(3, [[1, 0], [2, 1], [0, 2]]),
  false,
  "longer three-node cycle: 0 -> 1 -> 2 -> 0"
);
```

### Common pitfalls

- Using a plain 2-state `visited` boolean instead of 3 states — without a
  distinct "currently on the recursion stack" state, you can't tell a
  legitimate "already fully explored, known safe" revisit (fine) from a
  "currently being explored by an ancestor call" revisit (a cycle). This
  is the single most common bug in DFS cycle detection.
- Forgetting to mark a node `DONE` after its DFS completes without a
  cycle — without memoizing "safe" nodes, a diamond-shaped graph (shared
  dependencies, no cycle) gets re-explored exponentially instead of
  linearly.
- Building the adjacency list backwards (`course -> prereq` instead of
  `prereq -> course`, or vice versa depending on which direction you
  intend to walk) — the algorithm is correct either way *as long as
  you're consistent*, but mixing conventions mid-implementation produces
  silently wrong results, not a crash.

### Staff-level follow-up

**"This is really a build-dependency graph (package A depends on B, B on
C) with 100,000 packages — what actually breaks at that scale, and how
does the production version differ from this interview version?"** The
algorithm itself (`O(V + E)`) scales fine arithmetically — the real issues
are operational: (1) **incremental updates** — a real dependency graph
changes over time (new package version added), and re-running full cycle
detection on every change is wasteful; production systems maintain the
topological order incrementally and only re-validate the affected
subgraph. (2) **cycle diagnostics** — "returns false" is useless to a
developer; production tooling needs to report the *actual cycle path*
(A→B→C→A) so someone can fix it, which means tracking the DFS path
explicitly, not just a boolean. (3) **parallelism** — Kahn's algorithm's
"process all zero-in-degree nodes this round" structure maps directly
onto "build all packages with no pending dependencies in parallel, in
this stage" — which is exactly how real build systems (Bazel, Make with
`-j`) schedule work, and is a concrete reason Kahn's is often preferred
over DFS in production dependency-graph tooling despite DFS being less
code to write in an interview.
