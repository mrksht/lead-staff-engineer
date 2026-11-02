# System Design Exercises

These are interview-realistic prompts, not textbook descriptions — real
system design rounds hand you one or two deliberately underspecified
sentences and watch what you ask next, not whether you've memorized a
reference architecture. For each exercise: read only **The Prompt**, then
spend 20–30 minutes on paper or a whiteboard designing it yourself, using
**Clarifying Questions to Ask** as your own checklist before you let
yourself commit to an approach. Only after you've committed should you read
the **Reference Design** sections — diffing your approach against a
reference is where the actual learning happens, the same way the DSA
files in this repo make you fail a stub before showing the solution. Pay
the most attention to **Where Staff-Level Answers Diverge From
Senior-Level Ones** in each exercise — that section names the actual
signal being evaluated at this level, not whether you can draw boxes and
arrows correctly.

## Table of Contents

- [Exercise 1: Design a URL Shortener](#exercise-1-design-a-url-shortener)
- [Exercise 2: Design a Rate Limiter / API Gateway](#exercise-2-design-a-rate-limiter--api-gateway)
- [Exercise 3: Design a News Feed / Social Timeline](#exercise-3-design-a-news-feed--social-timeline)
- [Exercise 4: Design a Real-Time Chat / Notification System](#exercise-4-design-a-real-time-chat--notification-system)

---

## Exercise 1: Design a URL Shortener

### The Prompt

"Design a URL shortener like bit.ly. A user submits a long URL and gets
back a short one; visiting the short URL redirects to the original."

### Clarifying Questions to Ask

- Do short URLs expire by default, or live forever unless explicitly
  deleted?
- Can a user request a custom alias (`short.ly/my-brand`), or is the short
  code always system-generated?
- If two users submit the identical long URL, do they get the same short
  code (dedup) or independent ones? (Dedup saves storage but adds a lookup
  on every write and complicates per-user analytics/ownership.)
- Do we need per-URL click analytics (count, referrer, geo, timestamp), or
  is a bare redirect the only requirement?
- Is there an authenticated owner per URL — a dashboard to view, edit, or
  delete — or is creation anonymous and public?
- Do we need to support custom/branded domains for enterprise customers
  (`go.acme.com/xyz` instead of our own domain)?
- Redirect type: 301 (permanent — browsers and CDNs cache it, so we lose
  the ability to count repeat visits or change the destination later) or
  302 (temporary — always hits our servers, costs more but keeps us in the
  loop)? This is a real, binding tradeoff, not a formality.
- What's the expected write volume (new URLs/day) and the read:write ratio?
- What's the latency budget for the redirect path specifically — this is
  the one user-facing path that must never visibly lag?
- Is it acceptable for a URL to be briefly unreadable immediately after
  creation (eventual consistency across replicas), or must it be
  immediately resolvable everywhere, including the datacenter the writer
  didn't write to?
- What's the availability target for the redirect path? (This is usually
  the most business-critical path in the whole system — a dead short link
  embedded in a marketing campaign or a printed flyer cannot be quietly
  down.)

### Back-of-Envelope Estimation

**Assumptions (stated explicitly):** 100M new URLs created per year,
read:write ratio of 100:1, 5-year data retention.

**Write QPS**
```
100,000,000 writes/year ÷ 365 days        ≈ 273,973 writes/day
273,973 writes/day ÷ 86,400 sec/day       ≈ 3.2 writes/sec (average)
peak (assume 3x average for traffic skew) ≈ 9.5 → ~10 QPS peak writes
```

**Read QPS**
```
273,973 writes/day × 100 (read:write ratio) ≈ 27,397,300 reads/day
27,397,300 ÷ 86,400 sec/day                 ≈ 317 reads/sec (average)
peak (3x average)                            ≈ 950 → ~1,000 QPS peak reads
```

**Storage**
```
Total URLs over 5-year retention: 100M/year × 5 years = 500,000,000 URLs
Row size (short_code + long_url + metadata + index overhead) ≈ 500 bytes
500,000,000 × 500 bytes = 250,000,000,000 bytes = 250 GB raw
With a replication factor of 3 (for availability): ~750 GB actual disk footprint
```
250 GB–750 GB is trivially small for a modern database tier — the takeaway
to say out loud in the interview is that **this system is never
storage-bound**; it's bound by read QPS and p99 latency on the hot path.

**Short code space**
```
Base62 alphabet (a-z, A-Z, 0-9), 7 characters:
62^7 ≈ 3.52 × 10^12 ≈ 3.52 trillion possible codes
```
500M codes against 3.52 trillion possible leaves enormous headroom (a
collision probability low enough to ignore even with random generation,
though a counter-based or pre-allocated-range scheme avoids the question
entirely — see the Deep Dive). Even 6 characters (62^6 ≈ 56.8 billion)
would cover a decade of 10x growth; 7 is chosen for safety margin and to
leave room for custom aliases to collide against.

**Cache sizing**
```
Assume 24h-active URLs dominate reads (recency-skewed access pattern)
If ~5M distinct URLs are actively read in any given day:
5,000,000 × 500 bytes ≈ 2.5 GB
```
A single Redis node (even a modest one) holds the entire hot working set
with room to spare — expect a 90%+ cache hit ratio, meaning the database
rarely sees read traffic at all.

**Bandwidth**
```
Redirect response: empty body, just a Location header ≈ 200 bytes
1,000 QPS peak × 200 bytes ≈ 200,000 bytes/sec = 200 KB/s ≈ 1.6 Mbps
```
Negligible. This system is never bandwidth-bound either — it's a
connection-handling and cache-latency problem at the scale assumed here.

### High-Level Architecture

```
┌────────────────────────────────────────────┐
│ Client                                     │
└────────────────────────────────────────────┘
                       │  HTTPS
                       ▼
┌────────────────────────────────────────────┐
│ Load Balancer (L7)                         │
│ round robin across app tier                │
└────────────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────┐
│ App Tier (stateless)                       │
│ shorten() + redirect(), N instances        │
└────────────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────┐
│ Cache (Redis)                              │
│ short_code -> long_url, TTL ~ 24h          │
└────────────────────────────────────────────┘
                       │  cache miss
                       ▼
┌────────────────────────────────────────────┐
│ Database (sharded)                         │
│ url_mappings, sharded by hash(short_code)  │
└────────────────────────────────────────────┘

Off the hot (redirect) path — called by App Tier during shorten():
┌────────────────────────────────────────────┐
│ Key Generation Service                     │
│ pre-allocated base62 ranges,               │
│ checked out per app node                   │
└────────────────────────────────────────────┘
```

### Deep Dive: API Design

```
POST /api/v1/urls
Request:
{
  "long_url": "https://example.com/some/very/long/path?q=1",
  "custom_alias": "my-brand",      // optional
  "expires_at": "2027-01-01T00:00:00Z"  // optional, null = never
}
Response (201 Created):
{
  "short_url": "https://short.ly/aZ3kQ9",
  "long_url": "https://example.com/some/very/long/path?q=1",
  "created_at": "2026-11-02T10:00:00Z",
  "expires_at": null
}
Response (409 Conflict — custom_alias already taken):
{ "error": "alias_taken", "message": "my-brand is already in use" }

GET /{short_code}
Response: 301 or 302, Location: <long_url>
Response (404 Not Found — unknown or expired code):
{ "error": "not_found" }

GET /api/v1/urls/{short_code}/stats     (authenticated, owner only)
Response:
{ "short_code": "aZ3kQ9", "click_count": 4821, "created_at": "...", "last_clicked_at": "..." }
```
The redirect endpoint (`GET /{short_code}`) is deliberately unversioned and
has no `/api/` prefix — it needs to be the shortest possible URL since
length is the entire point of the product. Everything else lives behind a
versioned API namespace, which is the part that will actually evolve.

### Deep Dive: Database Indexing

The only query on the hot path is a point lookup: `SELECT long_url FROM
url_mappings WHERE short_code = ?`. This needs exactly one index: a
**primary key (or unique index) on `short_code`** — nothing else matters
for the redirect path, and over-indexing a write-light, read-heavy table
only costs write amplification for no benefit here.

```
url_mappings
  short_code   VARCHAR(7)  PRIMARY KEY   -- clustered index, O(log n) lookup
  long_url     TEXT
  owner_id     BIGINT      INDEX          -- only needed for the dashboard's
                                           -- "list my URLs" query — secondary,
                                           -- not on the redirect hot path
  created_at   TIMESTAMP
  expires_at   TIMESTAMP   NULL
  click_count  BIGINT      DEFAULT 0      -- see note below
```
Sharding strategy: shard by `hash(short_code) % num_shards`. Because
`short_code` is generated by us (not user-chosen in the common case), we
control the key distribution and can guarantee even spread across shards —
this avoids the classic hot-shard problem that plagues systems sharding on
naturally skewed keys (like user_id, where some users are far more active
than others).

`click_count` deserves a second look: incrementing it on every redirect
turns a pure-read hot path into a write on every request, directly
undermining the cache strategy (a cached redirect never touches the DB, so
a naive `UPDATE ... SET click_count = click_count + 1` either has to
happen out-of-band or defeats the cache). The fix: emit a lightweight
"click" event to a queue or an async counter (Redis `INCR` on a separate
key, flushed to the DB periodically) instead of updating the row
synchronously on the request path.

### Deep Dive: Caching Strategy

- **Cache key:** `short_code` directly (e.g., `url:aZ3kQ9`), value is the
  `long_url` string (or a small JSON blob if `expires_at` needs to be
  checked without a DB round trip).
- **TTL:** 24 hours, refreshed on every read (sliding expiration) — this
  naturally keeps actively-used URLs resident and lets cold ones fall out
  without any explicit eviction logic.
- **Population:** cache-aside (lazy load). On a miss, the app server reads
  the DB, writes the result into cache, then returns — the simplest
  correct pattern for a read-heavy, write-light workload, and it means a
  cache outage degrades to "slower" (DB-backed) rather than "broken."
- **Invalidation:** the only mutation path is delete (owner removes a
  URL) or an expiration being hit. On delete, explicitly `DEL` the cache
  key in the same transaction/request as the DB delete — don't rely on TTL
  alone, since a 24h stale window on a deleted URL means it keeps
  "working" for up to a day after the owner removed it, which is a
  correctness bug, not just a staleness inconvenience.
- **Eviction policy:** LRU at the Redis level as a backstop (in case the
  working set grows larger than provisioned memory) — but per the
  back-of-envelope math above, the actual working set comfortably fits in
  memory, so LRU eviction should rarely, if ever, actually fire in steady
  state. If it's firing regularly, that's a signal the cache node is
  undersized relative to real traffic, not a sign the architecture is
  wrong.

### Tradeoffs & Alternatives Considered

- **Hash the long URL to derive the short code (MD5/base62-encode) instead
  of a counter/range allocator.** Rejected: hashing a URL to a fixed-length
  code and truncating it to 7 characters reintroduces exactly the
  collision problem a counter-based scheme avoids for free, and "retry
  with a different hash seed on collision" adds latency variance to the
  one path (write) that doesn't need to be fast, in exchange for avoiding
  a small, boring key-generation service.
- **301 redirects everywhere, for the cacheability win.** Rejected as the
  default: 301s get cached by browsers and intermediate CDNs, which means
  we permanently lose visibility into repeat clicks on a given link and
  can't change the destination after the fact (useful for, e.g., a
  marketing link that needs to point somewhere new post-launch). 302 costs
  us a server hit on every single click, but that's exactly the
  back-of-envelope number above (~1,000 QPS peak) — a load our cache layer
  handles easily. If click analytics or post-creation editability aren't
  requirements, 301 is the better default.
- **Strongly consistent reads (read from the leader DB, no caching) to
  avoid any staleness window at all.** Rejected: the redirect path doesn't
  need strict consistency — a few seconds of staleness on a just-created
  URL is an acceptable tradeoff for the latency and throughput headroom a
  cache buys, and it's the overwhelmingly common pattern for this problem
  shape (read-heavy, tolerant of brief staleness, latency-sensitive).

### Where Staff-Level Answers Diverge From Senior-Level Ones

A senior engineer's design for this problem is usually functionally
correct: LB, stateless app tier, cache, sharded DB, some key-generation
scheme. What that design is missing, and what a staff-level answer adds
without being prompted, is **what happens when the key-generation service
itself fails or runs out of pre-allocated range**, and **what the
operational story looks like at 10x the assumed scale** — these are the
questions that actually come up in production, not in a whiteboard demo.
If the key-generation service is a single point of failure (one counter,
one node), every write in the entire system halts the moment it's
unreachable, even though reads (the overwhelming majority of traffic)
would be completely unaffected. The staff-level fix — pre-allocating
*ranges* of keys to each app server instead of requesting one key per
write — isn't just a performance optimization; it's what turns a
single-point-of-failure dependency on the write path into something that
degrades gracefully (an app server with an exhausted range just needs to
fetch a new one, occasionally, not on every request).

The second divergence is in schema evolution. A senior answer treats the
schema as fixed once drawn. A staff answer anticipates that `url_mappings`
will eventually need a migration — adding a column, changing an index,
splitting a table — on a table that has grown to hundreds of millions of
rows and is under continuous production write traffic. The real answer
involves online schema change tooling (e.g., `gh-ost`, `pt-online-schema-
change`, or a managed equivalent), shipped as an explicit, separate
migration plan with a rollback story, never a blocking `ALTER TABLE` run
directly against a live table at this scale. Naming this unprompted, and
being able to explain *why* a naive migration would cause an outage (table
locks, replication lag cascading to read replicas), is a strong staff
signal.

The third divergence is cost and ownership. At 100M URLs/year this system
is cheap to run; the staff-level answer notices that the actual cost
driver as this scales isn't compute or the database — it's the *redirect*
path's availability requirement. A marketing team embeds these links in a
Super Bowl ad; the system cannot be down for even a few minutes during
that window. That reframes the design conversation: which team owns the
on-call rotation for the redirect path specifically (it may deserve
tighter SLOs and separate deployment cadence than the "create URL"
dashboard API), and what the blast radius of a bad deploy to the app tier
looks like if it's not decoupled from the lower-stakes analytics/dashboard
code path.

### Staff-Level Follow-Up

**"A single short URL gets embedded in a Super Bowl ad and needs to handle
500,000 redirect requests in the first 30 seconds after it airs — what
breaks, and how do you prepare for it?"** The architecture above already
tolerates this reasonably well *if* the cache layer is warm, because a
single hot key getting 500K reads in 30 seconds (~16,667 QPS on one key)
is exactly the workload Redis is built for — the real risk isn't the
cache, it's a cold cache combined with connection-level limits: the first
request after the ad airs is a cache miss, and if the LB/app tier doesn't
have enough capacity to absorb a instantaneous spike (versus the steady
~1,000 QPS baseline this system was sized for), you get a thundering herd
of near-simultaneous cache-fill attempts against the DB for the same row.
The fix is twofold: (1) know in advance which links are about to go viral
and pre-warm the cache (if the marketing team tells infra ahead of time —
often they do, for exactly this reason), and (2) implement request
coalescing/single-flight on cache miss so that N simultaneous misses for
the same key result in exactly one DB query and N requests waiting on that
one result, not N redundant queries hammering the same row at once. Without
coalescing, a single hot key under cold-cache conditions can produce a
self-inflicted DB overload that looks identical to a DDoS.

---

## Exercise 2: Design a Rate Limiter / API Gateway

### The Prompt

"Design a rate limiter for a public API platform. Each API client should
be limited to a certain number of requests per time window, and requests
over the limit should be rejected."

### Clarifying Questions to Ask

- Is the limit per API key, per user, per IP, or some combination (e.g.,
  per key *and* a stricter per-IP limit to blunt key-sharing abuse)?
- Fixed window, sliding window, or token bucket — does the business care
  about allowing short bursts above the nominal rate, or is a hard,
  smooth cap required?
- Do different tiers of customer get different limits (free vs. paid), and
  can a customer's limit change at runtime without a redeploy?
- What should happen to a rejected request — a `429` with a `Retry-After`
  header, silent drop, or queued for later? (Silent drop is almost always
  wrong for an API product — clients need to know *why* they're being
  throttled.)
- Is the limiter enforced at a single global gateway, or does it need to
  work correctly across multiple geographically distributed gateway
  clusters that don't share a single data store with low latency between
  them?
- What's the acceptable error margin on the limit itself — is "slightly
  over the limit under race conditions" tolerable (eventually consistent
  counting), or must the limit be enforced with hard precision (e.g.,
  billing-adjacent, where overcounting costs the business money)?
- What's the expected aggregate peak QPS across all tenants, and how many
  distinct API keys/tenants are active at once?
- What's the added latency budget for the rate-limiting check itself —
  this sits on literally every request, so even a few extra milliseconds
  multiplies across the entire platform's p99.
- Does the gateway also need to do anything beyond rate limiting — auth,
  request routing/versioning, response caching — that affects how tightly
  coupled the rate limiter should be to the rest of the gateway?
- What happens to in-flight rate-limit state if the backing store (Redis,
  etc.) becomes briefly unavailable — fail open (allow everything,
  protecting availability) or fail closed (reject everything, protecting
  backend services from an unbounded flood)?

### Back-of-Envelope Estimation

**Assumptions (stated explicitly):** a platform with 10,000 active API
keys, aggregate peak traffic of 50,000 requests/second across all tenants,
and a per-key default limit of 100 requests/minute (burstable).

**Gateway node capacity**
```
Assume one gateway node (proxy + auth + rate-limit check) sustains
~8,000 RPS realistically (a simple Go/Node reverse proxy doing a Redis
round trip per request, not raw static-file serving numbers)
50,000 RPS peak ÷ 8,000 RPS/node ≈ 6.25 → 7 nodes at exactly peak load
Add 50% headroom for node failure / traffic spikes ≈ 10–11 nodes
```

**Rate-limit store load**
```
Each request needs at minimum 1 read + 1 increment against the counter
store (or a single atomic Lua script doing both in one round trip):
50,000 RPS × 1 round trip/request = 50,000 ops/sec against Redis
```
A single well-provisioned Redis instance handles hundreds of thousands of
simple ops/sec, so 50K ops/sec is comfortably within a single primary's
budget — the real driver for sharding the rate-limit store isn't raw
throughput, it's **availability and blast radius** (see Deep Dive).

**Active counter memory footprint**
```
Assume 1,000,000 distinct keys could be "active" (mid-window) at any
instant across all tenants (generous upper bound — far more than the
10,000 actual API keys, to account for per-IP sub-limits too)
Each counter entry (key hash + count + window timestamp) ≈ 50 bytes
1,000,000 × 50 bytes = 50,000,000 bytes = 50 MB
```
Trivial — the rate limiter's state is never memory-bound; this reinforces
that the system is bound by **per-request latency** and **availability of
the store under load**, not by storage capacity.

**Latency budget**
```
Target: rate-limit check adds < 5ms at p99 to every request.
A single Redis round trip (same datacenter/AZ) typically costs ~0.5–2ms;
the budget leaves headroom for network jitter and Lua script execution,
but not for a cross-region round trip — this is why co-location of the
gateway and its rate-limit store matters more here than almost anywhere
else in the stack.
```

### High-Level Architecture

```
┌────────────────────────────────────────────────┐
│ Client (SDK / HTTP)                            │
└────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────┐
│ API Gateway / LB tier                          │
│ N stateless gateway nodes, least-conn          │
└────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────┐
│ Rate Limiter Middleware                        │
│ token bucket check, runs on gateway node       │
└────────────────────────────────────────────────┘
                         │  allow/deny decision
                         ▼
┌────────────────────────────────────────────────┐
│ Rate Limit Store (Redis, sharded)              │
│ key: api_key:window -> token count, ts         │
└────────────────────────────────────────────────┘
                         │  allowed only
                         ▼
┌────────────────────────────────────────────────┐
│ Backend Service Pool                           │
│ routed by consistent hashing on tenant_id      │
└────────────────────────────────────────────────┘
```

### Deep Dive: Load Balancing Algorithm Choice

Two separate load-balancing decisions exist in this system, and they need
different algorithms because they're solving different problems:

**Client → Gateway tier:** use **least-connections**, not round robin.
Round robin assumes every request costs the same amount of work, which is
false here — a rate-limit check that hits a cache miss or a slow Lua
script holds a connection open longer than a fast-path allow. Least-
connections naturally routes new requests away from a node that's
currently backed up, which round robin cannot do (round robin will happily
keep sending traffic to a node that's falling behind, since it has no
notion of current load, only a rotating pointer).

**Gateway → Backend Service Pool:** use **consistent hashing on
`tenant_id`**, not least-connections. The goal here is different: it's not
about even load distribution per request, it's about **routing stability**
— if a backend service maintains any per-tenant cache or connection pool,
consistent hashing ensures the same tenant's requests keep landing on the
same backend node (or a small, predictable set of nodes) across requests,
maximizing cache hit rates on that backend. Least-connections would
constantly reshuffle which backend a tenant's traffic lands on based on
momentary load, destroying any per-tenant locality the backend tries to
exploit. The real cost of consistent hashing — some unevenness in load
distribution if a few tenants are disproportionately heavy — is accepted
here because the locality win outweighs it; if one tenant is large enough
to cause real imbalance, that's a signal to isolate them onto dedicated
capacity rather than fight the hashing algorithm.

### Deep Dive: Caching Strategy (the Rate-Limit Store Itself)

The rate-limit store *is* the cache in this system — there's no separate
origin database being fronted. The design questions are about the
counter's own structure and failure behavior:

- **Key structure:** `ratelimit:{api_key}:{window_start_timestamp}` for a
  fixed-window counter, or a sorted set keyed by `ratelimit:{api_key}`
  with timestamps as scores for a true sliding-window log. The former is
  cheaper (`O(1)` per check, one `INCR` + `EXPIRE`) but allows a burst of
  up to 2x the limit right at a window boundary (a client sends its full
  limit at `11:59:59` and again at `12:00:01` — two windows, double the
  effective rate for that instant). The latter (sliding window log, or the
  sliding-window-counter approximation) closes that gap at the cost of
  more memory per key and a slightly more expensive check (a Redis
  `ZREMRANGEBYSCORE` + `ZCARD` instead of a single `INCR`).
- **TTL:** set to the window length (e.g., 60 seconds for a per-minute
  limit) via `EXPIRE`, so stale counters self-clean without any explicit
  sweep job — a counter for a key that stops sending traffic simply
  evaporates on its own.
- **Invalidation:** there isn't really an invalidation concept here (no
  stale-data problem) — the closest analog is a tenant's limit *changing*
  (upgrading tiers), which should be read fresh on every check from a
  small, separately-cached tenant-config lookup (`limit:{api_key} ->
  {requests_per_window}`), not baked into the counter's own logic, so a
  tier upgrade takes effect on the very next request rather than waiting
  for the current window to expire.
