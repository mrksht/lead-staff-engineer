# React State Management — Deep Dive

## Table of Contents

- [Core Mental Model](#core-mental-model)
- [Local State vs Global State](#local-state-vs-global-state)
- [Server State vs Client State](#server-state-vs-client-state)
- [Colocation vs Lifting State](#colocation-vs-lifting-state)
- [React Query](#react-query)
- [Bad State Placement](#bad-state-placement)
- [Interview Questions](#interview-questions)

---

## Core Mental Model

```
Render Cost ∝ Tree Size × Update Frequency

State placement controls TREE SIZE.
The higher state lives, the more components re-render per update.
```

> **State should live as close to where it's used as possible. Only lift or globalize when you must.**

---

## Local State vs Global State

### The Core Question

> **"How many components need this value?"**

```
LOCAL STATE                              GLOBAL STATE
─────────                                ────────────
Used by 1 component                      Used by many unrelated components
(or parent + direct children)            (across different subtrees)

useState / useReducer                    Context, Zustand, Redux, Jotai

Examples:                                Examples:
  - Is this dropdown open?                 - Who is the logged-in user?
  - What's typed in this input?            - Light mode or dark mode?
  - Is this row hovered?                   - Shopping cart contents
  - Is this modal visible?                 - Notification count
  - Which tab is selected?                 - Locale / language
```

### The Spectrum

State isn't binary. It's a spectrum based on how many components need it and how far apart they are:

```
Scope              Tool                    Example
──────────────────────────────────────────────────────────
Single component   useState                input value, toggle
Parent + children  useState (lifted)       selected tab, filter
Subtree            Context (scoped)        form validation state
App-wide           Context / Zustand       auth, theme, locale
Cross-tab/persist  localStorage + sync     draft content, preferences
```

### The Common Mistake

```
❌ Putting EVERYTHING in global state:

  store = {
    user: {...},
    theme: "dark",
    searchQuery: "",          ← only SearchInput needs this
    isDropdownOpen: false,    ← only Dropdown needs this
    hoveredRowId: null,       ← only the table row needs this
  }

  searchQuery keystroke re-renders the theme toggle.
  Hovering a row re-renders the user menu.
  Maximum blast radius for every update.
```

---

## Server State vs Client State

### The Core Difference

```
CLIENT STATE                             SERVER STATE
────────────                             ────────────
You OWN it.                              You DON'T own it.
Lives in the browser.                    Lives on someone else's computer.
You are the source of truth.             The server is the source of truth.
Synchronous.                             Asynchronous.
Always up to date.                       Might be stale right now.

Examples:                                Examples:
  - Is the modal open?                     - List of todos from API
  - Which tab is selected?                 - User profile data
  - Current input value                    - Product catalog
  - Theme preference                       - Comments on a post
```

### Why They Need Different Tools

Client state has ONE problem: store, update, notify.

Server state has FIVE problems:

```
1. FETCHING        → How do I get it? Loading? Errors?
2. CACHING         → I already fetched this. Fetch again?
3. STALENESS       → Data is 5 min old. Still valid?
4. DEDUPLICATION   → 3 components need same data. 1 or 3 fetches?
5. SYNCHRONIZATION → Another user edited this. My copy is wrong.
```

`useState` + `useEffect` solves problem #1 only. Badly.

### The Classic Mistake

```jsx
// ❌ What most people write
function TodoList() {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/todos")
      .then(res => res.json())
      .then(data => { setTodos(data); setLoading(false); })
      .catch(err => { setError(err); setLoading(false); });
  }, []);
}
```

```
Problem              useState+useEffect          What you need
──────────────────────────────────────────────────────────────
Caching              ❌ Refetches every mount      Cache and reuse
Staleness            ❌ Could be 30 min old        Background refetch
Deduplication        ❌ 3 components = 3 fetches   1 fetch, shared
Loading/Error        ⚠️  Manual, error-prone       Automatic
Race conditions      ❌ Not handled                Auto cancellation
Retry                ❌ Not handled                Built-in
Refetch on focus     ❌ Not handled                Built-in
```

### State Classification

```
State                    Type      Why
───────────────────────────────────────────────────
isModalOpen              Client    You control it, synchronous
selectedTab              Client    You control it, synchronous
theme                    Client    You control it, synchronous
formInputValue           Client    You control it, synchronous
todos from API           Server    Server owns it, async, can stale
user profile             Server    Server owns it, async, can stale
product list             Server    Server owns it, async, can stale
search results           Server    Server owns it, async, can stale
```

### Right Tool for Each

```
Client state → useState, useReducer, Context, Zustand
Server state → React Query (TanStack Query), SWR, RTK Query
```

> **The moment you write useEffect + fetch + useState for loading/error/data, you're reinventing React Query poorly.**

---

## Colocation vs Lifting State

### Definitions

```
COLOCATION (pushing state DOWN):
  Put state as close to where it's used as possible.
  Start local. Only move up when forced.

LIFTING STATE (pulling state UP):
  Move state to a common ancestor so siblings can share it.
  Move up when 2+ components need the same value.
```

### Colocation First

```jsx
// ✅ Search state lives inside SearchInput — only it needs the value
function SearchInput() {
  const [query, setQuery] = useState("");
  return <input value={query} onChange={e => setQuery(e.target.value)} />;
}
// Blast radius: 1 component
```

### When You Must Lift

```jsx
// ProductList also needs query → lift to common parent
function App() {
  const [query, setQuery] = useState("");
  return (
    <div>
      <Header />
      <SearchInput query={query} setQuery={setQuery} />
      <ProductList query={query} />
      <Footer />
    </div>
  );
}
// Cost: Header and Footer re-render on every keystroke (wasted)
```

### The Extraction Pattern (Best of Both)

```jsx
// ✅ Extract related components into their own subtree
function App() {
  return (
    <div>
      <Header />
      <SearchableProducts />    {/* state colocated here */}
      <Footer />
    </div>
  );
}

function SearchableProducts() {
  const [query, setQuery] = useState("");
  return (
    <>
      <SearchInput query={query} setQuery={setQuery} />
      <ProductList query={query} />
    </>
  );
}
// Blast radius: 3 (SearchableProducts + SearchInput + ProductList)
// Header and Footer: untouched
```

### The Lifecycle of State Placement

```
colocated → lifted → extracted → global
    ↑                                │
    └── push back down when possible ┘
```

### Decision Framework

```
Where should this state live?

  1. Only ONE component uses it?
     → colocate (useState inside it)

  2. Parent + direct children use it?
     → useState in parent, pass as props

  3. Siblings need it?
     → Lift to common ancestor
     → Better: extract them into a shared wrapper

  4. Distant components across different subtrees?
     → Context (read-heavy, write-rare)
     → Zustand/Redux (write-heavy, needs selectors)
     → URL params (should survive refresh/sharing)
     → React Query (server state)
```

### Prop Drilling vs Context vs State Library

```
PROP DRILLING:
  OK:    2-3 levels, few props
  Hurts: 5+ levels, intermediaries don't use them

CONTEXT:
  OK:    Values that change rarely (theme, auth, locale)
  Hurts: Values that change often (every keystroke)
         All consumers re-render on any change

STATE LIBRARY (Zustand, Jotai):
  OK:    Many consumers, frequent updates, need selectors
  Hurts: Simple cases (overkill)
```

---

## React Query

### The Core Idea

> **React Query is a cache manager for server state. It treats API data as a cache with an expiry — not as local state you manually keep in sync.**

```
Traditional:
  Component ──fetch──→ API ──response──→ useState
  You manage EVERYTHING manually.

React Query:
  Component ──useQuery──→ CACHE ──(stale?)──→ API (background)
  Returns instantly from cache if available.
```

### Basic Usage: useQuery

```jsx
import { useQuery } from "@tanstack/react-query";

function TodoList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["todos"],
    queryFn: () => fetch("/api/todos").then(r => r.json()),
  });

  if (isLoading) return <Spinner />;
  if (error) return <Error message={error.message} />;
  return data.map(t => <Todo key={t.id} todo={t} />);
}
```

### Query Keys: Cache Identity

```jsx
useQuery({ queryKey: ["todos"] })                        // all todos
useQuery({ queryKey: ["todos", { status: "done" }] })    // filtered
useQuery({ queryKey: ["todos", 5] })                     // todo id=5
useQuery({ queryKey: ["users", userId] })                // specific user

// When any key part changes → new cache entry → new fetch
```

```
Cache:
  ["todos"]                      → [{ id: 1, ... }, { id: 2, ... }]
  ["todos", { status: "done" }]  → [{ id: 2, ..., done: true }]
  ["users", "rak"]               → { name: "Rak", role: "admin" }
```

### Stale-While-Revalidate

The single most important concept:

```
1. Cache has data for this key?
     ├── No  → fetch, show loading
     └── Yes → show cached data IMMEDIATELY
               └── is it stale? (past staleTime)
                     ├── No  → done, use cache
                     └── Yes → show cache AND refetch in background
                               └── fresh data arrives → swap silently
```

```
Traditional:                       Stale-while-revalidate:
  Navigate → spinner (2s) → data     Navigate → data instantly → silent refresh
  User waits.                        User never waits.
```

### Key Configuration

```jsx
useQuery({
  queryKey: ["todos"],
  queryFn: fetchTodos,

  staleTime: 5 * 60 * 1000,     // 5 min before data is "stale" (default: 0)
  gcTime: 30 * 60 * 1000,       // 30 min before inactive cache is garbage collected (default: 5 min)

  refetchOnWindowFocus: true,    // refetch when user tabs back (default: true)
  refetchOnMount: true,          // refetch on component mount (default: true)
  refetchOnReconnect: true,      // refetch on network reconnect (default: true)

  retry: 3,                      // retry failed requests (default: 3)
});
```

### staleTime vs gcTime

```
staleTime: "How long is data considered FRESH?"
  While fresh → serve from cache, no background refetch
  After stale → serve from cache, refetch in background

gcTime: "How long to keep INACTIVE cache in memory?"
  Inactive = no component using this query
  After gcTime → cache entry deleted
  Next mount → full loading state (no cache)
```

```
Timeline:
  0 min   Fetch → cache ✅
  5 min   staleTime expires → data is "stale"
  8 min   Component unmounts → cache is INACTIVE
  13 min  gcTime expires → cache DELETED
  15 min  Component mounts → no cache → loading → fresh fetch
```

### Deduplication

```jsx
// Three components on same page, all need user data
function Header()   { useQuery({ queryKey: ["user"], queryFn: fetchUser }); }
function Sidebar()  { useQuery({ queryKey: ["user"], queryFn: fetchUser }); }
function Settings() { useQuery({ queryKey: ["user"], queryFn: fetchUser }); }

// WITHOUT React Query: 3 fetch requests
// WITH React Query:    1 fetch request, all 3 receive data
```

### Mutations

```jsx
import { useMutation, useQueryClient } from "@tanstack/react-query";

function TodoForm() {
  const queryClient = useQueryClient();

  const addTodo = useMutation({
    mutationFn: (newTodo) => fetch("/api/todos", {
      method: "POST",
      body: JSON.stringify(newTodo),
    }).then(r => r.json()),

    onSuccess: () => {
      // Invalidate cache → triggers automatic refetch
      queryClient.invalidateQueries({ queryKey: ["todos"] });
    },
  });

  return (
    <button
      onClick={() => addTodo.mutate({ text: "New todo", done: false })}
      disabled={addTodo.isPending}
    >
      {addTodo.isPending ? "Adding..." : "Add Todo"}
    </button>
  );
}
```

```
Flow:
  1. User clicks → POST /api/todos
  2. Server responds success
  3. invalidateQueries(["todos"]) → cache marked stale
  4. Any mounted component using ["todos"] refetches automatically
  No manual state updates. Cache handles it.
```

### What React Query Eliminates

```
You no longer write:                React Query handles:
───────────────────                 ────────────────────
useState for data                   Automatic
useState for loading                isLoading / isPending
useState for error                  error / isError
useEffect for fetching              queryFn
Race condition cancelled flag       Automatic cancellation
Retry logic                         Built-in with backoff
Cache in context/store              Built-in cache
Refetch on focus/reconnect          Built-in
Deduplication                       Built-in
Optimistic updates                  Built-in
```

### The Big Insight

```
Before React Query:
  Redux store = { user, todos, products, theme, sidebarOpen }
  80% was server state with manual sync logic.

After React Query:
  React Query handles: user, todos, products (server state)
  Client store = { theme, sidebarOpen }
  Most apps don't even NEED Redux after React Query.
```

---

## Bad State Placement

Every example follows the same formula: **state lives too high → unrelated components re-render → performance dies.**

### Example 1: Search Query in App

```jsx
// ❌ query in App — everything re-renders on every keystroke
function App() {
  const [query, setQuery] = useState("");
  return (
    <div>
      <Navbar />
      <SearchInput query={query} setQuery={setQuery} />
      <ProductList query={query} />
      <RecommendedSection />
      <Footer />
    </div>
  );
}
```

```
Each keystroke: 6 components render. Only 2 needed.

Fix: extract SearchableProducts component with local state.
Result: 3 renders per keystroke. 0 wasted.
```

### Example 2: Hover State in Global Store

```jsx
// ❌ hoveredProductId in Zustand — 50 cards re-render on every hover
const useStore = create((set) => ({
  hoveredProductId: null,
  setHoveredProductId: (id) => set({ hoveredProductId: id }),
}));
```

```
50 cards × 20 hover events = 1000 renders for moving a mouse.

Fix: useState inside each ProductCard.
Result: 1 render per hover event.
```

### Example 3: Form State in Context

```jsx
// ❌ All form values in one context — typing in name re-renders all fields
const FormContext = createContext();
// { name, email, address, phone } in one context value
```

```
Context doesn't support selective subscription.
Typing in ONE field re-renders ALL fields.

Fix: each field manages own local state, values collected on submit.
Or: uncontrolled inputs with refs.
```

### Example 4: Modal State Too High

```jsx
// ❌ isModalOpen in App — opening modal re-renders Dashboard (expensive)
function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  return (
    <div>
      <Header />
      <Dashboard />        {/* charts, tables — expensive */}
      <button onClick={() => setIsModalOpen(true)}>Open</button>
      {isModalOpen && <Modal />}
    </div>
  );
}
```

```
Fix: extract ModalButton component with local state.
Dashboard never re-renders when modal opens.
```

### Example 5: Server State in Redux

```jsx
// ❌ Fetching todos into Redux — manual sync, no caching, no dedup
const todosSlice = createSlice({
  initialState: { items: [], loading: false, error: null },
  reducers: { setLoading, setTodos, setError },
});

// Component: useEffect + dispatch(setLoading) + fetch + dispatch(setTodos)...
```

```
Fix: React Query.
  const { data, isLoading, error } = useQuery({
    queryKey: ["todos"],
    queryFn: fetchTodos,
    staleTime: 5 * 60 * 1000,
  });
Caching ✅, dedup ✅, staleness ✅, retry ✅, no Redux boilerplate.
```

### The Pattern

```
Every bad placement:
  State too HIGH → parent re-renders → ALL children re-render → waste

Every fix:
  Push state DOWN to smallest subtree that needs it
  OR extract related components into a wrapper
  OR use the right tool (React Query for server state)
```

---

## Interview Questions

### Local vs Global State

**Q: How do you decide whether state should be local or global?**
"How many components need this value?" One component → local. Many unrelated components across subtrees → global. Default to local, only globalize when forced.

**Q: What's wrong with putting everything in a global store?**
Any change re-renders all consumers. Search keystrokes re-render the theme toggle. Maximum blast radius for every update.

**Q: What tools for local vs global?**
Local: useState, useReducer. Global: Context (rare changes), Zustand/Jotai (frequent changes, selectors), URL params (should survive refresh).

### Server vs Client State

**Q: What's the difference between server state and client state?**
Client: you own it, synchronous, always current (modal open, selected tab). Server: server owns it, async, can go stale (API data, user profile).

**Q: Why not useState + useEffect for API data?**
Only solves fetching. No caching, no dedup, no staleness, no retry, no race condition handling. You're reinventing React Query poorly.

**Q: What is stale-while-revalidate?**
Show cached data immediately (even if stale), refetch in background, swap silently when fresh data arrives. User sees data instantly instead of a spinner.

**Q: What problems does React Query solve?**
Caching, staleness, dedup, retry, background refetch on focus/reconnect, race condition cancellation, optimistic updates, cache invalidation after mutations.

**Q: After React Query, what happens to your Redux store?**
Shrinks dramatically. Most "global state" was server state. Client store reduces to theme, sidebar, locale — often just useState + Context.

### Colocation vs Lifting

**Q: What is state colocation?**
Put state as close to where it's used as possible. Minimizes blast radius. Default approach.

**Q: When do you lift state? What's the cost?**
Lift when siblings need the same value. Cost: unrelated children of the common ancestor re-render. Mitigation: extract related siblings into a wrapper component.

**Q: Explain the extraction pattern.**
Instead of lifting query to App (Header and Footer re-render), create SearchableProducts that owns query and contains SearchInput + ProductList. Blast radius drops from entire app to just the components that use query.

### Bad State Placement

**Q: How does state placement affect performance?**
Render Cost ∝ Tree Size × Update Frequency. State placement controls tree size. Higher state = more components re-render per update.

**Q: A dashboard freezes when opening a modal. What's likely wrong?**
Modal state lives too high — same component that owns Dashboard. Toggling re-renders expensive charts. Fix: extract modal into self-contained component with local state.

### Architecture

**Q: How would you structure state in an e-commerce app?**
Client (useState/Context): theme, sidebar, modals. Server (React Query): products, user, cart, orders, search results. URL (router): current page, shareable search query. Forms: colocated per-field or React Hook Form.

**Q: Search bar filters a product list and query appears in URL. How?**
Query lives in URL params (useSearchParams). React Query uses URL param as part of queryKey. No useState for query — URL is the state. Gives shareable URLs, back/forward support, SSR support.