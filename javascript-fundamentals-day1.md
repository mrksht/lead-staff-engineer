# JavaScript Fundamentals — Day 1 Deep Dive

Senior/Lead/Staff-level treatment of the mechanics interviewers actually probe:
not "what is a closure" but "why does this specific piece of production code
leak memory / reorder / lose `this`." Every runnable snippet is real,
non-strict JS executed with `new Function` — press **▶ Run** and read the
actual console order before scrolling to the explanation. Predict first,
then verify. That's the practice loop for this entire doc.

One deliberate reorder from a strict "execution → async → object model"
list: **Hoisting sits right after Execution Context**, not near the end —
hoisting *is* what happens during an execution context's creation phase, so
teaching it eight sections later would strand it without its foundation.
Everything else follows the request order.

## Table of Contents

- [Execution Context](#execution-context)
- [Hoisting](#hoisting)
- [The Call Stack](#the-call-stack)
- [Closures](#closures)
- [`this`](#this)
- [call / apply / bind](#call--apply--bind)
- [Prototypes & the Prototype Chain](#prototypes--the-prototype-chain)
- [The Event Loop](#the-event-loop)
- [Microtasks vs Macrotasks](#microtasks-vs-macrotasks)
- [Modules](#modules)
- [Interview Questions](#interview-questions)

---

## Execution Context

### The Mental Model

Every time JavaScript runs *any* code — the whole script, or a function call
— it wraps that code in an **execution context**: a record of everything
needed to run it. There are two kinds you'll deal with directly:

```
Global Execution Context (GEC)      ← created once, when the script starts
Function Execution Context (FEC)    ← created fresh, every single call
```

Each execution context is built in **two phases**, and almost every
"weird" JS behavior — hoisting, TDZ, why `this` is what it is — is just a
consequence of what happens in these two phases:

```
┌───────────────────────────────────────────────────────────┐
│ 1. CREATION PHASE (before a single line runs)             │
│    - Create the Variable Environment (var/function decls) │
│    - Create the Lexical Environment (let/const, in TDZ)   │
│    - Determine `this`                                      │
│    - Wire up the scope chain (link to outer environment)  │
├───────────────────────────────────────────────────────────┤
│ 2. EXECUTION PHASE (line by line)                          │
│    - Assign actual values                                  │
│    - Execute statements                                    │
│    - Call other functions → push NEW execution contexts    │
└───────────────────────────────────────────────────────────┘
```

The creation phase is why this "works":

```js
// Predict what this logs, then press Run.
sayHi();

function sayHi() {
  console.log("hi — called before my own declaration");
}
```

`sayHi` isn't found by "scanning ahead" at call time — the *entire function*
was already registered in the Variable Environment during the creation
phase, before `sayHi();` ever executed. By the time execution phase starts,
`sayHi` already points at a real function. (More on exactly what gets
hoisted, and what doesn't, in the next section.)

### Scope Chain, Precisely

Every execution context has a link to the execution context it was
*lexically* defined inside (not the one that *called* it — that distinction
matters and is the whole reason closures work):

```js
function outer() {
  const a = "outer-a";
  function inner() {
    const b = "inner-b";
    console.log(a, b); // inner's scope chain: inner → outer → global
  }
  inner();
}
outer();
```

`inner`'s scope chain is fixed at the moment `inner` is *defined* (inside
`outer`), not at the moment it's *called*. Call `inner` from anywhere, in
any context, and it still sees `outer`'s variables. This lexical (not
dynamic) scoping is the entire foundation closures are built on.

### Execution Context vs Call Stack — Don't Conflate These

- **Execution context** = the data (variables, `this`, scope chain) for one
  invocation.
- **Call stack** = the ordered list of execution contexts currently running,
  tracking *which one runs next when the current one returns*.

They're created together (calling a function creates a context *and* pushes
it onto the stack) but they answer different questions: "what does this
function see?" vs "what order do functions return in?" The call stack gets
its own section below because the *ordering* behavior deserves its own
mental model.

---

## Hoisting

### The One-Sentence Version

"Hoisting" is the observable *effect* of the creation phase: names get
registered in memory before execution starts, but **what "registered"
means is different for every declaration type** — and that difference is
where every hoisting interview question lives.

```js
// Predict the exact output/error for each line, THEN uncomment one at a
// time and press Run to check yourself.

console.log(typeof varDeclared);     // ?
// console.log(typeof letDeclared);  // ?  (uncomment to test)
// console.log(typeof fnDeclared);   // ?  (uncomment to test)

var varDeclared = "var value";
let letDeclared = "let value";
function fnDeclared() {}
```

Run it as-is first: `typeof varDeclared` logs `"undefined"` — not an error.
`var` is hoisted *and pre-initialized to `undefined`* during the creation
phase, so reading it early is legal, just useless.

Now uncomment the `letDeclared` line and run again. You get a
`ReferenceError: Cannot access 'letDeclared' before initialization` — not
`"undefined"`, and critically, **not** "letDeclared is not defined" either.
That specific error message is the tell that `let` *is* hoisted (the engine
already knows the name exists) but sits in the **Temporal Dead Zone (TDZ)**
— reserved but deliberately inaccessible until its declaration line
actually executes.

```
┌─────────────── TDZ, precisely ───────────────┐
│ var x;              → hoisted, = undefined   │  ← usable early (junk value)
│ let x; / const x;   → hoisted, TDZ            │  ← ReferenceError if touched
│ function f(){}      → hoisted, fully defined  │  ← usable early (works!)
│ class C {}          → hoisted, TDZ (like let) │  ← ReferenceError if touched
└───────────────────────────────────────────────┘
```

### Function Declarations vs Function Expressions

This is the distinction that trips people up under interview pressure —
they sound similar but hoist completely differently:

```js
// Function DECLARATION — name AND body hoisted. Callable before this line.
hoistedFn();
function hoistedFn() {
  console.log("declaration: fully hoisted, this works");
}

// Function EXPRESSION assigned to var — only the VARIABLE hoists (as
// undefined). The function body is attached at assignment time, during
// execution, not creation.
try {
  hoistedExpr();
} catch (e) {
  console.log("expression:", e.message); // "hoistedExpr is not a function"
}
var hoistedExpr = function () {
  console.log("this never runs above");
};
```

Note the error is `"hoistedExpr is not a function"`, not a `ReferenceError`
— because `var hoistedExpr` *was* hoisted (to `undefined`), and calling
`undefined()` throws a `TypeError`. Three different declaration styles,
three different failure modes if misused. That's the level of precision
worth having for a staff interview.

### Classes: Hoisted, But TDZ (Not Usable Early)

```js
try {
  new EarlyClass();
} catch (e) {
  console.log(e.constructor.name + ":", e.message);
}
class EarlyClass {}
```

Classes are hoisted (the engine reserves the binding) but land in the TDZ
like `let`/`const` — you get a `ReferenceError`, not "class is not defined."
This is a deliberate spec choice: unlike `var`, nothing in modern JS wants
you silently reading a not-yet-initialized binding as `undefined`.

### The Classic `var` Loop Bug (and why `let` fixes it)

This single example is one of the highest-signal interview questions there
is, because getting it right requires understanding hoisting, scope, *and*
closures simultaneously:

```js
// Predict the three logged values BEFORE running.
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log("var:", i), 0);
}
for (let j = 0; j < 3; j++) {
  setTimeout(() => console.log("let:", j), 0);
}
```

`var i` is hoisted to *function/global* scope — there is exactly **one** `i`
shared by all three closures, and by the time any `setTimeout` callback
runs, the loop has already finished and `i` is `3`. All three log `var: 3`.

`let j` is scoped *per iteration* — the spec creates a **fresh binding of
`j` for every loop iteration**. Each closure captures its own `j`, so you
get `let: 0`, `let: 1`, `let: 2`. This is exactly why "just use `let` in
loops" became the default advice, and exactly why you should be able to
explain *why* rather than reciting it.

---

## The Call Stack

### The Mental Model

The call stack is a **LIFO (last in, first out)** structure. Calling a
function pushes a frame; returning pops it. That's the entire mechanism
behind "what happens after this line runs."

```js
function first() {
  console.log("first: start");
  second();
  console.log("first: end");
}
function second() {
  console.log("second: start");
  third();
  console.log("second: end");
}
function third() {
  console.log("third: only line");
}
first();
```

```
Call stack over time:

[first]                     ← first() called
[first, second]             ← second() called from inside first
[first, second, third]      ← third() called from inside second
[first, second]             ← third() returned, popped
[first]                     ← second() returned, popped
[]                          ← first() returned, popped
```

Output order: `first: start`, `second: start`, `third: only line`,
`second: end`, `first: end` — the stack shape *is* the reason "end" logs
run in reverse order of "start" logs. This is the mental model to reach for
whenever someone asks "in what order do these run."

### Stack Overflow, Precisely

```js
function recurse(n) {
  return recurse(n + 1); // no base case
}
try {
  recurse(0);
} catch (e) {
  console.log(e.constructor.name + ":", e.message);
}
```

Each call pushes a new frame without ever popping (no `return` value is
used, the call never resolves) until the engine's fixed stack size limit is
hit → `RangeError: Maximum call stack size exceeded`. This is also why deep
recursion over large trees/lists (naive recursive JSON traversal, deeply
nested comment threads) is a real production risk, not just a toy problem —
convert to an explicit stack/queue with a loop when depth is unbounded.

### The Tail-Call Optimization Trap

ES2015 formally specifies **proper tail calls** (a `return someFn()` in tail
position should reuse the current frame instead of pushing a new one,
making infinite tail recursion stack-safe). This is real, in the spec,
and — as of today — **not implemented in V8** (Chrome, Node) or most other
engines except Safari/JavaScriptCore. Don't rely on TCO to make recursive
code stack-safe in a browser or Node; convert to iteration or trampolining
if depth is unbounded. This is a great "I know something most people don't"
answer at staff level: the spec allows it, but assuming your recursive
`return f(n-1)` is stack-safe **will still crash in Chrome**.

---

## Closures

### The Mental Model

A closure is what you get automatically, for free, every time you create a
function inside another function: **the inner function keeps a live
reference to its outer scope's variables, even after the outer function has
returned and its execution context is gone.**

```js
function makeCounter() {
  let count = 0; // makeCounter's execution context "should" be gone after return
  return function increment() {
    count += 1; // but this still works — count is still alive
    return count;
  };
}

const counter = makeCounter();
console.log(counter()); // 1
console.log(counter()); // 2
console.log(counter()); // 3

const counter2 = makeCounter(); // a SEPARATE count, separate closure
console.log(counter2()); // 1 — not 4
```

Why this works: `count` isn't destroyed when `makeCounter` returns, because
`increment` still references it — and the engine can't garbage-collect a
variable something else can still reach. The scope chain link established
at *definition* time (see Execution Context, above) keeps `count` alive for
as long as `increment` exists. Two calls to `makeCounter` create two
independent `count` variables and two independent closures over them — this
is the real mechanism behind "private state" in the pre-class-fields era.

### The Correct Mental Model: Closures Capture Variables, Not Values

This is the detail that separates "I can define closure" from "I understand
closures":

```js
function makeAdders() {
  const adders = [];
  let base = 10;
  for (let i = 0; i < 3; i++) {
    adders.push((x) => x + i + base);
  }
  base = 100; // mutating AFTER the closures were created
  return adders;
}

const [add0, add1, add2] = makeAdders();
console.log(add0(1)); // ?  predict, then run
console.log(add1(1)); // ?
console.log(add2(1)); // ?
```

Every closure sees `base = 100`, because they capture the *variable*
`base`, not a snapshot of its value at closure-creation time. Any later
mutation is visible to every closure that captured it. (`i` differs per
closure here for the same reason the `let` loop fix worked earlier — a
fresh `i` binding per iteration.)

### The Production Failure Mode: Retained Memory

The same mechanism that makes closures useful makes them a real memory-leak
vector. If a closure captures a reference to something large (a big array,
a DOM node, a whole component's props) and that closure outlives the thing
that created it (stored globally, attached to a long-lived event listener
that's never removed), the large object **cannot be garbage collected** —
something can still reach it.

```
Classic leak shape:
  function attachHandler(hugeDataset) {
    document.addEventListener("click", () => {
      console.log(hugeDataset.length); // closure keeps hugeDataset alive
    });
    // if this listener is never removeEventListener'd, hugeDataset
    // lives for the life of the page, no matter how large it is.
  }
```

This is the real-world version of the "when memoization is harmful" content
from the React docs in this dashboard — `useCallback`/`useMemo` closures
have the exact same retention behavior, just garbage-collected on unmount
instead of "never," which is precisely why stale closures inside
`useEffect` with missing dependencies are a memory/correctness bug, not
just a lint warning.

---

## `this`

### The Determination Rules, In Priority Order

`this` is **not** lexical (except for arrow functions — see below). It's
determined by **how a function is called**, evaluated fresh on every call,
using this precedence:

```
1. `new Binding`        — new Foo()              → this = the new instance
2. Explicit Binding     — fn.call/apply/bind(obj) → this = obj
3. Implicit Binding     — obj.method()            → this = obj
4. Default Binding      — fn()                    → this = globalThis (sloppy)
                                                     or undefined (strict)
```

```js
function whoAmI() {
  console.log(this === globalThis ? "globalThis (default binding)" : this);
}

const holder = { whoAmI }; // implicit binding

whoAmI();                          // rule 4: default binding
holder.whoAmI();                   // rule 3: implicit binding — this = holder
whoAmI.call({ tag: "explicit" });  // rule 2: explicit binding

function Widget() {
  console.log(this.constructor.name); // rule 1: new binding — this = the new instance
}
new Widget();
```

Run this: the standalone `whoAmI()` call logs the default-binding branch —
because this snippet runs in **non-strict mode** (the default for
`new Function`, which is what powers every runnable block on this page).
Inside a real ES module or a class body — both **always strict** — that
same call would instead give `this === undefined`. Know both answers; which
one applies depends on the surrounding code's strictness, not just "how the
function is called."

### The Interview-Favorite Bug: Losing `this` in Callbacks

```js
class Counter {
  constructor() {
    this.count = 0;
  }
  increment() {
    this.count += 1;
    console.log(this.count);
  }
}

const c = new Counter();
c.increment(); // 1 — implicit binding, this = c

const detached = c.increment;
try {
  detached(); // rule 4 kicks in — this is undefined/globalThis, NOT c
} catch (e) {
  console.log("Error:", e.message); // "Cannot read properties of undefined"
}
```

This is *exactly* what happens when you pass `this.increment` as a React
`onClick` handler, an event listener callback, or a `setTimeout` callback:
the function gets **detached** from the object it was called on, and
implicit binding never kicks in. Three real fixes, in the order you should
reach for them:

```js
class FixedCounter {
  count = 0;
  // Fix 1: arrow function class property — captures `this` lexically at
  // definition time (inside the constructor's scope), never detachable.
  increment = () => {
    this.count += 1;
  };
}

const fixed = new FixedCounter();
const detachedFixed = fixed.increment; // detach it, same as the bug demo
detachedFixed();
detachedFixed();
console.log("Fix 1 (arrow property):", fixed.count); // 2 — survives detaching

class BoundInConstructor {
  constructor() {
    this.count = 0;
    // Fix 2: explicit bind in the constructor — one-time cost, stable
    // reference (important if this is a dependency/prop comparison target).
    this.increment = this.increment.bind(this);
  }
  increment() {
    this.count += 1;
  }
}

const bound = new BoundInConstructor();
const detachedBound = bound.increment;
detachedBound();
console.log("Fix 2 (bind in constructor):", bound.count); // 1 — also survives

// Fix 3 (call-site): wrap at the point of use — cheap, but creates a new
// function on every render if used inline in JSX, which is the exact
// "one unstable prop defeats React.memo" problem from the memoization doc.
// <button onClick={() => instance.increment()}>
```

### Arrow Functions: Lexical `this`, No Exceptions

```js
const obj = {
  tag: "obj",
  regular: function () {
    return this.tag;
  },
  arrow: () => {
    return this.tag; // NOT obj — captures `this` from where `arrow` was
                      // DEFINED (here, the top-level module/script scope)
  },
};

console.log(obj.regular()); // "obj" — implicit binding applies normally
console.log(obj.arrow());   // undefined — arrow ignores implicit binding entirely
console.log(obj.arrow.call({ tag: "forced" })); // still undefined —
                                                  // call/apply/bind CANNOT
                                                  // rebind an arrow function's `this`
```

This is *why* arrow class properties fix the callback problem above: arrow
functions have no `this` of their own to lose, at all — full stop, no
exceptions, not even explicit `.call()`.

---

## call / apply / bind

### The Three, Precisely Differentiated

```
fn.call(thisArg, arg1, arg2, ...)   → invokes NOW, args listed individually
fn.apply(thisArg, [arg1, arg2])     → invokes NOW, args as an array
fn.bind(thisArg, arg1, ...)         → does NOT invoke — returns a NEW
                                       permanently-bound function for later
```

```js
function introduce(greeting, punctuation) {
  console.log(`${greeting}, I'm ${this.name}${punctuation}`);
}

const person = { name: "Rak" };

introduce.call(person, "Hi", "!");           // invokes immediately
introduce.apply(person, ["Hey", "."]);        // invokes immediately, args as array
const bound = introduce.bind(person, "Yo");   // does NOT invoke — returns a function
bound("?");                                    // invoked later: "Yo, I'm Rak?"
```

### Real Use Case: Borrowing Methods

A classic, still-relevant use of `call`: using a method that exists on one
type against an object that isn't that type, but is *shaped* like it.

```js
function sum() {
  // `arguments` is array-LIKE (has length, indices) but is NOT a real
  // Array — no .map/.filter/.reduce. Borrow Array's method via call.
  const args = Array.prototype.slice.call(arguments);
  return args.reduce((a, b) => a + b, 0);
}
console.log(sum(1, 2, 3, 4)); // 10
```

(Modern code uses rest params — `function sum(...args)` — which gives you a
real array directly. But "borrow a method via `.call`" is still exactly how
you'd operate on any array-like: `NodeList`s from `querySelectorAll`,
`arguments`, typed arrays before certain methods existed on them.)

### `bind` Gotcha: It's Permanent, and It's a New Function Every Call

```js
function greet(name) {
  console.log(`${this.prefix} ${name}`);
}
const bound1 = greet.bind({ prefix: "Hello" });
const reboundAttempt = bound1.bind({ prefix: "Goodbye" }); // does NOT override
reboundAttempt("Rak"); // still "Hello Rak" — first bind wins, permanently
```

And the performance trap: calling `.bind()` inline (`onClick={this.fn.bind(this)}`
in JSX, same failure mode as an inline arrow) allocates a **new function
object every render** — same "unstable prop defeats `React.memo`" issue
from the memoization deep-dive, just spelled with `.bind` instead of `() =>`.

### Interview Classic: Implement Your Own `bind`

If you can write this correctly (including using `new` with a bound
function, which real `bind` supports and most naive polyfills silently
break), you understand `this`, prototypes, and `apply` all at once:

```js
Function.prototype.myBind = function (thisArg, ...boundArgs) {
  const originalFn = this;
  function bound(...callArgs) {
    // If `bound` is called with `new`, `this` inside `bound` is the new
    // instance being constructed — respect that instead of thisArg.
    const isNewCall = this instanceof bound;
    return originalFn.apply(isNewCall ? this : thisArg, [...boundArgs, ...callArgs]);
  }
  bound.prototype = Object.create(originalFn.prototype || {});
  return bound;
};

function Person(name) {
  this.name = name;
}
const BoundPerson = Person.myBind({});
const p = new BoundPerson("Rak"); // `new` still works correctly
console.log(p.name, p instanceof Person); // "Rak" true
```

---

## Prototypes & the Prototype Chain

### The Three Easily-Confused Things

This trio confuses even experienced engineers because the names are so
close. Nail this and you've out-leveled most candidates:

```
someFunction.prototype        — an ordinary object, sitting on the
                                 CONSTRUCTOR function, that will become
                                 the [[Prototype]] of instances it creates

someInstance.__proto__        — legacy accessor exposing someInstance's
someInstance's actual internal — internal [[Prototype]] slot (what it
[[Prototype]] slot              actually inherits from, right now)

Object.getPrototypeOf(x)      — the modern, correct way to read [[Prototype]]
                                 (does exactly what __proto__ does, but isn't
                                 deprecated and works even if x has no
                                 __proto__ accessor, e.g. Object.create(null))
```

```js
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function () {
  console.log(`${this.name} makes a sound.`);
};

const dog = new Animal("Rex");

console.log(dog.__proto__ === Animal.prototype);              // true
console.log(Object.getPrototypeOf(dog) === Animal.prototype); // true — prefer this one
console.log(Animal.prototype.constructor === Animal);          // true — circular back-ref
dog.speak(); // "Rex makes a sound." — found via the chain, not on `dog` itself
```

`dog` has no `speak` property of its own. Property lookup walks the chain:

```
dog  →  [[Prototype]]  →  Animal.prototype  →  [[Prototype]]  →  Object.prototype  →  null
own props: {name}          {speak, constructor}                  {toString, hasOwnProperty, ...}

Lookup for "speak":  not on dog → found on Animal.prototype → STOP, use it.
Lookup for "toString": not on dog → not on Animal.prototype → found on Object.prototype.
Lookup for "missing":  not found anywhere → chain ends at null → undefined.
```

### `hasOwnProperty` vs `in`

```js
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function () {};
const dog = new Animal("Rex");

console.log("name" in dog);              // true — walks the whole chain
console.log("speak" in dog);              // true — found on Animal.prototype
console.log(dog.hasOwnProperty("name"));  // true — own property
console.log(dog.hasOwnProperty("speak")); // false — inherited, not own
```

`for...in` loops (without a `hasOwnProperty` guard) iterate **inherited
enumerable properties too** — a classic source of bugs when iterating plain
objects that happen to have custom things attached to their prototype.

### Classes Are (Mostly) Sugar Over This Exact Mechanism

```js
class AnimalClass {
  constructor(name) {
    this.name = name;
  }
  speak() {
    console.log(`${this.name} makes a sound.`);
  }
}

console.log(typeof AnimalClass);                             // "function" — still just a function
console.log(AnimalClass.prototype.speak !== undefined);       // true — same prototype mechanism

// The one real difference worth knowing: class methods are non-enumerable.
function OldStyle() {}
OldStyle.prototype.method = function () {};
console.log(Object.keys(OldStyle.prototype));   // ["method"] — enumerable
console.log(Object.keys(AnimalClass.prototype)); // [] — class methods are hidden from for...in/Object.keys
```

### Staff-Level Awareness: Prototype Pollution

Because the prototype chain is *live and shared*, mutating a built-in's
prototype (or an attacker-controlled merge/deep-clone that walks into
`__proto__`) can inject properties that every object in the program
suddenly appears to inherit — a real, named security vulnerability class
(CVE-tracked, shows up in lodash `merge`/`defaultsDeep` history):

```js
// JSON.parse gives evilPayload a normal OWN property literally named
// "__proto__" — parsing alone does not touch any real prototype.
const evilPayload = JSON.parse('{"__proto__": {"isAdmin": true}}');
const innocentObject = {};
Object.assign(innocentObject, evilPayload); // naive merge, don't do this

console.log(innocentObject.isAdmin); // predict, then run — most people guess wrong
console.log(({}).isAdmin);           // a UNRELATED fresh object — still safe?
```

If you predicted `undefined` for the first line, run it — the real answer
is `true`, and the reason is a genuinely sharp gotcha: `Object.assign`
copies properties via plain assignment (`target[key] = source[key]`), and
assignment to the literal key `"__proto__"` **is** the `Object.prototype`
setter accessor firing — it's not a coincidence-free string key like any
other. So `Object.assign` silently did `innocentObject.__proto__ =
{isAdmin: true}`, actually replacing `innocentObject`'s real prototype.
`Object.assign` is **not** a safe merge against this shape, despite common
belief that it is.

The second line — a brand-new, unrelated `{}` — still logs `undefined`.
This specific payload only hijacked `innocentObject`'s own prototype, not
the shared, global `Object.prototype`. That's still a real, serious bug
(every property/method lookup on `innocentObject` now silently inherits
from attacker-controlled data), just not yet the "every object in the
entire process is compromised" version. That escalation exists too — it
just targets `constructor.prototype` instead of `__proto__` directly, which
actually *does* reach the shared `Object.prototype` (not run here
deliberately, since unlike the demo above, it would corrupt every other
live example on this entire page for the rest of this session).

This is precisely why safe deep-merge utilities explicitly block
`__proto__`/`constructor`/`prototype` keys before ever assigning them, and
why `Object.create(null)` (an object with **no** prototype at all, so there
is no `__proto__` setter to hijack in the first place) is the right choice
for any object holding arbitrary attacker/user-controlled keys — a
lookup map or dictionary built from untrusted input, for example.

---

## The Event Loop

### The Mental Model

JavaScript itself is single-threaded — one call stack, one thing executing
at a time. Async behavior (timers, network responses, promise resolution)
isn't magic parallelism; it's the **runtime** (browser or Node) handing
work back to JS via queues, and a loop that decides when to run it:

```
┌──────────────┐
│  Call Stack   │  ← runs synchronous code, one frame at a time
└──────┬───────┘
       │ empty?
       ▼
┌──────────────────────┐
│  Drain Microtask      │  ← ALL of them, including new ones queued
│  Queue completely     │     while draining (see next section)
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Take ONE Macrotask   │  ← setTimeout/setInterval callback, I/O, etc.
│  (Task) and run it     │
└──────┬───────────────┘
       │
       └──────────► back to top (drain microtasks again, then next task)
```

The rule that matters most: **the call stack must be completely empty**
before the event loop pulls anything from either queue. A running
synchronous function — no matter how it was started — always finishes
before any queued callback gets a turn, even a `setTimeout(fn, 0)`.

```js
console.log("1: sync");
setTimeout(() => console.log("3: timeout, even with 0ms delay"), 0);
console.log("2: sync, still runs before the timeout");
```

`setTimeout(fn, 0)` does not mean "run in 0ms." It means "run as a
macrotask, at least 0ms from now, once the call stack is clear and it's
this task's turn" — which is always *after* all currently-running
synchronous code, no matter how it's written.

### Node Differs — Briefly

Everything above is the **browser/HTML spec** event loop, which is what a
frontend role lives in day to day. Node.js's event loop (libuv) has
distinct phases (`timers → pending callbacks → poll → check → close
callbacks`) and drains its microtask queue **between every callback**, not
once per task — plus Node's `process.nextTick` queue runs with even higher
priority than Promise microtasks. Know that it's different; don't assume
browser event-loop intuition transfers 1:1 to a Node service.

---

## Microtasks vs Macrotasks

### The Classification

```
MACROTASKS ("tasks")          MICROTASKS
- setTimeout / setInterval    - Promise .then/.catch/.finally callbacks
- setImmediate (Node)         - queueMicrotask(fn)
- I/O callbacks                - MutationObserver callbacks
- UI rendering (browser)       - async/await (every `await` is a microtask
- postMessage                    resumption point under the hood)
```

**The rule that decides ordering:** after the current synchronous run
finishes, the engine drains the **entire microtask queue** — including any
new microtasks queued *while* draining — before it's allowed to process
even one macrotask, or let the browser paint a frame.

```js
// Predict the full order before running. This is the single most common
// senior-level JS interview question, verbatim — and the labels below are
// deliberately UN-ordered relative to the source, so predicting them
// actually tests the mechanism, not just "read top to bottom."
console.log("script start");

setTimeout(() => console.log("F: setTimeout"), 0);

Promise.resolve()
  .then(() => console.log("B: first .then — already-resolved promise"))
  .then(() => console.log("D: second .then — chained onto the first"));

queueMicrotask(() => console.log("C: queueMicrotask"));

console.log("script end");
```

Walk the queues by hand. Synchronous code runs first, in source order:
`"script start"`, then — importantly — `Promise.resolve().then(...)` and
`queueMicrotask(...)` only *register* callbacks synchronously, they don't
run them yet, so `"script end"` logs before either fires.

Once the call stack clears, the microtask queue at that moment holds, **in
the order each was registered**: `[first .then callback ("B"), queueMicrotask
callback ("C")]`. The second `.then` ("D") is *not* in that list yet — it
can't run until the promise returned by the first `.then` settles, which
only happens once "B" actually executes.

Draining: run **B** first (front of the queue) → this settles the first
`.then`'s returned promise → which appends **D** to the *end* of the
microtask queue, which at this instant is `["C", "D"]` → run **C** next
(still ahead of D, because D was only just appended) → then run **D** last.
Only once the microtask queue is completely empty does the `setTimeout`
macrotask get a turn: **F** is always last.

Full order: `script start`, `script end`, `B`, `C`, `D`, `F`. If you
predicted `B, D, C` — a very common guess, because `D` reads like it should
follow `B` immediately in the same chain — that's the exact mistake this
exercise exists to catch: `D` isn't queued *when the script runs*, it's
queued *when B finishes*, which is one full microtask-turn later than `C`,
which was already sitting in the queue.

### The Real Production Failure Mode: Microtask Starvation

Because the microtask queue must be **fully drained** before a macrotask or
a repaint can happen, code that keeps re-queueing microtasks from within
microtasks can starve the browser's ability to render *at all* — the page
visibly freezes even though "async" code is technically running:

```js
// DON'T run this one for more than a second — it's deliberately a
// starvation demo. It will make this tab briefly unresponsive.
// let ticks = 0;
// function starve() {
//   ticks++;
//   Promise.resolve().then(starve); // queues ANOTHER microtask, forever
// }
// starve();
```

This is why "just wrap it in a promise" isn't a free performance escape
hatch, and why recursive `.then()` chains that don't eventually bottom out
into a macrotask (a `setTimeout`, an actual I/O wait) are a real, named
class of production incident — the browser literally cannot get to
rendering, or the next `setTimeout`, until your microtasks stop.

### `async`/`await` Is Just Promises, Syntactically

```js
async function demo() {
  console.log("A: sync part of async fn, runs immediately");
  await Promise.resolve();
  console.log("C: after await — this is a microtask, scheduled just like .then()");
}

console.log("start");
demo();
console.log("B: still sync — runs before C, because C is a queued microtask");
```

Order: `start`, `A`, `B`, `C`. Everything before the first `await` runs
synchronously, immediately, in the same tick as the call. `await` doesn't
pause "the program" — it suspends *that function*, schedules the rest of
it as a microtask, and immediately returns control to whoever called
`demo()`, which is precisely why `B` logs before `C`.

---

## Modules

### Why Modules Exist (Beyond "Splitting Files")

A module gives you **file-scoped isolation by default** (nothing is global
unless explicitly exported) plus a **cached, single instance** — a module's
top-level code runs exactly once, no matter how many places `import` it.

```
import "./analytics.js"  in fileA.js  →  analytics.js executes, cached
import "./analytics.js"  in fileB.js  →  SAME cached module, does NOT re-run
```

You can't literally `import`/`export` inside this page's inline JS runner
(that syntax is only valid as a real top-level module, loaded by a real
bundler/browser module loader — not inside a function body), so the syntax
examples below are shown as reference, and the underlying *mechanism*
(singleton caching, live bindings) is demonstrated with runnable
simulations right after.

```
// analytics.js
let events = [];
export function track(name) { events.push(name); }
export function getEvents() { return events; }

// fileA.js
import { track } from "./analytics.js";
track("signup");

// fileB.js
import { getEvents } from "./analytics.js";
console.log(getEvents()); // ["signup"] — SAME module instance, same `events`
```

### Simulating the Module Cache (Runnable)

This is exactly *why* singletons "just work" via modules — no design
pattern needed, the module loader does it for you:

```js
// Simulates what a module loader does: run the module body ONCE, cache
// its exports, return the SAME cached object on every subsequent "import."
const moduleCache = new Map();

function fakeRequire(name, factory) {
  if (moduleCache.has(name)) {
    console.log(`(cache hit — "${name}" body does NOT re-run)`);
    return moduleCache.get(name);
  }
  console.log(`(cache miss — running "${name}" body for the first time)`);
  const exports = factory();
  moduleCache.set(name, exports);
  return exports;
}

function analyticsFactory() {
  let events = []; // this only gets created ONCE
  return {
    track: (name) => events.push(name),
    getEvents: () => events,
  };
}

const a = fakeRequire("analytics", analyticsFactory); // "cache miss"
a.track("signup");
const b = fakeRequire("analytics", analyticsFactory); // "cache hit"
b.track("login");
console.log(a.getEvents()); // ["signup", "login"] — a and b share ONE array
console.log(a === b);       // true — literally the same object
```

### CommonJS vs ES Modules: The Difference That Actually Bites

Both cache modules as singletons (above). Where they genuinely differ is
**live bindings**:

```
CommonJS (require/module.exports):
  Importing gives you a snapshot of module.exports AT IMPORT TIME
  (though if that value is itself an object, mutations to its
  PROPERTIES are still visible — only a full reassignment of
  module.exports after the fact is missed by existing importers).

ES Modules (import/export):
  Named imports are LIVE, READ-ONLY BINDINGS to the exporting module's
  variable, not a value copy of any kind — if the exporting module
  later reassigns the exported variable itself, every importer sees
  the new value immediately, automatically, with no extra plumbing.
```

```js
// Simulating a live binding with a getter — this is conceptually what
// the ES module spec guarantees natively for every named import.
function makeLiveExport() {
  let internalValue = "initial";
  return {
    setValue: (v) => { internalValue = v; },
    get current() {
      return internalValue; // every read reflects the CURRENT value
    },
  };
}

const moduleExport = makeLiveExport();
const snapshotAtImportTime = moduleExport.current; // "initial" — a real ESM
                                                      // import wouldn't even
                                                      // let you do this; it
                                                      // gives you the LIVE
                                                      // getter, not a copy

moduleExport.setValue("changed after import");
console.log("snapshot:", snapshotAtImportTime);      // "initial" — stale, by design of THIS demo
console.log("live read:", moduleExport.current);      // "changed after import"
```

This is why circular ESM imports can work in cases where circular CJS
`require`s historically returned a half-populated (or literally empty)
object: with live bindings, module A can `import { b } from "./b.js"` even
while B is still initializing, as long as B's export is only *read* after
both modules finish loading — the binding updates itself once B assigns it.

### Practical Consequences Worth Knowing

- **Tree-shaking** (dead code elimination) requires ESM's static
  `import`/`export` structure — bundlers can prove at build time exactly
  what's used. CommonJS's `require(dynamicPath)` can happen conditionally
  at runtime, so a bundler can't always statically prove what's unused.
- `import()` (the function-call form) returns a **Promise** and is how
  code-splitting works — it's a dynamic, async module load, unlike static
  `import` statements which are hoisted and resolved before any other code
  in the file runs.
- A module's top-level `import` statements are hoisted above everything
  else in the file, including other hoisted `function` declarations — all
  of a module's dependencies are guaranteed to be resolved before a single
  line of that module's own body executes.

---

## Interview Questions

Rapid-fire, senior/staff calibrated — the goal isn't reciting a definition,
it's whether you can predict *behavior* and explain the mechanism underneath
it, the way every runnable example above asked you to.

**Q: `var i` vs `let i` in a `for` loop with a `setTimeout` inside it — what's the actual difference, mechanically?**
`var` is function/global-scoped, so there's one shared binding across all
iterations; by the time any callback fires, the loop has finished and the
variable holds its final value. `let` creates a fresh binding *per
iteration*, so each closure captures a different variable, not a different
value of the same variable.

**Q: Is `let` hoisted?**
Yes — the binding is created during the creation phase, exactly like `var`.
The difference is `var` is also *initialized* to `undefined` at that point;
`let`/`const` are left in the Temporal Dead Zone and throw a
`ReferenceError` if touched before their declaration line actually executes.

**Q: Why does `this` break when you pass `obj.method` as a callback?**
`this` is determined by the call site, not the definition site (arrow
functions excepted). Passing `obj.method` as a bare reference detaches it
from `obj` — when the callback later runs as `fn()` with no receiver,
default binding applies, not implicit binding, so `this` is `undefined`
(strict) or the global object (sloppy) — not `obj`.

**Q: Difference between `call`, `apply`, and `bind`?**
`call`/`apply` invoke immediately, differing only in how arguments are
passed (individually vs as an array); `bind` doesn't invoke at all — it
returns a new function permanently bound to a given `this`, callable later.

**Q: Walk through this exact order: sync log, `setTimeout`, `Promise.then`, sync log.**
Both async operations are deferred until the synchronous code finishes.
Between the sync code finishing and the next macrotask running, the
*entire* microtask queue drains first — so the Promise callback always logs
before the `setTimeout` callback, regardless of the `setTimeout` delay
(even `0`), because macrotasks only get a turn once microtasks are fully
drained.

**Q: What's actually different between `Object.getPrototypeOf(x)`, `x.__proto__`, and `Constructor.prototype`?**
`Object.getPrototypeOf(x)` and `x.__proto__` both read the *same* internal
`[[Prototype]]` slot on an instance — `__proto__` is just the legacy,
deprecated accessor for it. `Constructor.prototype` is a completely
different object: it lives on the *constructor function*, and is the object
that *becomes* `[[Prototype]]` for instances that constructor creates via
`new`.

**Q: Why can recursive `.then()` chains freeze a page even though the code is "async"?**
The event loop must fully drain the microtask queue before it's allowed to
run a macrotask *or* let the browser paint a frame. A `.then()` callback
that queues another `.then()` indefinitely never lets the microtask queue
finish draining, so nothing else — no timers, no rendering — gets a turn.

**Q: What's the real difference between a CommonJS `require` and an ES Module `import`, beyond syntax?**
Both cache the module as a singleton after first execution. The meaningful
difference is that ESM named imports are live, read-only bindings to the
exporting module's variable — if the exporter later reassigns that
variable, every importer sees the update automatically. CommonJS gives you
a reference to the `module.exports` object at require time; you'll see
mutations to that object's properties, but not a full reassignment of
`module.exports` made after your `require` call already ran.

**Q: Does tail-call optimization make deep recursion safe in a browser?**
No — it's specified in ES2015, but V8 (Chrome, Node) and most engines other
than JavaScriptCore (Safari) never implemented it. Assume recursion depth
is bounded by the real call stack size in production code; use iteration
or trampolining for genuinely unbounded depth.
