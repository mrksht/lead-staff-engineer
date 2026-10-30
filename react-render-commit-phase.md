# React: Render vs Commit Phase — Deep Dive

## Table of Contents

- [Mental Model](#mental-model)
- [The Render Phase](#the-render-phase)
- [The Commit Phase](#the-commit-phase)
- [Step-by-Step Render Walk (Simple Example)](#step-by-step-render-walk-simple-example)
- [Step-by-Step Render Walk (Complex Example)](#step-by-step-render-walk-complex-example)
- [The Reconciliation / Diffing Algorithm](#the-reconciliation--diffing-algorithm)
- [What Triggers Re-renders](#what-triggers-re-renders)
- [Parent to Child Render Propagation](#parent-to-child-render-propagation)
- [React.memo and Stable References](#reactmemo-and-stable-references)
- [Context and Re-renders](#context-and-re-renders)
- [The Children Composition Pattern](#the-children-composition-pattern)
- [Keys and Unmounting/Remounting](#keys-and-unmountingremounting)
- [Effect Ordering Rules](#effect-ordering-rules)
- [Interview Questions](#interview-questions)

---

## Mental Model

React updates the UI in two distinct phases:

```
User triggers state change
        │
        ▼
┌─────────────────┐
│  RENDER PHASE    │  ← "Thinking" phase (pure, no side effects)
│                  │
│  - Calls your    │
│    components    │
│  - Builds new    │
│    virtual DOM   │
│  - Diffs old vs  │
│    new (reconcil-│
│    iation)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  COMMIT PHASE    │  ← "Doing" phase (touches real DOM)
│                  │
│  - Applies DOM   │
│    mutations     │
│  - Runs layout   │
│    effects       │
│  - Runs effects  │
│    (useEffect)   │
└─────────────────┘
```

> **The render phase is a question, not a command.**
> React is asking: "What _should_ the UI look like?"
> The commit phase is where React _acts_ on the answer.

---

## The Render Phase

React calls your component functions to figure out _what_ the UI should look like.

```jsx
function Counter({ count }) {
  // This code runs during the RENDER phase
  const doubled = count * 2;
  return <div>{doubled}</div>;
}
```

### Four Key Properties

#### 1. Pure computation only

Given the same props and state, your component must return the same JSX. No reaching outside to change things.

```jsx
// PURE — same input always produces same output
function Greeting({ name }) {
  return <h1>Hello, {name}</h1>;
}

// IMPURE — modifies something outside its scope
let callCount = 0;
function Greeting({ name }) {
  callCount++;                        // ← mutating external variable
  document.title = `Hi ${name}`;     // ← touching the DOM
  return <h1>Hello, {name}</h1>;
}
```

Why: React needs to call your function like a math equation. `f(props, state) → JSX`. If calling it changes the outside world, calling it _twice_ changes things _twice_ — and React needs the freedom to call it as many times as it wants.

```
Math:  2 + 3 = 5    (always, no matter how many times you compute it)
Pure:  Greeting({ name: "Rak" }) = <h1>Hello, Rak</h1>  (always)
Impure: each call increments callCount — different world state each time
```

#### 2. Can be paused, aborted, or restarted (Concurrent React)

The old model (React 17 and below):

```
Render starts ──────────────────────→ Render finishes → Commit
              (synchronous, blocking)
```

The concurrent model (React 18+):

```
Render starts ───────┐
                     │ ← User clicks something urgent
                     ▼
              React PAUSES this render
                     │
              Handles the urgent update (render + commit)
                     │
              RESUMES or RESTARTS the paused render
```

Example: typing in an input while a huge list is rendering. Without concurrency, typing freezes. With concurrency, React pauses the list render, handles the input first, then restarts the list render.

Why purity matters here: if your component wrote to the DOM during render and React aborted that render, you'd have a half-applied side effect with no cleanup. Pure functions can be safely abandoned.

#### 3. No guaranteed 1:1 with commit

Just because React _called_ your component doesn't mean the result will reach the screen.

```
Render A (low priority) starts...
  ├── React calls <Parent />
  ├── React calls <Child />        ← your component ran
  │
  │   ⚡ HIGH PRIORITY UPDATE ARRIVES
  │
  └── React DISCARDS this entire render tree

Render B (high priority) starts...
  ├── Calls everything again
  └── COMMIT → DOM updated ✅
```

Also happens with bailout optimization — React renders your component, sees the output is identical, and skips the commit.

```jsx
function Dashboard() {
  // ❌ BAD — fires even if render is discarded
  fetch("/api/track-view");

  // ✅ GOOD — only fires after successful commit
  useEffect(() => {
    fetch("/api/track-view");
  }, []);

  return <div>Dashboard</div>;
}
```

#### 4. May run multiple times per visible update

**Strict Mode (dev only):** React calls your component twice to catch impure code.

```jsx
let id = 0;
function Item() {
  id++;                           // 1st render: id=1, 2nd render: id=2
  return <div>Item {id}</div>;    // Shows "Item 2" instead of "Item 1"
                                  // Strict Mode exposed the bug!
}
```

**Concurrent re-renders:** React may start, interrupt, and restart renders.

```
Render attempt 1:  [Component()]──── interrupted
Render attempt 2:  [Component()]──── interrupted
Render attempt 3:  [Component()]──── completes → Commit

Component function called 3 times. useEffect fires 1 time.
```

### Safe vs Unsafe in Render Phase

```jsx
function MyComponent() {
  // SAFE — pure computation, idempotent
  const sorted = [...items].sort();            // ✅ new array each time
  const filtered = items.filter(x => x > 0);  // ✅ pure
  const label = count === 1 ? "item" : "items"; // ✅ pure

  // UNSAFE — side effects that break on multiple calls
  items.sort();                    // ❌ mutates the original array
  globalCounter++;                 // ❌ accumulates across renders
  subscribeToWebSocket();          // ❌ creates duplicate connections
}
```

---

## The Commit Phase

React takes the computed diff and applies it to the real DOM.

### Three Sub-steps

```
1. "Before mutation"  → useLayoutEffect cleanup runs
2. "Mutation"         → React writes to the DOM
3. "Layout"           → useLayoutEffect runs
                      → refs are attached
                      → (later, async) useEffect runs
```

```jsx
function Example() {
  useLayoutEffect(() => {
    // Runs synchronously AFTER DOM mutation, BEFORE browser paint
    // Use case: measure DOM, adjust scroll position
    const height = ref.current.getBoundingClientRect().height;
    return () => { /* cleanup */ };
  });

  useEffect(() => {
    // Runs asynchronously AFTER browser paint
    // Use case: data fetching, subscriptions, logging
    fetchData();
    return () => { /* cleanup */ };
  });

  return <div ref={ref}>Hello</div>;
}
```

### Hook-to-Phase Mapping

| Hook | When it runs | Phase |
|---|---|---|
| `useState` setter | Schedules a render | Triggers render |
| `useMemo` | During render | Render |
| `useCallback` | During render | Render |
| `useRef` | During render (init) | Render |
| `useLayoutEffect` | After DOM mutation | Commit |
| `useEffect` | After paint | Commit |

---

## Step-by-Step Render Walk (Simple Example)

```jsx
function App() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <Header title="My App" />
      <Counter count={count} />
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  );
}

function Header({ title }) {
  return <h1>{title}</h1>;
}

function Counter({ count }) {
  return (
    <div>
      <Label text="Count" />
      <Value number={count} />
    </div>
  );
}

function Label({ text }) {
  return <span>{text}: </span>;
}

function Value({ number }) {
  return <strong>{number}</strong>;
}
```

Tree:

```
        App
       / | \
      /  |  \
 Header Counter button
          / \
         /   \
      Label  Value
```

### Initial Mount

React walks **top-down, depth-first, left-to-right**:

```
1. Call App()         → returns JSX with Header, Counter, button
2. Call Header()      → returns <h1>My App</h1> → leaf, done
3. Call Counter()     → returns JSX with Label, Value
4. Call Label()       → returns <span>Count: </span> → leaf, done
5. Call Value()       → returns <strong>0</strong> → leaf, done
6. <button>           → plain HTML element, just recorded

RENDER PHASE COMPLETE → COMMIT: create all real DOM nodes in one batch
```

### User Clicks Button (count: 0 → 1)

```
1. Call App()                → state changed, must re-render
2. Call Header({ title })    → parent re-rendered (WASTED — same output)
3. Call Counter({ count: 1}) → props changed
4. Call Label({ text })      → parent re-rendered (WASTED — same output)
5. Call Value({ number: 1 }) → props changed, output DIFFERENT

RENDER PHASE: 5 components called
COMMIT PHASE: 1 DOM mutation (text inside <strong>: "0" → "1")
```

```
Components that       Components whose      DOM nodes
RE-RENDERED:          output CHANGED:       actually touched:

  App          ✅        App         ✅
  Header       ✅        Header      ❌
  Counter      ✅        Counter     ✅        1 out of entire tree
  Label        ✅        Label       ❌        (just the text "0"→"1")
  Value        ✅        Value       ✅
```

Render ≠ DOM update. All 5 rendered, only 1 DOM node was touched.

---

## Step-by-Step Render Walk (Complex Example)

### The Code

```jsx
function App() {
  const [todos, setTodos] = useState([
    { id: 1, text: "Learn React", done: false },
    { id: 2, text: "Build app", done: false },
  ]);
  const [filter, setFilter] = useState("all");

  const filtered = todos.filter(t => {
    if (filter === "done") return t.done;
    if (filter === "active") return !t.done;
    return true;
  });

  const toggleTodo = (id) => {
    setTodos(todos.map(t =>
      t.id === id ? { ...t, done: !t.done } : t
    ));
  };

  return (
    <div>
      <Header />
      <FilterBar filter={filter} setFilter={setFilter} />
      <TodoList todos={filtered} onToggle={toggleTodo} />
      <Footer count={filtered.length} />
    </div>
  );
}

function Header() {
  return <h1>My Todos</h1>;
}

function FilterBar({ filter, setFilter }) {
  return (
    <div>
      <FilterButton label="All" active={filter === "all"} onClick={() => setFilter("all")} />
      <FilterButton label="Active" active={filter === "active"} onClick={() => setFilter("active")} />
    </div>
  );
}

function FilterButton({ label, active, onClick }) {
  return (
    <button style={{ fontWeight: active ? "bold" : "normal" }} onClick={onClick}>
      {label}
    </button>
  );
}

function TodoList({ todos, onToggle }) {
  return (
    <ul>
      {todos.map(todo => (
        <TodoItem key={todo.id} todo={todo} onToggle={onToggle} />
      ))}
    </ul>
  );
}

function TodoItem({ todo, onToggle }) {
  useLayoutEffect(() => {
    // Runs sync after DOM mutation, before paint
    return () => { /* cleanup */ };
  }, [todo.done]);

  useEffect(() => {
    // Runs async after paint
    return () => { /* cleanup */ };
  }, [todo.done]);

  return (
    <li
      onClick={() => onToggle(todo.id)}
      style={{ textDecoration: todo.done ? "line-through" : "none" }}
    >
      {todo.text}
    </li>
  );
}

function Footer({ count }) {
  return <p>{count} items</p>;
}
```

### User Toggles "Learn React" Done

Every component traced with exact reason:

| Component | Re-renders? | Why? | Useful? |
|---|---|---|---|
| App | YES | Own state changed (`todos`) | YES |
| Header | YES | Parent (App) re-rendered | NO |
| FilterBar | YES | Parent (App) re-rendered | NO |
| FilterButton(All) | YES | Parent (FilterBar) re-rendered | NO |
| FilterButton(Active) | YES | Parent (FilterBar) re-rendered | NO |
| TodoList | YES | Parent (App) re-rendered | YES |
| TodoItem(Learn React) | YES | Parent (TodoList) re-rendered, props changed | YES |
| TodoItem(Build app) | YES | Parent (TodoList) re-rendered | NO |
| Footer | YES | Parent (App) re-rendered | NO |

**9 components rendered. 1 DOM mutation.** (`<li>` style change on "Learn React")

### Commit Phase Ordering for This Update

```
1. useLayoutEffect cleanup — TodoItem("Learn React")  (deps changed)
2. DOM mutation — update <li> style from "none" to "line-through"
3. useLayoutEffect fire — TodoItem("Learn React")
4. ── browser paint ──
5. useEffect cleanup — TodoItem("Learn React")
6. useEffect fire — TodoItem("Learn React")

Note: TodoItem("Build app") effects did NOT run — its [todo.done] dep didn't change.
```

---

## The Reconciliation / Diffing Algorithm

React uses 3 heuristics to turn an O(n³) tree diff into O(n).

### Rule 1: Different type = tear down and rebuild

```jsx
// Before                    // After
<div>                        <span>
  <Counter />                  <Counter />
</div>                       </span>
```

`div → span`: different type. React destroys the entire old tree and builds from scratch. Counter is unmounted (state lost) and a fresh Counter is mounted.

```jsx
// ❌ This destroys and recreates Dashboard every toggle
{isAdmin ? (
  <div><Dashboard /></div>
) : (
  <section><Dashboard /></section>
)}
```

### Rule 2: Same type = update in place

```jsx
// Before
<div className="old" style={{ color: "red" }}>

// After
<div className="new" style={{ color: "blue" }}>
```

Same DOM element type → keep the same DOM node, update only changed attributes.

For components: same component type → keep the same instance, state is preserved, call the function again with new props.

### Rule 3: Keys identify children in lists

Without keys, React matches by position. With keys, React matches by identity. (Covered in detail in the [Keys section](#keys-and-unmountingremounting).)

### The Full Decision Tree

```
Compare old node vs new node:
  │
  ├── Is new node null/false/undefined?
  │     └── UNMOUNT old node entirely
  │
  ├── Different TYPE? (div→span, Counter→Header)
  │     ├── UNMOUNT old tree (cleanup effects, destroy state)
  │     └── MOUNT new tree from scratch
  │
  ├── Same DOM element type? (div→div)
  │     ├── Keep same DOM node
  │     ├── Diff attributes, update only what changed
  │     └── Recurse into children
  │
  └── Same component type? (Counter→Counter)
        ├── Keep same instance (state preserved)
        ├── Update props
        ├── Call the function again (re-render)
        └── Recurse into returned JSX
```

### Why O(n)

React only compares nodes at the same level, same position. It walks the tree once, top to bottom. It never tries to match a node at depth 3 with a node at depth 7. The tradeoff: if you move a subtree to a different position without keys, React destroys and recreates instead of moving.

---

## What Triggers Re-renders

### Things that DO trigger re-renders

| Trigger | Scope |
|---|---|
| `setState` / `dispatch` | The component that owns the state + all descendants |
| Parent re-rendering | All children (default behavior) |
| Context value change | Every consumer of that context |
| Key change | Unmount old instance, mount new one |

### Things that do NOT trigger re-renders

| Non-trigger | Why |
|---|---|
| Mutating a ref (`ref.current = x`) | React doesn't track ref changes |
| Mutating state directly (`state.count = 5`) | Must use setState |
| Direct DOM manipulation | React doesn't know it happened |
| Sibling re-rendering | Only parent→child, never sideways |

### setState Flows Downward Only

```jsx
function TodoItem({ todo, onToggle }) {
  const [isHovered, setIsHovered] = useState(false);
  // ...
}
```

When `setIsHovered(true)` is called:

```
App             ─
Header          ─
TodoList        ─
TodoItem(Learn) RENDERS    ← only this and its children
TodoItem(Build) ─
Footer          ─
```

State change re-renders the component that owns the state and its children. Never its parent. Never its siblings.

### State Position = Blast Radius

```
State high up (App):
  ✅ Easy to share between siblings
  ❌ More components re-render

State low down (TodoItem):
  ✅ Fewer components re-render
  ❌ Can't share with siblings without lifting
```

---

## Parent to Child Render Propagation

**The default rule:**

> When a component re-renders, ALL of its children re-render. React does not check if props changed. Parent rendered → children render. Period.

```jsx
// Even this child with ZERO props re-renders when App re-renders
function Header() {
  return <h1>My Todos</h1>;
}
```

`React.memo` is the opt-in to say: "Check my props before re-rendering me."

---

## React.memo and Stable References

### What React.memo Does

```jsx
const Header = React.memo(function Header({ title }) {
  return <h1>{title}</h1>;
});

// When parent re-renders:
// React checks: did props change? (shallow comparison)
// If no → SKIP. If yes → re-render.
```

### Stable vs Unstable References

```
STABLE (same reference every render):
  ├── setState / dispatch from useState/useReducer   ← React guarantees this
  ├── refs (useRef) — the ref object itself
  ├── functions wrapped in useCallback (with same deps)
  └── values wrapped in useMemo (with same deps)

NOT STABLE (new reference every render):
  ├── objects/arrays created inline:    { a: 1 }  or  [1, 2]
  ├── functions created inline:         () => {}
  └── computed arrays:                  items.filter(...)
```

### useState setter is a stable reference

```jsx
const [count, setCount] = useState(0);

// setCount is the SAME function object across every render
// Render 1: setCount = function#A
// Render 2: setCount = function#A     ← same
// Render 3: setCount = function#A     ← same
```

You can safely pass it to a memoized child without breaking memoization.

### Inline functions are NOT stable

```jsx
const toggleTodo = (id) => { ... };

// Render 1: toggleTodo = function#A
// Render 2: toggleTodo = function#B     ← new object
// Render 3: toggleTodo = function#C     ← new object

// Fix with useCallback:
const toggleTodo = useCallback((id) => {
  setTodos(prev => prev.map(t =>
    t.id === id ? { ...t, done: !t.done } : t
  ));
}, []);  // stable forever because of updater function form
```

### Optimized Example

```jsx
function App() {
  const [todos, setTodos] = useState([...]);
  const [filter, setFilter] = useState("all");

  const toggleTodo = useCallback((id) => {
    setTodos(prev => prev.map(t =>
      t.id === id ? { ...t, done: !t.done } : t
    ));
  }, []);

  const filtered = useMemo(() =>
    todos.filter(t => {
      if (filter === "done") return t.done;
      if (filter === "active") return !t.done;
      return true;
    }),
  [todos, filter]);

  return (
    <div>
      <Header />
      <FilterBar filter={filter} setFilter={setFilter} />
      <TodoList todos={filtered} onToggle={toggleTodo} />
      <Footer count={filtered.length} />
    </div>
  );
}

const Header = React.memo(Header);
const FilterBar = React.memo(FilterBar);
const TodoItem = React.memo(TodoItem);
const Footer = React.memo(Footer);
```

Toggle "Learn React" after optimization:

| Component | Re-renders? | Why? |
|---|---|---|
| App | YES | Own state changed |
| Header | SKIP | memo, no props |
| FilterBar | SKIP | memo, filter same, setFilter stable |
| FilterButton(All) | SKIP | parent skipped, not even checked |
| FilterButton(Active) | SKIP | parent skipped, not even checked |
| TodoList | YES | todos is new array (content changed) |
| TodoItem(Learn) | YES | memo, but todo.done changed |
| TodoItem(Build) | SKIP | memo, same todo ref, same onToggle |
| Footer | SKIP | memo, count still 2 |

**3 renders instead of 9. Same 1 DOM mutation.**

### The Tradeoff

```
Without memo/useMemo/useCallback:
  ✅ Simpler code
  ✅ No memo overhead (shallow comparison costs CPU too)
  ❌ More render-phase work

With memo/useMemo/useCallback:
  ✅ Less render-phase work
  ❌ More complex code
  ❌ Shallow comparison on every render
  ❌ Bug risk: stale closures from wrong deps

Rule of thumb:
  → Don't optimize until you measure a problem
  → Expensive components (big lists, heavy computation) → memo
  → Cheap components (a <span> with text) → don't bother
```

---

## Context and Re-renders

### The Core Rule

**Context change re-renders ALL consumers, regardless of React.memo.**

```jsx
const ThemeContext = createContext("light");

const Sidebar = React.memo(function Sidebar() {
  const theme = useContext(ThemeContext);
  return <aside className={theme}>Sidebar</aside>;
});
```

When the context value changes, Sidebar re-renders even though it's memoized.

### Two Gates Model

```
Gate 1 (memo):    "Did props change?"     → No  → try to skip
Gate 2 (context): "Did context change?"   → Yes → MUST render

Both gates must say "skip" for the component to skip.
Context bypasses the prop check.
```

### The Big Context Problem

```jsx
const AppContext = createContext();

function App() {
  const [user, setUser] = useState({ name: "Rak" });
  const [theme, setTheme] = useState("light");

  const value = { user, theme, setTheme };

  return (
    <AppContext.Provider value={value}>
      <ThemeToggle />
      <UserProfile />
    </AppContext.Provider>
  );
}

const ThemeToggle = React.memo(function ThemeToggle() {
  const { theme, setTheme } = useContext(AppContext);
  return <button onClick={() => setTheme("dark")}>{theme}</button>;
});

const UserProfile = React.memo(function UserProfile() {
  const { user } = useContext(AppContext);  // only needs user
  return <div>{user.name}</div>;
});
```

When theme changes: the entire context value object is new. React tells ALL consumers context changed. UserProfile re-renders even though it only needs `user` which didn't change.

**Context does NOT do selective subscription. It's all or nothing.**

### Fix 1: Split contexts

```jsx
const ThemeContext = createContext();
const UserContext = createContext();

function App() {
  const [user, setUser] = useState({ name: "Rak" });
  const [theme, setTheme] = useState("light");

  return (
    <UserContext.Provider value={user}>
      <ThemeContext.Provider value={theme}>
        <ThemeToggle />
        <UserProfile />
      </ThemeContext.Provider>
    </UserContext.Provider>
  );
}
// Now ThemeToggle subscribes only to ThemeContext
// UserProfile subscribes only to UserContext
// Theme change doesn't affect UserProfile
```

### Fix 2: useMemo on provider value

```jsx
// ❌ Bad: new object every render
<AppContext.Provider value={{ user, theme, locale }}>

// ✅ Better: stable reference when deps don't change
const value = useMemo(() => ({ user, theme, locale }), [user, theme, locale]);
<AppContext.Provider value={value}>
```

Prevents re-renders when unrelated state changes, but doesn't solve the "UserProfile re-renders when theme changes" problem.

### Fix 3: Wrapper + memoized inner component

```jsx
function UserProfileWrapper() {
  const { user } = useContext(AppContext);  // re-renders on any context change
  return <UserProfileInner user={user} />;
}

const UserProfileInner = React.memo(function UserProfileInner({ user }) {
  // Only re-renders when user prop actually changes
  return <div>{user.name}</div>;
});
```

---

## The Children Composition Pattern

### The Core Idea, In One Sentence

Whoever's render function **writes the JSX** for a child is whoever **recreates** that child's element every time it re-renders — no matter how deep you nest `React.memo`, `useMemo`, or providers below it. The only real fix is to stop that component from re-rendering in the first place, usually by moving the state that triggers it somewhere else.

### Minimal Example: The Bug

```jsx
function App() {
  const [count, setCount] = useState(0);          // ← state lives in App

  return (
    <div>
      <button onClick={() => setCount((c) => c + 1)}>
        Count: {count}
      </button>

      <Panel>
        <ExpensiveList />
      </Panel>
    </div>
  );
}

const Panel = React.memo(function Panel({ children }) {
  console.log("Panel rendered");
  return <div className="panel">{children}</div>;
});

function ExpensiveList() {
  console.log("ExpensiveList rendered");
  return <p>Pretend this is a 10,000-row table.</p>;
}
```

Click the button once. `count` has nothing to do with `Panel` or `ExpensiveList` — yet both log again. Walk through why:

```
Click button → setCount → App re-renders (this is correct, count changed)

While re-rendering, App runs this line again:
    <Panel><ExpensiveList /></Panel>

That JSX is just sugar for:
    React.createElement(Panel, { children: React.createElement(ExpensiveList) })

Every render, App calls createElement AGAIN → brand new objects:
    Render 1: children = ElementObject#A
    Render 2: children = ElementObject#B
    ElementObject#A === ElementObject#B → false

Panel is React.memo'd, so it checks: "did props change?"
    prevProps.children (#A) === nextProps.children (#B)  → false
    → Panel re-renders anyway. The memo did nothing.
```

`React.memo(Panel)` can only compare the `children` prop by reference. It has no way to know that the *content* of `<ExpensiveList />` is identical between renders — because a **new element object** describing it gets built every single time `App`'s function body runs, regardless of whether anything inside `ExpensiveList` actually changed.

### The Fix: Move the State Out From Above the Children

The bug isn't "`Panel` needs a better memo comparison." The bug is "`App` re-renders on every click, and `App` is the one constructing `<ExpensiveList />`." So stop `App` from re-rendering — give the counter its own component with its own state, instead of keeping it in the ancestor that also builds the children JSX:

```jsx
function App() {
  return (
    <div>
      <CounterButton />
      <Panel>
        <ExpensiveList />
      </Panel>
    </div>
  );
}

function CounterButton() {
  const [count, setCount] = useState(0);          // ← state moved here
  return (
    <button onClick={() => setCount((c) => c + 1)}>
      Count: {count}
    </button>
  );
}
```

Now clicking the button only re-renders `CounterButton` — a sibling, not an ancestor. `App` renders exactly once (on mount) and never again, so it only ever calls `createElement(Panel, { children: <ExpensiveList/> })` **one time**. There is no second, different element object to compare against — `Panel` and `ExpensiveList` are skipped entirely. No `React.memo` required anywhere.

```
Click button now:

App               — does NOT re-render (no state of its own, nothing tells it to)
CounterButton     — RE-RENDERS (owns the state that changed)
Panel             — SKIP ✅ (never asked to re-render — same children reference forever)
ExpensiveList     — SKIP ✅ (same reason)
```

This is the same idea as "Colocation vs Lifting State" earlier in this doc, applied specifically to `children`: **state colocated in a leaf can't force a re-creation of JSX built higher up the tree** — because that higher component simply never runs again.

### Same Bug, Real-World Shape (Context)

The version above uses a plain counter to isolate the mechanic. In real apps this usually shows up with Context, where the "state that triggers re-renders" is something like a theme toggle, and the "expensive children" are arbitrary parts of your app tree:

```jsx
function App() {
  const [theme, setTheme] = useState("light");
  return (
    <ThemeContext.Provider value={theme}>
      <Main>
        <TodoList />
        <DeepChild />
      </Main>
    </ThemeContext.Provider>
  );
}

const Main = React.memo(function Main({ children }) {
  return <div>{children}</div>;
});
```

`children` is an array of React element objects, created fresh inside App's render:

```
Render 1: children = [object#A, object#B]   ← array#X
Render 2: children = [object#C, object#D]   ← array#Y

array#X === array#Y → false → React.memo re-renders Main
```

**React.memo is useless here.** The `children` prop is a new reference every time App renders — for exactly the same reason `Panel` was above.

### The Fix: Push State Into a Provider

```jsx
function App() {
  return (
    <ThemeProvider>
      <Header />
      <Sidebar />
      <Main>
        <TodoList />
        <DeepChild />
      </Main>
    </ThemeProvider>
  );
}

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("light");
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

When theme changes:

- ThemeProvider re-renders (own state changed)
- But App does NOT re-render
- So App does NOT recreate the children elements
- ThemeProvider receives the SAME `children` reference
- React sees same reference → doesn't re-render those children
- Only context consumers (Sidebar, DeepChild) re-render

```
                          State in App       State in ThemeProvider
──────────────────────────────────────────────────────────────────
App                       RE-RENDERS          does not re-render
ThemeProvider              n/a                RE-RENDERS
Header (no context)       RE-RENDERS          SKIP ✅
Sidebar (has context)     RE-RENDERS          RE-RENDERS
Main                      RE-RENDERS          SKIP ✅
TodoList (no context)     RE-RENDERS          SKIP ✅
DeepChild (has context)   RE-RENDERS          RE-RENDERS
──────────────────────────────────────────────────────────────────
Total renders:               7                    3
Memo needed:             Yes, everywhere          No
```

The composition pattern gives optimization **without React.memo**.

### Why It Works

```jsx
// In App's render:
const elements = [
  React.createElement(Header, null),     // object#1
  React.createElement(Main, null, ...),  // object#2
];

// These are passed to ThemeProvider as children.
// When ThemeProvider re-renders but App doesn't,
// these are the SAME objects — not recreated.
// Same reference → React skips re-rendering them.
```

---

## Keys and Unmounting/Remounting

### What Keys Do

Keys tell React the **identity** of a component instance.

### Reorder Without Keys (or key={index})

```
Before:                          After:
position 0: "Learn React"       position 0: "Build app"
position 1: "Build app"         position 1: "Learn React"

React matches by position:
  "Position 0 text changed from 'Learn React' to 'Build app'"
  "Position 1 text changed from 'Build app' to 'Learn React'"
  → Updates TEXT inside existing DOM nodes
  → State (useState, etc.) stays at the POSITION, not with the todo
  → BUG: hover state stays at position 0 even though the todo changed
```

### Reorder With Proper Keys (key={todo.id})

```
Before:                          After:
key="1": "Learn React"          key="2": "Build app"
key="2": "Build app"            key="1": "Learn React"

React matches by key:
  key="1" moved from position 0 to position 1
  key="2" moved from position 0 to position 1
  → MOVES existing DOM nodes (no text update)
  → State follows the todo correctly
```

### Delete From the Middle

Todos: A, B, C. User deletes B.

**key={index}:**

```
index 0: A → A   (no change)
index 1: B → C   (React thinks "B changed to C")
index 2: C → gone (React unmounts this — but it was C!)

Wrong component gets unmounted. B's cleanup never runs properly.
```

**key={todo.id}:**

```
key="a": A → A   (no change)
key="b": B → gone (React correctly unmounts B)
key="c": C → C   (no change)
```

### Using Keys to Force Reset

```jsx
// Without key: Profile UPDATES when userId changes
// Internal state (form inputs, scroll) PERSISTS (bug)
<Profile userId={userId} />

// With key: old Profile UNMOUNTS, fresh one MOUNTS
// All internal state is reset (correct)
<Profile key={userId} userId={userId} />
```

Real use case: a form that should reset when switching between items.

---

## Effect Ordering Rules

### Full Ordering on Re-render

```
1.  ALL useLayoutEffect cleanups     (old effects torn down)
2.  ALL DOM mutations                (React writes to DOM)
3.  ALL useLayoutEffect fire         (new effects, sync, pre-paint)
4.  ── browser paint ──
5.  ALL useEffect cleanups           (old effects torn down)
6.  ALL useEffect fire               (new effects, async, post-paint)
```

### Why Cleanups Run Before New Effects

```jsx
useEffect(() => {
  const conn = connectToRoom(roomId);      // connect to "general"
  return () => conn.disconnect();           // cleanup
}, [roomId]);

// When roomId changes from "general" to "random":
// Step 1: cleanup → disconnect from "general"
// Step 2: effect  → connect to "random"
//
// If reversed, you'd briefly be connected to TWO rooms.
```

### useLayoutEffect vs useEffect

| | useLayoutEffect | useEffect |
|---|---|---|
| Timing | After DOM mutation, BEFORE paint | AFTER paint |
| Blocking? | Yes — blocks browser from painting | No — async |
| Use case | Measure DOM, prevent flicker | Fetch data, subscriptions |

---

## Interview Questions

**Q: Can React call my component and NOT update the DOM?**
Yes. If the render phase produces the same output, React skips the commit. Also, concurrent renders can be aborted entirely.

**Q: Why shouldn't I put side effects in the render phase?**
Because React makes no guarantees about how many times or when render will complete. Side effects could fire multiple times, fire for abandoned renders, or fire out of order.

**Q: What's the difference between useEffect and useLayoutEffect?**
Both run in the commit phase, but `useLayoutEffect` runs synchronously before the browser paints (blocking), while `useEffect` runs asynchronously after paint (non-blocking). Use `useLayoutEffect` when you need to measure/mutate DOM before the user sees it.

**Q: How does concurrent rendering relate to these phases?**
Concurrent rendering only affects the render phase — it can be paused/interrupted. The commit phase is always synchronous and uninterruptible.

**Q: Does React.memo prevent context-triggered re-renders?**
No. Context bypasses React.memo entirely. If the context value changes, every consumer re-renders regardless of memoization.

**Q: What happens when you change a component's key?**
React treats it as a completely different instance. It unmounts the old component (runs all cleanup, destroys state) and mounts a fresh one.

**Q: Why does passing children as JSX break React.memo?**
Because JSX children are React element objects created fresh on each render. The parent creates new objects → new reference → memo's shallow comparison fails.

**Q: How do you optimize context to avoid unnecessary re-renders?**
Three approaches: (1) split contexts by update frequency, (2) useMemo on provider value, (3) wrapper component that extracts needed values and passes them as props to a memoized inner component.

**Q: If a child calls setState, does the parent re-render?**
No. State changes flow downward only. Only the component that owns the state and its descendants re-render.

**Q: What's the default re-render behavior in React?**
When a component re-renders, ALL of its children re-render unconditionally. React does not compare props by default. `React.memo` is the opt-in to enable prop comparison.