- **Failure mode — fail open vs. fail closed:** if the Redis store is
  unreachable, the gateway must pick a default. Fail open (allow the
  request through) protects availability for legitimate traffic but
  removes all protection for backend services during exactly the window
  when infrastructure is already degraded — arguably the worst time to
  lose the safety net. Fail closed protects backends but turns a
  rate-limiter outage into a total platform outage. The staff-level
  default is a **local, in-memory fallback limiter** on each gateway node
  (a coarser, per-node approximation of the global limit) that kicks in
  only during a Redis outage — imperfect accuracy, but far better than
  either extreme.

### Deep Dive: API Design

```
Every proxied response includes rate-limit headers, regardless of outcome:

Allowed request (200/passthrough):
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 37
  X-RateLimit-Reset: 1730563200   (unix timestamp, window reset time)

Rejected request:
HTTP/1.1 429 Too Many Requests
Retry-After: 23
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1730563200
Body:
{ "error": "rate_limit_exceeded", "retry_after_seconds": 23 }
```
Admin/config API for managing limits (separate from the hot path):
```
PUT /admin/v1/tenants/{tenant_id}/rate-limit
Request: { "requests_per_window": 500, "window_seconds": 60 }
Response (200): { "tenant_id": "...", "requests_per_window": 500, "window_seconds": 60, "updated_at": "..." }
```
Exposing the limit/remaining/reset headers on *every* response (not just
rejections) is deliberate — it lets well-behaved clients self-throttle
proactively instead of discovering the limit only by hitting a `429`,
which materially reduces the rejected-request volume the gateway has to
handle in the first place.

