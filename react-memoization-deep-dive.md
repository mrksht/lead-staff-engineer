# React Memoization — Deep Dive

## Table of Contents

- [Referential Equality](#referential-equality)
- [Shallow Comparison](#shallow-comparison)
- [React.memo Deep Dive](#reactmemo-deep-dive)
- [useMemo vs useCallback](#usememo-vs-usecallback)
- [When Memoization Works](#when-memoization-works)
- [When Memoization is Useless](#when-memoization-is-useless)
- [When Memoization is Harmful](#when-memoization-is-harmful)
- [The Derived State Trap](#the-derived-state-trap)
- [Purity and Mutation](#purity-and-mutation)
- [React Compiler](#react-compiler)
- [Interview Questions](#interview-questions)

---

## Referential Equality

The foundation everything else sits on.

### Primitives vs Objects

```
PRIMITIVES (compared by VALUE):
  "hello" === "hello"     → true
  42 === 42               → true
  true === true           → true
  null === null           → true

OBJECTS (compared by REFERENCE):
  {} === {}               → false   (two different objects in memory)
  [] === []               → false   (two different arrays in memory)
  () => {} === () => {}   → false   (two different functions in memory)
```

Every `{}`, `[]`, or `() => {}` allocates a new object in memory with a unique address. `===` asks "is this the SAME box?" not "do the boxes contain the same stuff?"

```js
const a = { name: "Rak" };    // memory: 0x001
const b = { name: "Rak" };    // memory: 0x002
a === b  →  false             // same content, different boxes

const c = a;                  // c points to 0x001
a === c  →  true              // same box
```

### Why React Cares

React needs to answer: "Did this value change?" It uses `===` to check.

```jsx
function App() {
  const style = { color: "red" };       // new object every render
  const handleClick = () => {};         // new function every render
  return <Child style={style} onClick={handleClick} />;
}
```

```
Render 1: style = 0x001, handleClick = 0x003
Render 2: style = 0x002, handleClick = 0x004

React: 0x001 === 0x002 → false → "style changed!"
But content is identical. React doesn't know that.
```

### Reference Stability Spectrum

```
ALWAYS STABLE (same reference across renders):
  ├── useState setter (setCount)           ← React guarantees
  ├── useReducer dispatch                  ← React guarantees
  ├── useRef object (the ref itself)       ← created once
  └── module-level constants               ← defined outside component

STABLE IF YOU OPT IN:
  ├── useCallback(fn, deps)                ← same ref if deps unchanged
  └── useMemo(factory, deps)               ← same ref if deps unchanged

NEVER STABLE (new reference every render):
  ├── const obj = { ... }                  ← inline object
  ├── const fn = () => { ... }             ← inline function
  ├── const arr = items.filter(...)        ← computed array
  └── const jsx = <Child />               ← JSX element object
```

---

## Shallow Comparison

The exact algorithm `React.memo` uses internally.

### The Algorithm

```js
function shallowEqual(prevProps, nextProps) {
  if (prevProps === nextProps) return true;

  if (typeof prevProps !== 'object' || prevProps === null ||
      typeof nextProps !== 'object' || nextProps === null) {
    return false;
  }

  const prevKeys = Object.keys(prevProps);
  const nextKeys = Object.keys(nextProps);
  if (prevKeys.length !== nextKeys.length) return false;

  for (let i = 0; i < prevKeys.length; i++) {
    const key = prevKeys[i];
    if (!nextProps.hasOwnProperty(key) ||
        prevProps[key] !== nextProps[key]) {   // ← === comparison
      return false;
    }
  }
  return true;
}
```

### What Shallow Catches vs Misses

```
props = {
  name: "Rak",              ← checks with ===  ✅ works (primitive)
  count: 42,                ← checks with ===  ✅ works (primitive)
  style: { color: "red" },  ← checks with ===  ❌ fails (new object)
  │                              does NOT look inside style
  └── color: "red"           ← NEVER reached. Shallow stops at level 1.
}
```

```
Prop type              Shallow catches it?
─────────────────────────────────────────────
string                 ✅ Yes         "hello" === "hello"
number                 ✅ Yes         42 === 42
boolean                ✅ Yes         true === true
same object ref        ✅ Yes         obj === obj (same ref)
new object, same data  ❌ No          {} === {} → false
inline function        ❌ No          ()=>{} === ()=>{} → false
new array, same items  ❌ No          [1,2] === [1,2] → false
```

> **Shallow comparison works when all props are primitives or stable references. It breaks when any prop is a new object/function/array created during render.**

---

## React.memo Deep Dive

### What It Does

A higher-order component that adds a prop-check gate before rendering:

```
Without React.memo:
  Parent renders → Child renders (always)

With React.memo:
  Parent renders → memo gate → "did props change?"
                                    ├── Yes → Child renders
                                    └── No  → skip, reuse last output
```

### Three Forms

```jsx
// Form 1: Named function
const MemoizedChild = React.memo(function Child({ name }) {
  return <div>{name}</div>;
});

// Form 2: Inline
const Child = React.memo(({ name }) => <div>{name}</div>);

// Form 3: Custom comparator
const Child = React.memo(
  function Child({ user, onClick }) {
    return <div onClick={onClick}>{user.name}</div>;
  },
  (prevProps, nextProps) => {
    // return true = SKIP render (props are "equal")
    // return false = RE-RENDER (props "changed")
    return prevProps.user.id === nextProps.user.id;
  }
);
```

### Custom Comparator Danger: Stale Closures

```jsx
const handleSelect = (id) => {
  if (id === selectedId) {       // captures selectedId in closure
    console.log("Already selected!");
    return;
  }
  setSelectedId(id);
};

const UserCard = React.memo(
  function UserCard({ user, onSelect }) { ... },
  (prev, next) => prev.user.id === next.user.id  // ignores onSelect
);
```

```
Render 1: selectedId = null → handleSelect = function#A (closure: null)
Render 2: selectedId = 5   → handleSelect = function#B (closure: 5)

Comparator ignores onSelect → UserCard keeps function#A
UserCard calls function#A → still sees selectedId = null → BUG
```

**Prefer fixing props to be stable (useCallback) over writing custom comparators.**

### What Memo Does NOT Protect Against

```
React.memo checks:    ✅ Props
React.memo ignores:   ❌ Context changes (bypasses memo)
                      ❌ Internal state (useState/useReducer)
                      ❌ Key changes (unmount/remount)
```

```
Full decision flow:

  Is component wrapped in React.memo?
    ├── No  → RE-RENDER (always)
    └── Yes → Props changed?
                ├── Yes → RE-RENDER
                └── No  → Context changed?
                            ├── Yes → RE-RENDER
                            └── No  → SKIP ✅
```

### One Unstable Prop Defeats Entire Memo

```jsx
<Header
  title="My App"                       // ← stable (primitive)
  style={{ color: "red" }}             // ← UNSTABLE (new object)
/>

// Memo checks: title ✅, style ❌ → re-renders
// Net result: SLOWER than no memo (paid comparison cost + still rendered)
```

---

## useMemo vs useCallback

### Core Difference

```
useMemo    → caches a VALUE (calls the factory, stores the result)
useCallback → caches a FUNCTION (stores the function itself, never calls it)
```

```jsx
// useMemo: React CALLS the factory, caches the return value
const sorted = useMemo(() => [...items].sort(), [items]);

// useCallback: React STORES the function, never calls it
const handleSort = useCallback(() => setSorted([...items].sort()), [items]);
```

### They're The Same Thing Internally

```jsx
useCallback(fn, deps)       ===   useMemo(() => fn, deps)
```

### When To Use Which

```
"I need to cache a computed VALUE"        → useMemo
  - Filtered/sorted arrays
  - Expensive calculations
  - Context provider value object

"I need to cache a FUNCTION reference"    → useCallback
  - Event handlers passed to memoized children
  - Functions used as useEffect deps
  - Callbacks passed to custom hooks
```

### They Work As a Pair With React.memo

```
React.memo on child  +  useCallback/useMemo on props in parent
        ↑                              ↑
   the gate              the stable references that pass the gate
```

One without the other is useless.

```jsx
// POINTLESS: useCallback without memo on consumer
function App() {
  const handleClick = useCallback(() => {}, []);
  return <Button onClick={handleClick} />;  // Button is NOT memoized
}
// Button re-renders anyway (parent re-rendered, default behavior)
```

### The Exception: useEffect Deps

```jsx
const fetchResults = useCallback(async () => {
  return fetch(`/api/search?q=${query}`).then(r => r.json());
}, [query]);

useEffect(() => {
  fetchResults().then(setResults);
}, [fetchResults]);  // ← useEffect also uses === on deps
```

Here useCallback is useful without React.memo — because useEffect checks reference stability too.

### Summary Table

```
                    useMemo                useCallback
─────────────────────────────────────────────────────────────
Caches              a value               a function
Calls the factory?  Yes                   No
Internal            useMemo(() => x, d)   useMemo(() => fn, d)
Use for             computed data         event handlers
Pair with           React.memo / useEffect
Without consumer    useless cost          useless cost
```

---

## When Memoization Works

The pattern: **expensive re-render that can be skipped because props didn't meaningfully change.**

### Case 1: Expensive siblings with shared parent state

```jsx
function Dashboard() {
  const [selectedTab, setSelectedTab] = useState("overview");
  return (
    <div>
      <TabBar selected={selectedTab} onSelect={setSelectedTab} />
      <Chart data={chartData} />           {/* memo: skip on tab switch */}
      <DataTable rows={rows} />            {/* memo: skip on tab switch */}
    </div>
  );
}
```

### Case 2: List items in large lists

The most common legitimate use.

```jsx
const TodoItem = React.memo(function TodoItem({ todo, onToggle }) {
  return <li onClick={() => onToggle(todo.id)}>{todo.text}</li>;
});

// Toggle 1 todo in 500: 1 re-renders instead of 500
// BUT: onToggle must be stable (useCallback)
```

### Case 3: Component far from the state change

```jsx
const Footer = React.memo(function Footer({ copyright }) {
  return <footer>{copyright}</footer>;
});
// Primitive props, unrelated to state changes above. Clean skip.
```

### Case 4: Expensive computation (useMemo)

```jsx
const summary = useMemo(() => {
  return {
    total: transactions.reduce((sum, t) => sum + t.amount, 0),
    byCategory: groupByCategory(transactions),
    topMerchants: getTopMerchants(transactions, 10),
  };
}, [transactions]);
// 50,000 transactions — only recompute when transactions change
```

### Case 5: Stabilizing context provider values

```jsx
const value = useMemo(() => ({ theme, setTheme }), [theme]);
<ThemeContext.Provider value={value}>
```

### Decision Tree

```
Memo WORKS when ALL are true:
  1. Component re-renders frequently
  2. Re-render is from PARENT, not own state
  3. Output is usually the SAME
  4. ALL props are stable references
```

---

## When Memoization is Useless

### Case 1: One unstable prop

```jsx
<UserCard
  user={user}                          // stable
  style={{ border: "1px solid red" }}  // UNSTABLE → memo always fails
/>
```

### Case 2: children as JSX

```jsx
const Wrapper = React.memo(function Wrapper({ children }) {
  return <div>{children}</div>;
});
// children = new JSX objects every render → memo useless
```

### Case 3: Context consumer

```jsx
const Sidebar = React.memo(function Sidebar() {
  const { theme } = useContext(AppContext);  // context bypasses memo
  return <aside className={theme}>...</aside>;
});
```

### Case 4: Own state change

```jsx
const SearchInput = React.memo(function SearchInput() {
  const [query, setQuery] = useState("");
  // Memo only gates parent-triggered renders, not own state
  return <input value={query} onChange={e => setQuery(e.target.value)} />;
});
```

### Case 5: Props always change

```jsx
const Clock = React.memo(function Clock({ time }) {
  return <span>{time.toLocaleTimeString()}</span>;
});
// new Date() every second → props always different → zero skips
```

### Case 6: Cheap component

```jsx
const Label = React.memo(function Label({ text }) {
  return <span>{text}</span>;
});
// Render cost: ~0.01ms. Memo check: ~0.005ms. Saving: ~0.005ms. Not worth it.
```

### Case 7: useMemo for trivial computation

```jsx
const fullName = useMemo(() => `${firstName} ${lastName}`, [firstName, lastName]);
// useMemo overhead > string concatenation cost. Just compute it.
```

### Case 8: useCallback without memoized consumer

```jsx
const handleClick = useCallback(() => doSomething(), []);
<Button onClick={handleClick} />;  // Button NOT memoized → wasted
```

### Full Catalog

```
#   Case                              Why useless
─────────────────────────────────────────────────────────
1   One unstable prop                 Shallow comparison fails
2   children as JSX                   New objects every render
3   Context consumer                  Context bypasses memo
4   Own state change                  Memo only gates parent renders
5   Props always change               Comparison + render every time
6   Cheap component                   Overhead > savings
7   useMemo on trivial computation    Cache management > computation
8   useCallback without memo consumer Stable ref nobody checks
```

---

## When Memoization is Harmful

### Harm 1: Stale Closure Bugs

```jsx
const sendMessage = useCallback((text) => {
  const newMsg = { text, replyCount: messages.length };
  //                                  ^^^^^^^^^^^^^^^^
  //                                  always 0! Stale closure.
  api.send(roomId, newMsg);
}, []);  // ← missing `messages` in deps
```

function#A from render 1 captures `messages = []`. Even after messages grow, sendMessage still sees the empty array. Silent bug, no errors.

### Harm 2: Memory Pressure

```jsx
const processedData = useMemo(() => processLargeDataset(rawData), [rawData]);
// 50MB result held in memory until deps change
// Without useMemo, garbage collected after render
```

### Harm 3: False Confidence

```jsx
const ProductCard = React.memo(function ProductCard({ product, onAdd }) { ... });

// Parent passes: onAdd={(id) => addToCart(id)}  ← inline, new every render
// Developer thinks it's optimized. It's not.
```

### Harm 4: Dependency Cascade

One memo on a leaf forces useCallback/useMemo up the entire tree:

```
memo TodoItem → needs stable onToggle → useCallback
  → needs stable onDelete → useCallback
    → onDelete needs user.id → user.id in deps → changes when user changes
      → need to stabilize user.id → useMemo
        → ...cascade continues
```

### Harm 5: Readability Tax

Every useMemo/useCallback adds a deps array to maintain, a potential stale closure, and mental overhead when reading code.

### Decision Framework

```
Before adding memo, ask:
  1. Have I MEASURED a problem?              No → don't memo
  2. Is the render actually expensive?       No → don't memo
  3. Can COMPOSITION fix it instead?         Yes → do that
  4. Can ALL props be stable without cascade? Yes → memo it
```

---

## The Derived State Trap

### Trap 1: Storing Derived Values in useState

```jsx
// ❌ Three sources of truth — sync bugs guaranteed
const [todos, setTodos] = useState([...]);
const [activeCount, setActiveCount] = useState(2);
const [completedTodos, setCompletedTodos] = useState([...]);

const addTodo = (text) => {
  setTodos(newTodos);
  setActiveCount(newTodos.filter(t => !t.done).length);
  // Forgot setCompletedTodos → BUG! Out of sync.
};
```

```jsx
// ✅ Single source of truth — always correct
const [todos, setTodos] = useState([...]);
const activeCount = todos.filter(t => !t.done).length;       // computed
const completedTodos = todos.filter(t => t.done);             // computed

const addTodo = (text) => {
  setTodos(prev => [...prev, { id: Date.now(), text, done: false }]);
  // activeCount and completedTodos are automatically correct
};
```

> **If a value can be computed from existing state/props, don't store it in useState. Just compute it.**

### Trap 2: useMemo for Trivial Computation

```jsx
// ❌ useMemo costs MORE than the computation
const isEmpty = useMemo(() => todos.length === 0, [todos]);
// Computation: ~0.0001ms. useMemo overhead: ~0.005ms.

// ✅ Just compute it
const isEmpty = todos.length === 0;
```

When useMemo IS justified for derived values:
- Computation is expensive (~50ms for 50k items)
- Result needs a stable reference (passed to memoized child or useEffect dep)

### Trap 2b: useEffect to Sync Derived State

```jsx
// ❌ WORST — double render, flash of wrong data
const [todos, setTodos] = useState([...]);
const [activeCount, setActiveCount] = useState(0);

useEffect(() => {
  setActiveCount(todos.filter(t => !t.done).length);
}, [todos]);
// Render 1: stale activeCount. useEffect fires. Render 2: correct.
```

### Severity Ranking

```
WORST:  useEffect + useState to sync derived state (double render)
BAD:    useState for derived values (sync bugs)
WASTE:  useMemo for trivial computation (overhead > savings)
GOOD:   just compute during render (simple, always correct)
GOOD:   useMemo for expensive computation or stable ref needs
```

---

## Purity and Mutation

### Array Methods: Mutating vs Non-Mutating

```
MUTATES original (modifies in place):
  .sort()       .reverse()     .splice()
  .push()       .pop()         .shift()
  .unshift()    .fill()        .copyWithin()

RETURNS NEW (original untouched):
  .filter()     .map()         .slice()
  .concat()     .flat()        .flatMap()
  .toSorted()   .toReversed()  .toSpliced()   ← ES2023
  .with()       [...arr]
```

```jsx
// ❌ Mutates props
function List({ items }) {
  items.sort();
  return items.map(i => <div>{i}</div>);
}

// ✅ Copy first, then sort
function List({ items }) {
  const sorted = [...items].sort();
  return sorted.map(i => <div>{i}</div>);
}
```

### Three Kinds of Mutation That Break Purity

```
1. External variables:    let id = 0; function Item() { id++; ... }
2. Argument/prop mutation: function List({ items }) { items.sort(); ... }
3. DOM/global side effects: function Header() { document.title = "Hi"; ... }
```

`id++` is impure because the component produces different output on each call with the same inputs. React may call components multiple times (Strict Mode, concurrent restarts) — each call increments the counter.

---

## React Compiler

### What It Is

A build-time Babel plugin (stable v1.0 since Oct 2025) that automatically memoizes components, values, and functions. Previously called "React Forget."

### Before vs After

```jsx
// ──── BEFORE (manual memoization) ────
const TodoItem = React.memo(function TodoItem({ todo, onToggle }) {
  return <li onClick={() => onToggle(todo.id)}>{todo.text}</li>;
});

function TodoApp() {
  const [todos, setTodos] = useState([...]);
  const filtered = useMemo(() => todos.filter(t => matchesFilter(t, filter)), [todos, filter]);
  const toggleTodo = useCallback((id) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }, []);
  return <TodoList todos={filtered} onToggle={toggleTodo} />;
}

// ──── AFTER (with React Compiler) ────
function TodoItem({ todo, onToggle }) {
  return <li onClick={() => onToggle(todo.id)}>{todo.text}</li>;
}

function TodoApp() {
  const [todos, setTodos] = useState([...]);
  const filtered = todos.filter(t => matchesFilter(t, filter));
  const toggleTodo = (id) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };
  return <TodoList todos={filtered} onToggle={toggleTodo} />;
}
```

Same performance. Half the noise. Zero dependency arrays.

### What the Compiler Requires

```
1. Components must be pure (same inputs → same output)
2. No side effects during render
3. Props and state treated as immutable
4. Values passed to JSX are immutable
```

### What It Can Do That Manual Hooks Can't

Memoize values after conditional early returns — impossible with hooks (must be called unconditionally at top level).

### Does It Make useMemo/useCallback/React.memo Obsolete?

```
For new code:      Mostly yes. Write plain functions.
For existing code: Leave manual memoization in place.
Still useful for:  useEffect dependency control, code outside components.
```

### Production Results at Meta

```
Initial page loads:       up to 12% faster
Specific interactions:    up to 2.5× faster
Memory usage:             neutral
```

### React's Memoization Evolution

```
2015-2018: shouldComponentUpdate / PureComponent (class components)
2019-2024: React.memo / useMemo / useCallback (manual, error-prone)
2025+:     React Compiler (automatic, build-time, correct by default)
```

---

## Interview Questions

### Referential Equality

**Q: Why does `{} === {}` return false?**
Objects are compared by reference (memory address), not content. Each `{}` is a new object at a different address.

**Q: Why does referential equality matter in React?**
React uses `===` to check if props, deps, and context values changed. New objects with identical content are seen as "changed."

**Q: Which React values are stable references across renders?**
`useState` setters, `useReducer` dispatch, `useRef` objects, module-level constants. `useCallback`/`useMemo` results are stable if deps unchanged.

### Shallow Comparison

**Q: How does React.memo compare props?**
Iterates keys, checks each value with `===`. One level deep — never looks inside nested objects.

**Q: Give an example where shallow comparison fails with identical props.**
`style={{ color: "red" }}` — same content every render but new object reference.

**Q: Why doesn't React use deep comparison?**
Recursive, expensive, unpredictable timing. Shallow is O(number of props) and predictable.

### React.memo

**Q: You memo'd a component but it still re-renders every time. Why?**
(1) Inline function prop. (2) Inline object/array prop. (3) children as JSX. (4) Context change. (5) Custom comparator returning false.

**Q: What's the custom comparator and when is it dangerous?**
Second argument to React.memo: `(prev, next) => boolean`. Dangerous because ignoring a prop that carries closure state causes stale behavior — the component calls outdated logic.

### useMemo vs useCallback

**Q: What's the difference?**
`useMemo` calls the factory and caches the return value. `useCallback` caches the function itself. Internally `useCallback(fn, deps)` equals `useMemo(() => fn, deps)`.

**Q: Is useCallback alone enough to optimize a child?**
No. Without React.memo on the child, it re-renders anyway (default behavior). They work as a pair.

**Q: When is useCallback useful without React.memo?**
When the function is a useEffect dependency — unstable ref would cause the effect to re-run every render.

### When Memoization Works vs Doesn't

**Q: What conditions must ALL be true for React.memo to help?**
(1) Re-renders frequently. (2) From parent, not own state. (3) Output usually same. (4) ALL props stable.

**Q: List cases where React.memo is useless.**
One unstable prop, children as JSX, context consumer, own state change, props always change, cheap component, useCallback without memoized consumer.

**Q: When is memoization harmful?**
Stale closure bugs, memory pressure from large cached values, false confidence, dependency cascade, code readability tax.

### Derived State

**Q: Should you store derived values in useState?**
No. Compute from existing state during render. Separate state creates sync bug surface.

**Q: When should you useMemo a derived value?**
Only if computation is expensive OR result needs a stable reference for a memoized child/useEffect dep.

**Q: What's wrong with useEffect to sync derived state?**
Double render. First render shows stale value, effect fires setState, second render shows correct value.

### React Compiler

**Q: What is the React Compiler?**
Build-time Babel plugin that auto-memoizes components, values, and functions. Eliminates manual memo/useMemo/useCallback.

**Q: Does the compiler make understanding memoization irrelevant?**
No. Essential for debugging, legacy codebases, and understanding what the compiler does under the hood.

**Q: What does it require from your code?**
Strict purity: same inputs → same output, no side effects during render, immutable props/state.

### Scenario Questions

**Q: Search input re-renders 500 product cards on every keystroke. Fix?**
Move search state into a SearchSection component (2 renders instead of 504). Composition over memo.

**Q: Teammate wraps every component in React.memo. What do you say?**
Memo has costs: comparison overhead, memory, stale closures, readability. Measure first, then optimize specific bottlenecks. Most cheap components don't benefit.

**Q: You see `useMemo(() => todos.length === 0, [todos])`. Good practice?**
No. Property access + comparison costs ~0.0001ms. useMemo overhead is 50x more. Just compute it directly.

**Q: How do you approach React performance optimization?**
"Measure with React DevTools Profiler. Consider composition patterns first (move state down, children pattern). When memo is needed, ensure ALL props are stable. With React Compiler, most manual memoization is handled automatically — but understanding fundamentals is essential for debugging."