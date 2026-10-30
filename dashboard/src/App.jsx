import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import CodeBlock from "./CodeBlock.jsx";
import JsConsoleBlock from "./JsConsoleBlock.jsx";
import { topics, externalTopic } from "./topics.js";

// react-markdown wraps every fenced block in <pre><code>. The live blocks
// render their own box (CodeBlock / JsConsoleBlock) and need that <pre>
// unwrapped, but plain fenced blocks (ASCII diagrams, no language) still
// need a real <pre> to preserve line breaks/whitespace — unwrapping those
// too was flattening every diagram into a single run-on paragraph.
const LIVE_COMPONENTS = [CodeBlock, JsConsoleBlock];
function isLiveCodeBlock(children) {
  const child = Array.isArray(children) ? children[0] : children;
  return LIVE_COMPONENTS.includes(child?.type);
}

const markdownComponents = {
  pre: ({ children }) =>
    isLiveCodeBlock(children) ? (
      children
    ) : (
      <pre className="static-code">{children}</pre>
    ),
  code({ className, children }) {
    const match = /language-(\w+)/.exec(className || "");
    const lang = match?.[1];
    const text = String(children).replace(/\n$/, "");
    // jsx = React example (live-rendered UI). js = plain JS (run for its
    // console output — closures, event loop, prototypes, etc. don't have a
    // UI to render).
    if (lang === "jsx") return <CodeBlock language={lang} code={text} />;
    if (lang === "js") return <JsConsoleBlock code={text} />;
    // Single-line, no-language spans are true inline code (`x`); anything
    // with a newline is a fenced block, even without a language tag.
    if (!match && !text.includes("\n")) {
      return <code className="inline-code">{children}</code>;
    }
    return <code>{children}</code>;
  },
};

// Preserve category order by first appearance in `topics`, not alphabetical.
function groupByCategory(list) {
  const order = [];
  const groups = {};
  for (const t of list) {
    if (!groups[t.category]) {
      groups[t.category] = [];
      order.push(t.category);
    }
    groups[t.category].push(t);
  }
  return order.map((category) => ({ category, items: groups[category] }));
}

export default function App() {
  const [activeId, setActiveId] = useState(topics[0].id);
  const active = topics.find((t) => t.id === activeId);
  const groups = groupByCategory(topics);

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="logo">
          <div className="logo-title">Frontend Deep Dives</div>
          <div className="logo-sub">Read the theory, run the code</div>
        </div>

        {groups.map(({ category, items }) => (
          <div key={category} className="nav-group">
            <div className="nav-group-label">{category}</div>
            {items.map((t) => (
              <button
                key={t.id}
                className={"nav-btn" + (activeId === t.id ? " active" : "")}
                onClick={() => setActiveId(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        ))}

        <div className="nav-divider" />

        <div className="nav-btn external">
          <div>{externalTopic.label}</div>
          <div className="external-desc">{externalTopic.description}</div>
          <code className="run-cmd">{externalTopic.runCommand}</code>
        </div>
      </nav>

      <main className={active.type === "tool" ? "content content-tool" : "content"}>
        {active.type === "tool" ? (
          <active.component />
        ) : (
          <>
            <p className="hint">
              Every code snippet below is editable. <code>jsx</code>{" "}
              snippets are React examples — edit and the live preview on the
              right updates immediately. <code>js</code> snippets are plain
              JavaScript — press ▶ Run to execute them and see real console
              output (correct real-world async ordering, since it actually
              runs). Some snippets illustrate APIs (Next.js, react-query,
              react-router) or reference something from elsewhere on the
              page; those will show an error, which is expected.
            </p>
            <ReactMarkdown
              key={active.id}
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSlug]}
              components={markdownComponents}
            >
              {active.content}
            </ReactMarkdown>
          </>
        )}
      </main>
    </div>
  );
}
