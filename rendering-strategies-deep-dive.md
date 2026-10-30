# Rendering Strategies — Deep Dive

## Table of Contents

- [Mental Model](#mental-model)
- [CSR — Client-Side Rendering](#csr--client-side-rendering)
- [SSR — Server-Side Rendering](#ssr--server-side-rendering)
- [SSG — Static Site Generation](#ssg--static-site-generation)
- [Streaming SSR](#streaming-ssr)
- [Hydration Deep Dive](#hydration-deep-dive)
- [Partial Rendering and React Server Components](#partial-rendering-and-react-server-components)
- [Next.js and the App Router](#nextjs-and-the-app-router)
- [Trade-offs — The Only Thing That Matters](#trade-offs--the-only-thing-that-matters)
- [Interview Questions](#interview-questions)

---

## Mental Model

Every rendering strategy answers one question: **who builds the HTML, and when?**

```
              WHO builds HTML?
              ┌─────────────────────────────┐
              │     Server        Browser   │
              │                             │
  WHEN?       │                             │
  ──────      │                             │
  Build time  │     SSG             —       │
  Request     │     SSR             —       │
  After load  │      —             CSR      │
  Request     │   Streaming         —       │
  (chunked)   │   (progressive)             │
              └─────────────────────────────┘
```

> **Trade-offs matter more than implementation.**
> No strategy is universally better. Each shifts cost between build time, server time, and client time.

---

## CSR — Client-Side Rendering

The browser does all the work. The server sends an empty shell.

### How It Works

```
Server sends:
┌─────────────────────────────┐
│  <html>                     │
│    <body>                   │
│      <div id="root"></div>  │  ← empty
│      <script src="app.js"> │  ← entire app bundled here
│    </body>                  │
│  </html>                    │
└─────────────────────────────┘

Browser:
  1. Downloads HTML         → user sees blank page
  2. Downloads JS bundle    → still blank
  3. Parses + executes JS   → still blank
  4. React renders to DOM   → content appears (all at once)
```

```
Timeline:
  HTML ──→ JS download ──→ Parse ──→ Execute ──→ Render
  |                                              |
  └──────── blank screen (FCP delayed) ──────────┘
```

### Example (Plain React / Vite)

```jsx
// index.html — the server returns this for EVERY route
<div id="root"></div>
<script type="module" src="/src/main.tsx"></script>

// main.tsx — React builds everything client-side
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
```

```jsx
// App.tsx — data fetching happens in the browser
function App() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    fetch('/api/posts')
      .then(res => res.json())
      .then(setPosts);
  }, []);

  if (!posts.length) return <Spinner />;  // user sees this first
  return <PostList posts={posts} />;
}
```

### What You Get

```
  Pros                          Cons
  ──────────────────            ──────────────────
  Simple deployment             Blank page until JS loads
  (just static files)           (bad FCP, bad LCP)

  Rich interactivity            SEO is poor — crawlers see
  after load                    empty <div>

  Cheap hosting                 Large JS bundle shipped to
  (CDN, S3, Vercel static)      every user upfront

  No server needed              Data fetching waterfalls
  at request time               (component mounts → fetch)
```

### When CSR Makes Sense

- Authenticated dashboards (SEO irrelevant)
- Internal tools / admin panels
- Apps behind login walls
- Highly interactive SPAs (Figma, Google Docs)

---

## SSR — Server-Side Rendering

The server runs your React components and sends **real HTML** on every request.

### How It Works

```
Browser requests /posts
        │
        ▼
┌─────────────────────────────────┐
│  SERVER                         │
│                                 │
│  1. Receives request            │
│  2. Fetches data (DB, API)      │
│  3. Runs React components       │
│  4. Generates full HTML string  │
│  5. Sends HTML + JS bundle      │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  BROWSER                        │
│                                 │
│  1. Receives HTML → paints      │  ← user sees content (fast FCP)
│     immediately                 │
│  2. Downloads JS bundle         │
│  3. HYDRATION: React attaches   │  ← page becomes interactive (TTI)
│     event handlers to existing  │
│     HTML                        │
└─────────────────────────────────┘
```

```
Timeline:
  Request ──→ Server work ──→ HTML arrives ──→ Paint ──→ JS ──→ Hydrate
              |                               |                 |
              server cost                     FCP               TTI
              (TTFB delayed)                  (fast!)           (delayed)
                                              
              ← visible but NOT interactive ──→
                  "uncanny valley"
```

### Example (Next.js Pages Router)

```jsx
// pages/posts.tsx
export async function getServerSideProps() {
  const posts = await db.posts.findMany();  // runs on server every request
  return { props: { posts } };
}

export default function PostsPage({ posts }) {
  // This component runs on the server (to generate HTML)
  // AND on the client (during hydration)
  return (
    <ul>
      {posts.map(post => (
        <li key={post.id}>
          <a href={`/posts/${post.id}`}>{post.title}</a>
        </li>
      ))}
    </ul>
  );
}
```

### What You Get

```
  Pros                          Cons
  ──────────────────            ──────────────────
  Fast FCP — user sees          Server runs on EVERY request
  real content immediately      (costs money, adds latency)

  SEO-friendly — crawlers       TTFB is slower (server must
  see full HTML                 fetch data + render)

  Fresh data on every           Hydration cost on client
  request                       (JS still downloads + executes)

  Works with dynamic,           Page is visible but NOT
  personalized content          interactive during hydration
```

### The Core Insight

> **SSR improves _perceived_ performance. But it adds server cost + hydration cost.**
> You're not removing work — you're shifting it. The user sees content sooner, but the total work done (server render + client hydration) can be MORE than CSR alone.

---

## SSG — Static Site Generation

HTML is generated once at **build time**, then served as static files.

### How It Works

```
BUILD TIME (npm run build):
┌─────────────────────────────────┐
│                                 │
│  For each page:                 │
│  1. Fetch data                  │
│  2. Run React components        │
│  3. Write .html file to disk    │
│                                 │
│  /posts.html     ← pre-built   │
│  /about.html     ← pre-built   │
│  /posts/1.html   ← pre-built   │
└─────────────────────────────────┘

REQUEST TIME:
┌──────────┐      ┌──────────┐
│  Browser  │ ───→ │   CDN    │ ───→ serves pre-built .html
└──────────┘      └──────────┘
                  No server logic.
                  Just files.
```

### Example (Next.js Pages Router)

```jsx
// pages/posts.tsx
export async function getStaticProps() {
  const posts = await db.posts.findMany();  // runs ONCE at build time
  return {
    props: { posts },
    revalidate: 60,  // ISR: rebuild this page at most every 60 seconds
  };
}

export default function PostsPage({ posts }) {
  return (
    <ul>
      {posts.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

### ISR — Incremental Static Regeneration

The hybrid: serve static, but rebuild in the background when stale.

```
Request 1 (within 60s):
  CDN → serves cached HTML instantly

Request 2 (after 60s):
  CDN → serves STALE HTML instantly (user doesn't wait)
       → triggers background rebuild
       → next request gets fresh HTML

This is "stale-while-revalidate" for pages.
```

### What You Get

```
  Pros                          Cons
  ──────────────────            ──────────────────
  Fastest TTFB (CDN edge)       Data can be stale

  Cheapest to serve             Build time grows with
  (just static files)           number of pages

  Best for SEO                  Can't personalize per user
                                (same HTML for everyone)

  Scales infinitely             Dynamic content needs
  (CDN handles traffic)         client-side fetching on top
```

### When SSG Makes Sense

- Marketing pages, blogs, docs
- Content that changes infrequently
- Pages where staleness is acceptable
- High-traffic pages (CDN absorbs load)

---

## Streaming SSR

The server doesn't wait for everything to finish. It sends HTML **in chunks** as parts become ready.

### How It Works

```
Traditional SSR:
  Server: [─── fetch ALL data ───][─── render ALL HTML ───] → send entire page
  Browser:                                                    paint everything

Streaming SSR:
  Server: [── render shell ──] → send shell
          [── fetch slow data ──────] → send chunk when ready
  Browser: paint shell immediately
                                       paint slow content when it arrives
```

```
What the browser receives over time:

t=0ms:    <html><body>
            <nav>Home | Posts</nav>         ← shell: instant
            <main>
              <!--$?-->
              <template id="B:0"></template>  ← placeholder for slow content
              <p>Loading...</p>              ← fallback
              <!--/$-->

t=200ms:  <div hidden id="S:0">             ← slow content arrives
            <ul><li>Post 1</li>...</ul>
          </div>
          <script>                           ← inline script swaps fallback
            $RC("B:0", "S:0")                   with real content
          </script>
```

### Example (Next.js App Router / React 18)

```jsx
// app/posts/page.tsx
import { Suspense } from 'react';

export default function PostsPage() {
  return (
    <main>
      <h1>Posts</h1>
      <Suspense fallback={<p>Loading posts...</p>}>
        <PostList />  {/* this component can be async */}
      </Suspense>
      <Suspense fallback={<p>Loading sidebar...</p>}>
        <Sidebar />
      </Suspense>
    </main>
  );
}

// PostList is an async Server Component
async function PostList() {
  const posts = await db.posts.findMany();  // server fetches data
  return (
    <ul>
      {posts.map(post => <li key={post.id}>{post.title}</li>)}
    </ul>
  );
}
```

### Streaming + Suspense Boundaries

```
┌──────────────────────────────────────┐
│  Page Shell (sent immediately)        │
│  ┌────────────────────────────────┐  │
│  │  <Suspense>                    │  │
│  │  PostList                      │  │  ← streams in when DB query done
│  │  fallback: Loading posts...    │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  <Suspense>                    │  │
│  │  Sidebar                       │  │  ← streams in independently
│  │  fallback: Loading sidebar...  │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘

Each Suspense boundary streams independently.
Slow components don't block fast ones.
```

### What You Get

```
  Pros                              Cons
  ──────────────────                ──────────────────
  Fast TTFB — shell sent            More complex mental model
  immediately                       (Suspense boundaries, streaming)

  No single slow query blocks       Still requires a server
  the entire page                   (can't be purely static)

  Progressive rendering —           Fallback UI flashes if content
  user sees content as it           resolves too quickly (need to
  becomes ready                     tune Suspense placement)

  Reduces perceived latency         Hydration still required
  significantly                     for interactive parts
```

---

## Hydration Deep Dive

Hydration is the most misunderstood concept in SSR. It's where performance is won or lost.

### What Hydration Actually Does

```
SERVER produces:
  <button class="like-btn">Like (42)</button>
  
  This is DEAD HTML. Clicking it does nothing.

HYDRATION does:
  1. React downloads the JS bundle
  2. React re-executes your component tree in memory
  3. React walks the existing DOM
  4. React attaches event handlers to existing elements
  5. React verifies the DOM matches what it would render
  
  NOW the button works.
```

```
Before hydration:          After hydration:
┌─────────────────┐       ┌─────────────────┐
│  <button>       │       │  <button        │
│    Like (42)    │       │    onClick={fn}  │  ← event handler attached
│  </button>      │       │    Like (42)    │
│                 │       │  </button>      │
│  (visible but   │       │                 │
│   NOT clickable)│       │  (fully         │
│                 │       │   interactive)  │
└─────────────────┘       └─────────────────┘
```

### The Cost of Hydration

Hydration is **not free**. React must:

```
Cost breakdown:
  1. Download JS bundle      ← network cost (can be large)
  2. Parse JavaScript        ← CPU cost
  3. Execute all components   ← CPU cost (re-runs your component tree!)
  4. Walk the DOM tree        ← CPU cost
  5. Attach event listeners   ← memory cost

Total: roughly equivalent to a full client-side render,
       minus the DOM creation (DOM already exists from server HTML).
```

```
What users experience:

  ──────────────── time ────────────────→
  
  │ HTML │ JS download │ Hydration │
  │arrives│            │           │
  
  ← visible ──────────────────────→
       but NOT interactive
            ← "uncanny valley" ──→
                                   ← fully interactive
```

> **The "uncanny valley" of SSR**: the page looks ready but doesn't respond to clicks. The user clicks a button, nothing happens. They click again. Still nothing. Then suddenly two actions fire at once. This is worse UX than a loading spinner in many cases.

### Hydration Mismatch

When server HTML doesn't match what React expects on the client:

```jsx
// This will cause a hydration mismatch
function Greeting() {
  return <p>The time is {new Date().toLocaleTimeString()}</p>;
  //                      ↑ different on server vs client
}

// Server renders: <p>The time is 10:00:00 AM</p>
// Client hydration: "I expected 10:00:02 AM but found 10:00:00 AM"
// React: throws warning, falls back to client render (expensive)
```

```jsx
// Fixes for dynamic content:
function Greeting() {
  const [time, setTime] = useState(null);  // null on both server + client

  useEffect(() => {
    setTime(new Date().toLocaleTimeString());  // only runs on client
  }, []);

  return <p>The time is {time ?? 'loading...'}</p>;
}
```

### Why Hydration is Expensive at Scale

```
Page with 100 components:

  Traditional SSR + Hydration:
  Server: renders 100 components → HTML
  Client: re-renders 100 components → attaches handlers

  Total component executions: 200 (100 server + 100 client)
  
  CSR only:
  Client: renders 100 components → creates DOM + attaches handlers

  Total component executions: 100

  SSR does MORE total work. The win is PERCEIVED performance —
  the user sees content sooner even though total work is higher.
```

```
Bundle size impact:

  CSR: ships components once (as JS)
  SSR: ships components TWICE
       - once as HTML (server-rendered)
       - once as JS (for hydration)

  The HTML and JS are redundant for non-interactive content.
  This is the problem React Server Components solve.
```

---

## Partial Rendering and React Server Components

The insight: not every component needs to hydrate. Most of your page is static content that never changes after load.

### The Problem Partial Rendering Solves

```
Typical page breakdown:

┌──────────────────────────────────────────┐
│  Header / Nav                            │  ← static (never changes)
├──────────────────────────────────────────┤
│                          │               │
│  Article content         │  Sidebar      │  ← static
│  (paragraphs, images)    │  (links)      │
│                          │               │
├──────────────────────────┤               │
│  Comment section         │               │  ← interactive (needs JS)
│  [Like] [Reply] [Share]  │               │
│                          │               │
└──────────────────────────────────────────┘

Traditional SSR hydrates EVERYTHING — even the static parts.
React Server Components hydrate ONLY the interactive parts.
```

### React Server Components (RSC)

```
Server Components:                Client Components:
  - Run ONLY on server              - Run on server (SSR) AND client
  - Zero JS shipped to browser      - JS shipped for hydration
  - Can access DB, filesystem       - Can use useState, useEffect
  - Cannot use hooks or events      - Cannot access server resources
  - Output: HTML (final)            - Output: HTML + JS (interactive)
```

```jsx
// app/posts/page.tsx — Server Component (default in App Router)
// This component's JS is NEVER sent to the browser
import { db } from '@/lib/db';
import { LikeButton } from './like-button';  // Client Component

export default async function PostPage({ params }) {
  const post = await db.posts.findUnique({ where: { id: params.id } });

  return (
    <article>
      <h1>{post.title}</h1>           {/* ← server only, zero JS */}
      <p>{post.content}</p>           {/* ← server only, zero JS */}
      <LikeButton postId={post.id} /> {/* ← client component, JS shipped */}
    </article>
  );
}
```

```jsx
// app/posts/like-button.tsx — Client Component
'use client';  // ← this directive marks the hydration boundary

import { useState } from 'react';

export function LikeButton({ postId }) {
  const [liked, setLiked] = useState(false);

  return (
    <button onClick={() => setLiked(!liked)}>
      {liked ? 'Liked!' : 'Like'}
    </button>
  );
}
```

### What Gets Shipped

```
Traditional SSR:
  HTML: <article><h1>Title</h1><p>Content...</p><button>Like</button></article>
  JS:   PostPage.js + LikeButton.js + React runtime
        ↑ entire tree must hydrate

React Server Components:
  HTML: <article><h1>Title</h1><p>Content...</p><button>Like</button></article>
  JS:   LikeButton.js + React runtime (smaller)
        ↑ only the interactive island hydrates

Bundle reduction:
  ┌──────────────────┐     ┌──────────────────┐
  │  Traditional SSR  │     │  With RSC         │
  │                  │     │                  │
  │  ████████████    │     │  ██              │
  │  (all components)│     │  (only client    │
  │                  │     │   components)    │
  └──────────────────┘     └──────────────────┘
```

### The `'use client'` Boundary

```
Component tree:

  ServerLayout          ← server component
    ├── Header          ← server component
    ├── ArticleBody     ← server component
    ├── CommentSection  ← 'use client' (boundary)
    │     ├── Comment   ← client (inherits from parent)
    │     ├── ReplyForm ← client (inherits from parent)
    │     └── LikeBtn   ← client (inherits from parent)
    └── Footer          ← server component

Everything below 'use client' is a Client Component.
Everything above it (by default) is a Server Component.
```

> **`'use client'` is not "this runs on the client." It means "this is the boundary where hydration begins." Client Components still render on the server during SSR — they just ALSO hydrate on the client.**

### Selective Hydration (React 18)

React 18 can hydrate different Suspense boundaries independently and prioritize based on user interaction:

```
Page loads, hydration begins:

  ┌─────────────────┐
  │  Nav (hydrated)  │  ← hydrated first (small)
  ├─────────────────┤
  │  Content         │
  │  (hydrating...)  │  ← hydrating in background
  ├─────────────────┤
  │  Comments        │
  │  (not started)   │  ← queued
  └─────────────────┘

User clicks on Comments section:

  React: "User is interacting with Comments — prioritize it!"
  
  ┌─────────────────┐
  │  Nav (hydrated)  │
  ├─────────────────┤
  │  Content         │
  │  (paused)        │  ← React pauses this
  ├─────────────────┤
  │  Comments        │
  │  (hydrating NOW) │  ← React prioritizes this
  └─────────────────┘
```

---

## Next.js and the App Router

Next.js is the primary framework that unifies all these strategies. The App Router (Next.js 13+) defaults to React Server Components.

### How Next.js Chooses a Strategy

```
┌─────────────────────────────────────────────────┐
│  Next.js App Router Decision Tree               │
│                                                 │
│  Is the page dynamic?                           │
│  ├── No → SSG (static at build time)            │
│  │        Can add revalidate for ISR            │
│  │                                              │
│  └── Yes → Does it use:                         │
│       ├── cookies(), headers(),                 │
│       │   searchParams?                         │
│       │   → Dynamic SSR (per request)           │
│       │                                         │
│       └── Only Server Components                │
│           with no dynamic functions?            │
│           → SSG (auto-detected)                 │
│                                                 │
│  Streaming: Always enabled via Suspense         │
└─────────────────────────────────────────────────┘
```

### Next.js Rendering Modes in Practice

```jsx
// 1. STATIC (SSG) — auto-detected, no dynamic functions
// app/about/page.tsx
export default function AboutPage() {
  return <h1>About Us</h1>;  // built once at build time
}

// 2. STATIC with REVALIDATION (ISR)
// app/posts/page.tsx
export const revalidate = 60;  // rebuild every 60 seconds

export default async function PostsPage() {
  const posts = await fetch('https://api.example.com/posts');
  return <PostList posts={posts} />;
}

// 3. DYNAMIC (SSR per request)
// app/dashboard/page.tsx
import { cookies } from 'next/headers';

export default async function Dashboard() {
  const session = cookies().get('session');  // dynamic function → SSR
  const data = await getUserData(session);
  return <DashboardView data={data} />;
}

// 4. STREAMING (SSR + Suspense)
// app/feed/page.tsx
import { Suspense } from 'react';

export default function FeedPage() {
  return (
    <>
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>
      <Suspense fallback={<FeedSkeleton />}>
        <Feed />          {/* streams in when ready */}
      </Suspense>
      <Suspense fallback={<SidebarSkeleton />}>
        <Recommendations /> {/* streams independently */}
      </Suspense>
    </>
  );
}
```

### The Server/Client Component Split in Next.js

```
Rule of thumb for splitting:

  KEEP ON SERVER (default):         MOVE TO CLIENT ('use client'):
  ────────────────────              ────────────────────────────
  Data fetching                     onClick, onChange, onSubmit
  Database queries                  useState, useEffect, useRef
  Access tokens / secrets           Browser APIs (localStorage)
  Heavy dependencies                Real-time updates (WebSocket)
  (markdown parsers, etc.)          User input forms
  Static content rendering          Animations / transitions

  Why: zero JS shipped              Why: needs browser APIs or
  for these components               React state/effects
```

---

## Trade-offs — The Only Thing That Matters

### The Comparison Grid

```
            │ FCP    │ TTI    │ SEO  │ Server  │ Freshness │ Complexity │
  ──────────┼────────┼────────┼──────┼─────────┼───────────┼────────────┤
  CSR       │ Slow   │ Fast*  │ Bad  │ None    │ Real-time │ Low        │
  SSR       │ Fast   │ Slow   │ Good │ High    │ Real-time │ Medium     │
  SSG       │ Fast   │ Fast   │ Good │ None    │ Stale     │ Low        │
  ISR       │ Fast   │ Fast   │ Good │ Low     │ Near-real │ Medium     │
  Streaming │ Fast   │ Med    │ Good │ High    │ Real-time │ High       │
  RSC       │ Fast   │ Fast** │ Good │ Medium  │ Real-time │ High       │

  * CSR TTI is "fast" because there's no hydration gap — but absolute
    time to interactive may be longer due to late FCP.
  ** RSC TTI is fast because only interactive islands hydrate.
```

### Where Each Strategy Wins

```
CSR:
  "My users are logged in and SEO doesn't matter."
  → Dashboards, admin panels, internal tools
  → Figma, Google Docs, Spotify web player

SSR:
  "I need fresh, personalized content that's SEO-visible."
  → E-commerce product pages, social media feeds
  → Anything with user-specific content that crawlers need to see

SSG:
  "My content barely changes and I want maximum speed."
  → Blogs, docs, marketing sites, landing pages
  → MDN, Next.js docs, company websites

ISR:
  "I want SSG speed but my content updates sometimes."
  → News sites, product catalogs, listings
  → Content that changes hourly/daily, not per-second

Streaming:
  "My page has parts that load at different speeds."
  → Complex pages with multiple data sources
  → Dashboards with slow analytics queries

RSC:
  "I want to minimize client JS while keeping interactivity where needed."
  → Content-heavy sites with interactive islands
  → The default in modern Next.js — use unless you have reason not to
```

### The Performance Equation

```
CSR total cost:
  User pays: JS download + parse + execute + render + data fetch
  Server pays: nothing (serves static files)

SSR total cost:
  User pays: HTML download + JS download + parse + hydration
  Server pays: data fetch + render HTML (per request!)

SSG total cost:
  User pays: HTML download + JS download + parse + hydration
  Server pays: nothing (CDN serves files)
  Build pays: data fetch + render HTML (once)

Streaming total cost:
  User pays: HTML chunks + JS download + parse + selective hydration
  Server pays: data fetch + progressive render (per request)

RSC total cost:
  User pays: HTML download + partial JS + partial hydration
  Server pays: server component execution (per request or cached)

Key insight: SSR doesn't reduce total work — it SHIFTS work
from "after the user sees a blank page" to "before the user
sees anything." The total CPU time is often higher than CSR.
```

### Common Mistakes

```
Mistake 1: "SSR is always faster"
  Reality: SSR improves PERCEIVED speed (FCP) but can hurt ACTUAL speed
  (TTI delayed by hydration). For a dashboard behind auth, CSR is simpler
  and often faster end-to-end.

Mistake 2: "SSG is always best for performance"
  Reality: SSG pages still hydrate! If your page has heavy interactive
  components, the hydration cost is the same as SSR. SSG only helps
  TTFB (no server wait).

Mistake 3: "React Server Components eliminate hydration"
  Reality: RSC eliminates hydration for SERVER components only. Client
  Components (anything with 'use client') still hydrate. RSC reduces
  the hydration surface — it doesn't remove it.

Mistake 4: "I should use SSR for everything"
  Reality: SSR has ongoing server costs, complexity, and the uncanny
  valley problem. Pick the simplest strategy that meets your requirements.
```

---

## Interview Questions

### CSR vs SSR vs SSG

**Q: Explain the difference between CSR, SSR, and SSG.**
CSR: browser downloads empty HTML + JS bundle, React renders entirely in the browser. SSR: server runs React on every request, sends full HTML, browser hydrates. SSG: React runs at build time, generates static HTML files served from CDN. The core difference is who builds the HTML (browser vs server) and when (load time vs request time vs build time).

**Q: When would you choose CSR over SSR?**
When SEO is irrelevant (authenticated dashboards, internal tools, apps behind login). CSR is simpler — no server to maintain, no hydration mismatch issues, no uncanny valley. The trade-off is a blank page until JS loads, which is acceptable when users expect a loading state.

**Q: What is ISR and when would you use it?**
Incremental Static Regeneration. Serves static pages from CDN but rebuilds them in the background after a revalidation interval. You get SSG speed with near-real-time freshness. Use for content that changes periodically (product catalogs, blog posts) but not per-user (can't personalize).

### Hydration

**Q: What is hydration and why is it expensive?**
Hydration is the process where React attaches event handlers to server-rendered HTML. It downloads the JS bundle, re-executes the component tree, walks the DOM, and binds listeners. It's expensive because React essentially re-renders everything client-side — the only saving versus CSR is that the DOM nodes already exist. The HTML and JS are redundant for non-interactive content.

**Q: What is the "uncanny valley" of SSR?**
The gap between First Contentful Paint and Time To Interactive. The page looks fully loaded (HTML is painted) but doesn't respond to user interaction (JS hasn't hydrated yet). Users click buttons that don't respond, type in inputs that don't register. This can be worse UX than a loading spinner because it violates the user's expectation that visible UI is functional.

**Q: What causes a hydration mismatch and how do you fix it?**
When server-rendered HTML differs from what React expects on the client. Common causes: `Date.now()`, `Math.random()`, browser-only APIs (`window`, `localStorage`), conditional rendering based on client state. Fix by deferring client-only values to `useEffect` or using `suppressHydrationWarning` for intentional mismatches (like timestamps).

### Streaming and Partial Rendering

**Q: How does streaming SSR differ from traditional SSR?**
Traditional SSR blocks until ALL data is fetched and ALL components are rendered, then sends the complete HTML. Streaming SSR sends the shell immediately and streams in content as each piece becomes ready. Implemented via React 18 Suspense boundaries — each boundary streams independently, so a slow database query doesn't block the entire page.

**Q: What are React Server Components and what problem do they solve?**
RSC separates components into Server Components (run only on server, zero JS shipped) and Client Components (run on both, JS shipped for hydration). They solve the bundle size and hydration cost problem: most of a page is static content that doesn't need interactivity. RSC sends only the JS for interactive parts, reducing bundle size and hydration scope.

**Q: Does `'use client'` mean a component only runs on the client?**
No. `'use client'` marks the hydration boundary. Client Components still render on the server during SSR to produce HTML. They ALSO run on the client during hydration. The directive means "this component and its children need JS shipped to the browser for interactivity."

### Trade-offs and Architecture

**Q: SSR improves performance. Do you agree?**
Partially. SSR improves perceived performance — users see content faster (better FCP). But total work is higher: the server renders + the client hydrates, whereas CSR only renders once on the client. SSR adds server cost, latency (TTFB), hydration delay (TTI), and complexity. The right framing is: SSR trades server cost and complexity for faster first paint.

**Q: You're building an e-commerce site. What rendering strategy?**
Product listing pages: SSG with ISR (content changes hourly, CDN-fast, SEO-critical). Product detail pages: SSG with ISR for static content, Client Components for add-to-cart, reviews. Cart and checkout: CSR or dynamic SSR (personalized, behind auth). Search results: streaming SSR (dynamic, SEO-relevant, multiple data sources at different speeds). The answer is almost never "one strategy for the whole site."

**Q: How do you decide where to put `'use client'` boundaries?**
Push `'use client'` as far down the tree as possible. Only mark the leaf components that need interactivity (buttons, forms, state). Keep data fetching, layout, and static content as Server Components. The boundary determines what JS ships to the browser — a `'use client'` at the top means the entire subtree hydrates.

**Q: What matters more — knowing the implementation details of each strategy, or understanding the trade-offs?**
Trade-offs. Implementations change (Pages Router to App Router, new React features), but the fundamental trade-offs are constant: server cost vs client cost, freshness vs speed, complexity vs simplicity, bundle size vs interactivity. A staff engineer who understands trade-offs can evaluate any new rendering strategy. One who only knows implementation details is stuck when the API changes.