### Tradeoffs & Alternatives Considered

- **Enforce limits entirely client-side (SDK-level throttling) instead of
  server-side.** Rejected as the sole mechanism: client-side throttling is
  trivially bypassable (a misbehaving or malicious client just doesn't use
  the SDK) and provides zero actual protection for backend services — it's
  useful as a *courtesy* layer to reduce unnecessary rejected requests, but
  can never replace server-side enforcement.
- **A single centralized rate-limiter service that every gateway node
  calls over the network, instead of each gateway node embedding the
  rate-limit check as middleware talking directly to Redis.** Considered
  for the cleaner separation of concerns, rejected for this scale: it adds
  an extra network hop (and therefore latency) to every single request for
  a check that's cheap enough to do inline, and introduces a new service
  that itself needs to be highly available. It becomes the right call at a
  much larger scale, or when rate-limiting logic needs to be shared across
  genuinely heterogeneous gateway implementations that can't all embed the
  same middleware.
- **Fixed window counters everywhere, accepting the boundary-burst
  problem, for simplicity.** Rejected as the universal default: acceptable
  for generous, abuse-prevention-style limits where a brief 2x burst at a
  window boundary is immaterial, but wrong for any limit tied to billing
  or to protecting a backend with a hard capacity ceiling — those get the
  sliding-window log or token-bucket treatment instead. The point is that
  the algorithm choice isn't universal across the platform; different
  limits serving different purposes justify different precision/cost
  tradeoffs.

### Where Staff-Level Answers Diverge From Senior-Level Ones

A senior engineer's answer correctly identifies token bucket or sliding
window as the algorithm, puts a counter in Redis, and wires it into
gateway middleware — that's a working rate limiter. A staff-level answer
spends real time on the **fail-open/fail-closed decision** and treats it
as a first-class design choice rather than an afterthought, because this
is precisely the kind of decision that gets made badly under pressure
during an actual incident if it wasn't thought through in advance. It also
asks who gets to decide the fail-open/fail-closed tradeoff — is it a
platform-wide default, or does it vary by tenant tier (a paying enterprise
customer's traffic might warrant fail-open during a Redis blip, while
free-tier traffic fails closed to protect capacity for paying customers)?
That's a product and business decision disguised as an infrastructure
one, and naming that explicitly is a staff-level move.

The second divergence shows up in how the design handles the rate-limit
store's own scaling and failure domain. A senior design treats "put it in
Redis" as the end of the conversation. A staff design asks: is this one
Redis cluster a single point of failure for the *entire platform's*
traffic-shaping, and if that cluster degrades, does every gateway node
simultaneously fall back to its local approximation at the same moment,
potentially causing a coordinated spike in backend load right when the
infrastructure is already stressed? The staff answer also considers
sharding the rate-limit store itself (by tenant_id hash, mirroring the
gateway-to-backend routing) specifically to contain the blast radius of a
single shard's failure to a subset of tenants rather than the whole
platform — this is the same "limit the blast radius of a bad node" thinking
that should show up across every system in this file, but it's especially
sharp here because the rate limiter's entire job is protecting availability,
so a rate limiter that itself becomes the single point of failure is a
design failure in exactly the dimension it was built to prevent.

The third divergence is operational: how do you change a tenant's limit
without a deploy, and how do you verify a limit change actually took
effect for a high-value customer who's complaining right now? A senior
design often hardcodes limits in config files requiring a redeploy. A
staff design treats limits as live, dynamic data (the tenant-config lookup
mentioned in the caching deep dive above) with an audit trail — who
changed what limit, when, and why — because "we changed your rate limit"
is a support-and-billing-adjacent action that needs the same traceability
as any other account-level change, not just an engineering config tweak.

### Staff-Level Follow-Up

**"One tenant's traffic spikes to 10x their normal volume, all rejected
with 429s as designed — but their legitimate retry logic, combined with
every rejected request still costing a Redis round trip, is now consuming
as much gateway capacity as if the requests had been allowed. How do you
stop a rate-limited client from becoming a denial-of-service vector against
your own gateway?"** This is the detail a correct-but-shallow design
misses: rejecting a request isn't free just because the backend never sees
it — the gateway and the rate-limit store still pay the cost of *deciding*
to reject it, every single time. The fix has two layers. First, once a
client has been rejected, cache that "currently over limit" state somewhere
cheaper than the full counter check — a short-lived, in-memory (per
gateway node) flag keyed by `api_key` that says "skip the Redis round trip
entirely, this key is known-over-limit until at least timestamp X,"
checked before the real rate-limit logic runs at all. Second, and more
aggressively, if a specific key's rejection rate crosses some threshold
(e.g., 95% of its requests are being rejected over a rolling window),
escalate it to a cheaper, coarser circuit-breaker state — reject
immediately at the edge (even before the connection is fully processed)
rather than running the full middleware pipeline — and emit an alert, since
a client retrying at 10x its allotted rate with no backoff is very likely
a bug in that client's retry logic (missing exponential backoff and jitter)
rather than legitimate demand, and is worth a direct conversation with that
customer's integration team rather than just quietly absorbing the load.

---

## Exercise 3: Design a News Feed / Social Timeline

### The Prompt

"Design the news feed for a social media app — when a user opens the app,
they see a feed of recent posts from people they follow."

### Clarifying Questions to Ask

- Is the feed strictly reverse-chronological, or ranked (engagement-
  predicted ordering)? Ranking implies a whole scoring/ML pipeline; pure
  chronological is a much simpler data problem — which one is actually in
  scope for this conversation?
- What's the follower distribution — is this closer to Twitter (where some
  accounts have tens of millions of followers) or a smaller, more
  symmetric social graph (closer to a mutual-friends model)? This single
  answer determines whether celebrity fan-out is a core design concern or
  an edge case.
- Does the feed need to support real-time updates (new posts appearing
  without a manual refresh), or is "fresh on next load" acceptable?
- What content types are in a post — text only, or text + images/video
  that need separate storage and delivery (CDN) treatment?
- How far back does the feed need to paginate — can a user scroll back
  indefinitely, or is there a practical window (e.g., last 30 days) after
  which older content isn't part of the "feed" experience anymore?
- Can a user edit or delete a post after publishing, and if so, how
  quickly must that change propagate to every follower's already-generated
  timeline?
- Is eventual consistency acceptable for feed freshness (a new post can
  take a few seconds to appear for all followers), or does the business
  require near-real-time propagation?
- What's the DAU, average posts created per active user per day, and
  average followers per user — the numbers that actually drive fan-out
  cost?
- How many times per day does an average user open/refresh their feed —
  this sets the read QPS, which is almost always the dominant cost driver
  in this system, not writes.
- Does "read receipts" / "seen" state matter (does the feed need to track
  what a user has already scrolled past so it doesn't resurface), or is
  that out of scope?

### Back-of-Envelope Estimation

**Assumptions (stated explicitly):** 500M daily active users (DAU), 10%
of DAU post at least once per day (50M posters/day) averaging 2 posts
each, average 200 followers per user, and each active user opens/refreshes
their feed an average of 20 times/day.

**Post write volume**
```
50,000,000 posters/day × 2 posts/poster ≈ 100,000,000 posts/day
100,000,000 ÷ 86,400 sec/day ≈ 1,157 posts/sec (average)
peak (3x average)             ≈ 3,472 → ~3,500 QPS peak post creation
```

**Feed read volume**
```
500,000,000 DAU × 20 opens/day ≈ 10,000,000,000 feed reads/day (10B/day)
10,000,000,000 ÷ 86,400 sec/day ≈ 115,741 reads/sec (average)
peak (3x average)                ≈ 347,222 → ~350,000 QPS peak feed reads
```
This is the number that should jump out immediately: feed reads outpace
post writes by roughly **100x** at peak. Any design that treats reads and
writes as symmetric problems is already off track — this system lives or
dies on how cheap a feed *read* can be made, not on how the write path
works.

**Fan-out write volume (push model: write to every follower's timeline on
every post)**
```
100,000,000 posts/day × 200 avg followers/post ≈ 20,000,000,000 fan-out writes/day (20B/day)
20,000,000,000 ÷ 86,400 sec/day ≈ 231,481 writes/sec (average)
peak (3x average)                 ≈ 694,444 → ~700,000 QPS peak fan-out writes
```
This number is the entire reason a pure push (fan-out-on-write) model
doesn't survive contact with a real social graph: a single post from an
account with a few million followers (not even an extreme outlier for a
platform this size) would, on its own, generate millions of individual
timeline-cache writes in the seconds after it's published — a write
amplification spike that dwarfs the steady-state average above. This is
exactly what the hybrid fan-out approach in the Deep Dive section exists
to solve.

**Storage**
```
Post metadata: 100,000,000 posts/day × ~1 KB/post (text + metadata, no media)
  = 100 GB/day of metadata ≈ 36.5 TB/year
Media (assume 50% of posts include an image averaging 200 KB):
  50,000,000 posts/day × 200 KB ≈ 10 TB/day of media ingest ≈ 3.65 PB/year
```
Media dominates storage by roughly two orders of magnitude over text
metadata — this is why media is never stored in the same database as post
metadata; it goes to blob storage (S3-equivalent) fronted by a CDN, and the
post-metadata row only ever holds a pointer (URL) to it.

### High-Level Architecture

```
┌────────────────────────────────────────────────┐
│ Client (mobile / web)                          │
└────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────┐
│ CDN / Edge Cache                               │
│ serves media assets + cached public timelines  │
└────────────────────────────────────────────────┘
                         │  cache miss / API calls
                         ▼
┌────────────────────────────────────────────────┐
│ Load Balancer                                  │
│ round robin across app tier                    │
└────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────┐
│ App Tier                                       │
│ PostService (write) / FeedService (read)       │
└────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────┐
│ Fan-out Queue (Kafka)                          │
│ post_id, author_id -> fan-out workers          │
└────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────┐
│ Fan-out Workers                                │
│ push post_id into each follower timeline       │
└────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────┐
│ Timeline Cache (Redis)                         │
│ user_id -> sorted set of recent post_ids       │
└────────────────────────────────────────────────┘
                         │  cold / celebrity reads
                         ▼
┌────────────────────────────────────────────────┐
│ Post Store + Social Graph DB                   │
│ posts (NoSQL), follows (graph/NoSQL)           │
└────────────────────────────────────────────────┘
```

### Deep Dive: SQL vs. NoSQL Choice + Justification

Two genuinely different data shapes live in this system, and they justify
different storage choices rather than forcing one database to do both
jobs:

**Posts table → NoSQL (e.g., Cassandra/DynamoDB-style wide-column
store), not relational.** Posts are write-heavy, accessed almost
exclusively by `post_id` or by `author_id` (list a user's own posts), have
no need for cross-post joins, and need to scale horizontally to the
billions-of-rows range implied by the storage math above. A wide-column
store partitioned by `author_id` (or `post_id`) gives linear horizontal
scalability with simple, predictable access patterns, and sidesteps the
operational pain of resharding a relational database once a single table
crosses the scale where vertical scaling or manual sharding become
necessary. The justification isn't "NoSQL is for scale" as a slogan — it's
that this specific access pattern (point lookups and simple range scans by
a known partition key, no joins) is exactly what wide-column stores are
built for, and the relational features being given up (joins, multi-row
transactions across arbitrary tables) were never going to be used here
anyway.

**Social graph (follows) → also NoSQL, but a graph-oriented or adjacency-
list model, not the same store as posts.** The query that matters is "give
me the list of `author_id`s this `user_id` follows" (for fan-out) and "give
me the list of followers for this `author_id`" (for the reverse, used when
deciding push vs. pull per the hybrid strategy below). Both are adjacency-
list lookups by a single key — a dedicated graph database (Neo4j-style) is
one valid choice if the product later needs genuinely graph-shaped queries
(mutual friends, "people you may know" via 2-hop traversal), but for *this*
specific problem (direct follow/follower lookups only), a simple
wide-column table keyed by `user_id` with follower/following IDs as a
column/set is sufficient and avoids introducing a second, operationally
distinct database technology before the product actually needs graph
traversal queries.

**Why not SQL for either:** a relational database would work correctly
here too — this isn't a case where SQL is incapable — but it would require
either a single enormous table (fighting vertical scaling limits well
before the billions-of-rows mark) or manual application-level sharding
that NoSQL stores provide natively. The deciding factor is operational:
once you're sharding a relational database by hand to handle this volume,
you've reimplemented a worse version of what a purpose-built distributed
NoSQL store already does, for an access pattern (point lookups, no joins,
no multi-row ACID requirements) that never needed the relational model's
guarantees in the first place.

### Deep Dive: Caching Strategy (Hybrid Fan-Out)

This is the single most important design decision in the whole system, and
it's a caching/materialization strategy, not just a "put Redis in front of
the DB" afterthought:

- **Push (fan-out-on-write) for normal accounts:** when a user with a
  typical follower count (the ~200 average from the estimation) posts, a
  background worker writes that `post_id` directly into every follower's
  **precomputed timeline cache** (a Redis sorted set per user, scored by
  post timestamp, capped at the most recent ~1,000 entries). A feed read
  for this user is then a single `ZREVRANGE` — no fan-in computation at
  read time at all. This is what makes the ~350,000 QPS peak read load
  from the estimation tractable: the expensive work (fan-out) happened
  once, asynchronously, off the read path, amortized across however many
  times each follower actually opens their feed.
- **Pull (fan-out-on-read) for celebrity/high-follower accounts:** for any
  account above a follower-count threshold (say, 1M+ followers), pushing
  to every follower's timeline on every post is the write-amplification
  spike described in the estimation section — it can't be absorbed as a
  synchronous or even near-synchronous background job without massive
  worker fleet overprovisioning that sits idle 99% of the time. Instead,
  these accounts' posts are *not* pushed; a follower's feed read merges
  their precomputed (pushed) timeline with a direct, on-demand lookup of
  "posts from celebrity accounts I follow since my last feed load,"
  computed at read time. This shifts the cost from an unbounded write
  spike (bounded only by follower count, which can be in the tens of
  millions) to a small, bounded read-time merge (bounded by how many
  celebrity accounts a typical user follows, which is a much smaller,
  much more predictable number).
- **Cache key structure:** `timeline:{user_id}` → Redis sorted set,
  member = `post_id`, score = post `created_at` (epoch), capped to the
  most recent N entries via `ZREMRANGEBYRANK` after each push to bound
  memory per user regardless of how prolific the people they follow are.
- **TTL / invalidation:** the timeline cache for an active user is never
  explicitly expired — it's continuously maintained by the push path and
  self-bounds via the rank-based cap above. For a user who hasn't logged in
  for a long time, their timeline cache going cold and needing a
  rebuild-on-next-read (falling back to a DB-driven cold-start query) is an
  acceptable, rare-path cost; it would be wasteful to keep every inactive
  user's timeline warm in memory indefinitely.
- **Post edit/delete propagation:** since the timeline cache stores
  `post_id` references, not post content, an edit requires no cache
  invalidation at all — the post content is fetched fresh from the Post
  Store at render time, keyed by the IDs already in the timeline. A delete
  requires removing that one `post_id` from every timeline that has it,
  which is exactly symmetric to the fan-out-on-write path (a delete-fanout
  job instead of a post-fanout job) for push-model posts, and a no-op for
  pull-model (celebrity) posts, since those were never pushed anywhere to
  begin with.

### Deep Dive: CDN Usage

Media (images, video) is the dominant storage and bandwidth cost by a wide
margin (per the estimation), and it has a fundamentally different access
pattern than post metadata: it's large, immutable once uploaded, and
read-heavy with extreme geographic spread (the same viral image gets
requested by users worldwide within seconds of posting). This is close to
the textbook case for CDN delivery: media is uploaded once to origin blob
storage, and every subsequent read is served from an edge PoP close to the
requester, never touching origin storage again after the first
region-local cache fill. The CDN's cache key is naturally the media
URL/blob ID itself (content is immutable — a new upload gets a new ID
rather than overwriting an existing one), which sidesteps cache
invalidation entirely for media: there's never a need to invalidate
something that never changes, only to let old, cold content fall out of
edge cache naturally under normal LRU-style eviction.

### Tradeoffs & Alternatives Considered

- **Pure push model for every account, regardless of follower count.**
  Rejected: the back-of-envelope fan-out math makes this untenable at the
  high end of the follower distribution — a single post from a
  many-million-follower account would spike fan-out write volume to a
  level that requires either a worker fleet sized for that worst case
  (massively overprovisioned for 99.9% of posts) or accepting multi-minute
  propagation delays for celebrity posts specifically, which directly
  contradicts most products' expectations for how fast a major post should
  reach its audience.
- **Pure pull model for every account (compute every feed entirely at read
  time, no precomputed timelines at all).** Rejected for the opposite
  reason: at ~350,000 QPS peak reads, computing a merged, sorted feed from
  scratch on every single read — querying every followed account's recent
  posts and merging them at request time — is far too expensive to do
  synchronously on the read path at this volume. The hybrid model exists
  specifically because neither pure strategy survives the actual traffic
  shape of a real social graph with a power-law follower distribution.
- **Strong consistency for feed propagation (a post must appear in every
  follower's feed before the post-creation API call returns success).**
  Rejected: this would mean the post-creation latency is bounded by the
  slowest fan-out write among potentially millions of followers, which is
  an unacceptable user-facing delay for the *author* just to satisfy a
  freshness guarantee for followers that almost none of them will notice
  being off by a few seconds. Fan-out is asynchronous and eventually
  consistent by design; the author's own "my post was published"
  confirmation returns immediately after the write to the Post Store,
  independent of fan-out completion.

### Where Staff-Level Answers Diverge From Senior-Level Ones

A senior engineer's design for a news feed typically lands on "fan-out on
write, cache the timeline in Redis" and treats that as the complete answer
— it's correct for the median user and demonstrates real understanding of
the read/write asymmetry. A staff-level answer treats the follower-count
power-law distribution as the central design constraint from the start,
not a follow-up edge case raised only when the interviewer pushes — because
in a real social graph, the tail of that distribution (a small number of
accounts with enormous followings) is precisely where a naive design falls
over, and designing the hybrid push/pull split *before* being asked about
celebrities is the signal that distinguishes "knows the standard pattern"
from "has actually reasoned about why the standard pattern exists."

The second divergence is about how the system evolves as scale grows
100x. A senior design's timeline cache, sized for the assumptions given, is
usually treated as a fixed architecture. A staff design reasons explicitly
about what breaks first as DAU or average follower count grows: does the
per-user timeline cap (the N most recent entries) need to shrink to keep
memory bounded, and if so, what's the user-facing tradeoff (a power user
following thousands of accounts might scroll past the cached window faster
than it refills)? Does the fan-out worker fleet need to be resharded by
follower-count tier, so that one worker pool handles the long tail of
small accounts (cheap, uniform, parallelizable) while a separate,
differently-provisioned pool handles the smaller number of large accounts
near the push/pull threshold (which need more careful, possibly rate-
limited, batched fan-out)? Naming this bifurcation of worker infrastructure
by load shape, not just by raw QPS, is a staff-level operational instinct.

The third divergence is organizational. A social feed system at this scale
is never owned by a single team — there's a team that owns the social
graph (follows), a team that owns the post/content store, a team that owns
the fan-out and caching infrastructure, and often a separate ranking/ML
team if the feed isn't purely chronological. A staff-level answer
proactively surfaces the API contracts and ownership boundaries between
these teams (who owns the schema for `follows`, who's on-call when the
timeline cache has a hot-key problem, whose deploy caused a regression if
feed freshness suddenly degrades platform-wide) because a bad deploy from
any one of these teams has a blast radius that touches every other team's
metrics, and that cross-team failure mode is exactly the kind of thing a
senior-level design conversation rarely has reason to surface.

### Staff-Level Follow-Up

**"A single celebrity account's post needs to reach 50 million followers
within seconds of being published — walk through exactly what happens,
end to end, and where the bottleneck would be if you tried to brute-force
it with the push model."** First, name the brute-force failure precisely:
pushing to 50M followers means 50M individual timeline-cache writes, and
even at a generous 50,000 writes/sec sustained throughput from a
well-provisioned worker fleet, that's 1,000 seconds (over 16 minutes) just
to finish the fan-out for one post — nowhere close to "within seconds," and
that's assuming the write throughput doesn't itself degrade under that
sustained load. This is exactly why the hybrid model routes this account
to the pull path instead: the post is written once to the Post Store (and
to a lightweight "celebrity post index" keyed by `author_id`, scored by
time, so it can be found quickly), and every one of those 50M followers'
feed reads merge in this account's recent posts *at read time* — turning
one unboundedly expensive write-fanout operation into 50 million
independent, cheap, parallelizable reads, each bounded only by "how many
celebrity accounts does this one user follow," which is a small, bounded
number regardless of how large the celebrity's audience is. The follow-up
worth raising unprompted: this read-time merge needs its own cache (e.g., a
short-TTL cache of "celebrity posts since timestamp X" shared across all
followers' reads, not recomputed per follower) so that the pull path itself
doesn't turn into 50 million redundant identical queries against the Post
Store in the seconds after a viral post goes out — the same request-
coalescing principle that showed up in the URL shortener's thundering-herd
follow-up applies here at a much larger scale.

---

## Exercise 4: Design a Real-Time Chat / Notification System

### The Prompt

"Design a real-time chat system — users can send messages to each other
(or in groups) and see them appear instantly, plus get push notifications
when they're offline."

### Clarifying Questions to Ask

- One-on-one chat only, or group chats too? Group size matters a lot — a
  5-person group and a 5,000-person "channel" are architecturally
  different problems (fan-out cost per message scales with group size).
- Does message delivery need guaranteed ordering per conversation, and
  does it need exactly-once delivery, or is at-least-once (with
  client-side dedup) acceptable?
- Do we need delivery/read receipts (sent, delivered, read — the
  WhatsApp-style three states), or just "message exists"?
- What's the offline story — if a user is offline for a day and comes
  back, do they get every missed message replayed, or just the most
  recent N?
- Does history need to be fully persisted and searchable indefinitely, or
  is there a retention window after which old messages can be archived or
  dropped?
- What transport are we assuming — WebSocket, long-polling, or does the
  client platform matter (native mobile apps often rely on a separate
  system-level push channel like APNs/FCM rather than holding a persistent
  socket in the background)?
- What's the expected concurrent-connection count at peak, and the
  messages-per-second volume — these two numbers, not DAU alone, determine
  connection-server and pub-sub sizing.
- What's the acceptable end-to-end latency from "sender hits send" to
  "recipient's device shows the message," for the online-both-parties
  case?
- Does the system need end-to-end encryption, and if so, does that change
  anything about where messages can be inspected/indexed server-side (e.g.,
  server-side search becomes impossible if the server never sees
  plaintext)?
- How do we handle a user with multiple active devices/sessions
  simultaneously — does every device need the message pushed to it, and
  does read-state need to sync across devices in real time?

### Back-of-Envelope Estimation

**Assumptions (stated explicitly):** 50M daily active users, 20% of DAU
online concurrently at peak (10M concurrent connections), average active
user sends 20 messages/day, average group/conversation size of 5
recipients per message (mix of 1:1 and small groups), and 30% of message
deliveries happen while the recipient is offline (requiring a push
notification instead of a live socket delivery).

**Message write volume**
```
50,000,000 DAU × 20 messages/day ≈ 1,000,000,000 messages/day (1B/day)
1,000,000,000 ÷ 86,400 sec/day ≈ 11,574 messages/sec (average)
peak (3x average)                ≈ 34,722 → ~35,000 QPS peak message sends
```

**Delivery fan-out volume (per-recipient delivery events, not per message)**
```
1,000,000,000 messages/day × 5 avg recipients/message ≈ 5,000,000,000 deliveries/day (5B/day)
5,000,000,000 ÷ 86,400 sec/day ≈ 57,870 deliveries/sec (average)
peak (3x average)                 ≈ 173,611 → ~175,000 QPS peak delivery events
```

**Push notification volume (offline recipients only)**
```
5,000,000,000 deliveries/day × 30% offline ≈ 1,500,000,000 push notifications/day (1.5B/day)
1,500,000,000 ÷ 86,400 sec/day ≈ 17,361 pushes/sec (average)
peak (3x average)                  ≈ 52,083 → ~52,000 QPS peak to APNs/FCM
```
This number matters operationally: APNs and FCM both impose their own
rate limits per sending app, so sustained tens of thousands of pushes/sec
needs to be batched and queued against those providers' documented limits
— a naive direct call per notification at this volume will get throttled
or blocked by the provider, independent of anything on our own
infrastructure.

**Connection server capacity**
```
Assume each connection server sustains ~50,000 concurrent WebSocket
connections (realistic with OS-level tuning; ~10 KB of memory overhead
per idle connection)
10,000,000 concurrent connections ÷ 50,000 connections/node = 200 nodes
Memory per node: 50,000 × 10 KB ≈ 500 MB just for connection state —
comfortably within a single server's memory budget, leaving headroom for
the app process itself
```
200 connection-holding nodes is the real sizing number worth saying out
loud in the interview — this is a fundamentally different infrastructure
shape than the stateless, horizontally-fungible app tiers in the other
three exercises, because a connection server is **stateful**: a specific
user's live socket lives on exactly one specific node at a time, which
has real consequences for both load balancing and deployment (see Deep
Dive and the staff-level section below).

**Message storage**
```
1,000,000,000 messages/day × ~300 bytes/message (text + metadata, excluding attachments)
  = 300,000,000,000 bytes/day = 300 GB/day
300 GB/day × 365 days ≈ 109.5 TB/year (text-only message history)
```

### High-Level Architecture

```
┌────────────────────────────────────────────────┐
│ Client (WebSocket / long-poll)                 │
└────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────┐
│ Connection Gateway / LB                        │
│ consistent hashing on connection_id            │
└────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────┐
│ Connection Servers                             │
│ hold live sockets, N shards, 50k conns/node    │
└────────────────────────────────────────────────┘
                         │  publish message event
                         ▼
┌────────────────────────────────────────────────┐
│ Pub/Sub Broker (Kafka / Redis Streams)         │
│ topic per conversation_id                      │
└────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────┐
│ Message Store (sharded)                        │
│ messages table, partitioned by conversation_id │
└────────────────────────────────────────────────┘
                         │  recipient offline
                         ▼
┌────────────────────────────────────────────────┐
│ Push Notification Service                      │
│ batches to APNs / FCM                          │
└────────────────────────────────────────────────┘
```

### Deep Dive: Client-Server Architecture (Connection Management)

The defining architectural fact of this system is that it's built on
**long-lived, stateful connections**, which is fundamentally unlike the
stateless request/response model every other exercise in this file
assumes. A few consequences follow directly from that:

- **Session-to-node mapping must be tracked explicitly.** When user A
  wants to send a message to user B, the system needs to know *which
  specific connection server* (out of the ~200 computed above) currently
  holds user B's live socket, if any. This is typically a fast lookup in a
  shared store (e.g., `session:{user_id} -> {connection_server_id,
  connection_id}` in Redis), updated on connect/disconnect. Without this
  mapping, there's no way to route a message to "wherever B's socket
  actually is" — the pub/sub broker delivers the message to the right
  *topic*, but something still has to know which physical node is
  subscribed to that topic on B's behalf.
- **Reconnection and multi-device handling.** A user can have multiple
  simultaneous connections (phone + laptop), each potentially on a
  different connection server. The session mapping above needs to support
  multiple entries per user, and message delivery needs to fan out to all
  of them (or sync read-state across them), not just the first address
  found.
- **Graceful connection draining on deploy.** Because connections are
  stateful and sticky to a specific node, deploying new code to the
  connection-server tier can't use a simple rolling restart the way a
  stateless app tier can — killing a connection server mid-deploy drops
  every socket it's holding (potentially tens of thousands of users
  simultaneously), each of which then has to reconnect (and get re-mapped
  to a different node) at once. The standard mitigation is a drain
  protocol: stop routing *new* connections to a node marked for
  replacement, send connected clients a "reconnect" signal that lets them
  gracefully re-establish elsewhere before the old node is actually
  terminated, rather than a hard kill.

### Deep Dive: Pub-Sub

The pub/sub layer (Kafka or Redis Streams) is what decouples "a message
was sent" from "every recipient's connection server, wherever it happens to
be, finds out about it" — without this layer, the sending connection server
would need direct network knowledge of every other connection server that
might be holding a relevant recipient's socket, an all-to-all coupling that
doesn't scale past a handful of nodes.

- **Topic structure:** one topic (or partition key) per `conversation_id`.
  A message send publishes once to its conversation's topic; every
  connection server currently holding a socket for a participant in that
  conversation is subscribed (dynamically, based on its connected users'
  active conversations) and receives the event, then pushes it down the
  relevant local socket(s).
- **Why partition by `conversation_id` and not by `user_id`:** partitioning
  by conversation preserves **per-conversation ordering** for free — all
  messages in one conversation land on the same partition and are
  delivered in the order they were published, which directly satisfies the
  "guaranteed ordering per conversation" requirement raised in the
  clarifying questions. Partitioning by `user_id` instead would require a
  separate ordering mechanism, since a single conversation's messages
  would be split across however many partitions correspond to its
  participants.
- **At-least-once delivery, client-side dedup:** the broker guarantees
  at-least-once delivery (standard for Kafka-style systems without
  expensive distributed transactions), which means a connection server
  might occasionally receive and forward the same message event twice
  (e.g., after a consumer-group rebalance). Each message carries a unique,
  client-stable `message_id`; the receiving client (or the connection
  server, as a first line of defense) deduplicates on that ID before
  display. This is a deliberate choice to push a cheap check to the edges
  rather than pay for exactly-once semantics that this use case doesn't
  strictly need (a duplicate chat bubble that gets silently deduped is a
  non-event; a lost message is a real, visible bug).
- **Offline fan-out:** the same publish event that feeds the pub/sub
  broker also feeds the Push Notification Service's queue — a message
  recipient who has no active connection-server subscription for their
  user ID (per the session mapping) is routed to the push path instead of,
  or in addition to, the live-delivery path, which is exactly the fork
  shown in the architecture diagram.

### Deep Dive: Load Balancing Algorithm Choice

Two different load-balancing decisions again, for two different reasons:

**Initial connection establishment (Client → Connection Gateway):**
**consistent hashing on a stable client identifier** (e.g., `user_id`), not
simple round robin or least-connections. The reason is subtler than in the
rate-limiter exercise: it's not primarily about cache locality here, it's
about making **reconnection routing predictable** — if a client's
connection drops and it reconnects, consistent hashing increases the odds
it lands on the same (or a nearby, in hash-ring terms) connection server it
was on before, which matters if that server was holding any per-session
state (unacked message buffers, presence info) that hasn't yet been fully
externalized to the shared session store. In a design where *all* session
state is fully externalized (nothing sticky lives only in server memory),
plain least-connections becomes viable too — but consistent hashing is the
safer default when that externalization isn't guaranteed to be complete,
and it degrades gracefully (most reconnects still land correctly) rather
than catastrophically if it isn't.

**Message delivery routing (finding which connection server holds a given
recipient's socket):** this isn't really a load-balancing decision at all
— it's a **lookup**, not a balancing choice, since there's exactly one
correct answer (wherever that user's socket actually is), not a menu of
equally-valid targets. This is worth stating explicitly in an interview:
not every "which server do I send this to" question is a load-balancing
problem; conflating a stateful routing lookup with a load-balancing
algorithm choice is a common and avoidable mistake.

### Tradeoffs & Alternatives Considered

- **Long-polling instead of WebSockets, for simplicity and broader legacy
  client compatibility.** Rejected as the default: long-polling means a
  new HTTP request (and its full connection-setup overhead) on every
  round trip, which costs significantly more server resources per active
  user at this concurrency than one long-lived WebSocket connection, and
  adds latency to every message (bounded by the poll interval, not
  instant). Worth keeping as a documented fallback transport for clients
  that genuinely can't hold a WebSocket (restrictive corporate proxies,
  very old browsers), but not the primary design.
- **No pub/sub broker — connection servers talk directly to each other
  (gossip or direct RPC) to route messages.** Rejected: at 200 connection
  server nodes, direct all-to-all coordination (any node might need to
  reach any other node for any recipient) becomes an operational and
  correctness nightmare — no natural place to enforce per-conversation
  ordering, and no durable replay log if a node crashes mid-delivery. The
  broker centralizes both ordering and durability concerns into one
  well-understood component instead of reinventing both inside the
  connection-server tier.
- **Exactly-once delivery semantics end-to-end (distributed transactions
  across publish, store, and deliver).** Rejected: the cost (both in
  latency per message and in engineering complexity — think two-phase
  commit or a saga pattern across the message store and the pub/sub
  broker) vastly outweighs the benefit here, since a cheap, client-side
  `message_id` dedup check achieves the user-visible outcome ("I never see
  a duplicate message") at a fraction of the infrastructure cost, without
  requiring every component in the pipeline to participate in a
  distributed transaction.

### Where Staff-Level Answers Diverge From Senior-Level Ones

A senior engineer's design correctly identifies WebSockets, a pub/sub
layer for fan-out, and separate handling for push notifications when
offline — a coherent, workable system. What a senior design usually treats
as a minor implementation detail, and what a staff design treats as a
first-class architectural concern, is **the statefulness of the connection
tier itself**. Every other system in this file has a stateless app layer
that can be scaled, rolling-deployed, and load-balanced with zero special
handling; the chat system's connection servers cannot be, and a staff-level
answer front-loads the consequences of that — the drain protocol on
deploy, the session-to-node mapping as a dependency that itself needs to be
highly available (if *it* goes down, message routing breaks even though
every individual connection server is healthy), and the fact that a single
connection server crashing instantly disconnects every one of the ~50,000
users it was holding, all of whom need to reconnect and get rebalanced
simultaneously — a thundering-herd-style reconnection storm against the
connection gateway tier, caused by infrastructure the system itself
controls, not external traffic.

The second divergence is in how the design reasons about group chat
specifically, as distinct from 1:1 messaging. A senior design often treats
"group chat" as "1:1 messaging, but loop over more recipients" — which is
true for small groups but breaks down for anything approaching a
"channel" with thousands of members, where the fan-out cost per message
(recipients × message rate) starts to resemble the news-feed celebrity
problem from Exercise 3 far more than it resembles 1:1 chat. A staff-level
answer notices this convergence explicitly and reuses the same hybrid
push/pull reasoning: small groups get full push delivery to every
member's connection; very large channels need a different delivery
strategy (e.g., clients poll/subscribe to a channel's message log directly
rather than every message being individually pushed to every member's
live socket), because naively scaling the 1:1 design by recipient count
alone hits the exact same write-amplification wall a celebrity post does.

The third divergence is around data loss versus data duplication as
asymmetric risks, and how that should shape engineering priorities. A
senior design, when forced to choose between occasionally duplicating a
message and occasionally losing one, usually gets the right instinct (at-
least-once, dedup client-side) but may not articulate *why* that
asymmetry holds specifically for chat. A staff-level answer states it
plainly: for a messaging product, a duplicate message is a cosmetic,
user-invisible-after-dedup non-event, while a lost message is a trust-
destroying failure (a user's "did they even get my message?" anxiety is
core to the entire product's value proposition) — so every design decision
in the pipeline, from broker configuration to retry logic, should be
biased toward "deliver more than necessary and dedup" rather than toward
"never deliver twice," and that bias should be explicit and stated, not an
accident of whichever default the chosen message broker happens to ship
with.

### Staff-Level Follow-Up

**"A single connection server holding 50,000 live sockets crashes
unexpectedly — walk through what happens in the next 10 seconds, and what
in the design prevents this from cascading into a platform-wide outage."**
First, name the immediate blast radius precisely: all ~50,000 users on
that node lose their socket simultaneously and their client libraries
detect the drop (typically via a missed heartbeat or a TCP reset) and
begin reconnecting, usually within a few seconds per client's own retry
logic. The first real risk is a **reconnection thundering herd**: 50,000
clients attempting to reconnect in a tight time window all hit the
Connection Gateway tier at once, and if the gateway routes them via
consistent hashing back toward the (now-dead) node's hash range before
that range has been reassigned, the reconnect attempts fail and retry
again, compounding the spike. The mitigation is client-side reconnect
jitter (randomized backoff, not synchronized retry) combined with the
gateway's hash ring updating quickly to exclude the dead node, so retries
land on healthy nodes rather than repeatedly hammering a dead one. Second,
any message that was in-flight *to* that node at the moment of the crash
(published to the broker, consumed by that connection server, but not yet
delivered down a socket before the crash) needs to not simply vanish — this
is exactly why the broker (not the connection server's own memory) is the
durable source of truth for "was this message published," and why delivery
acknowledgment should flow back to the broker/session layer, not be
tracked solely in the now-dead node's local state: the recipient's client,
once reconnected to a new node, needs a way to request "replay anything
I've missed since my last acknowledged message," which only works if
delivery state was externalized and durable rather than living only in the
crashed node's memory. The system should be designed so that a single
connection-server crash is a routine, survivable event — a brief
reconnection blip for 50,000 users, not a lost-message incident and not a
cascading overload of the rest of the fleet.
