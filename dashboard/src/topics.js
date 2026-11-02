import memoization from "../../react-memoization-deep-dive.md?raw";
import stateManagement from "../../react-state-management.md?raw";
import renderCommit from "../../react-render-commit-phase.md?raw";
import renderingStrategies from "../../rendering-strategies-deep-dive.md?raw";
import jsFundamentalsDay1 from "../../javascript-fundamentals-day1.md?raw";
import asyncFundamentals from "../../async-fundamentals-deep-dive.md?raw";
import dsaArraysStringsHashmaps from "../../dsa-arrays-strings-hashmaps.md?raw";
import dsaSlidingWindowTwoPointers from "../../dsa-sliding-window-two-pointers.md?raw";
import dsaBinarySearch from "../../dsa-binary-search.md?raw";
import dsaTreesBfsDfs from "../../dsa-trees-bfs-dfs.md?raw";
import dsaStacksQueuesLinkedLists from "../../dsa-stacks-queues-linked-lists.md?raw";
import systemDesignExercises from "../../system-design-exercises.md?raw";
import EventLoopVisualizer from "./eventloop/EventLoopVisualizer.jsx";

export const topics = [
  {
    id: "js-fundamentals-day1",
    label: "Day 1: JS Fundamentals",
    category: "JavaScript",
    content: jsFundamentalsDay1,
  },
  {
    id: "async-fundamentals",
    label: "Async: Promises → Async Iterators",
    category: "JavaScript",
    content: asyncFundamentals,
  },
  {
    id: "event-loop-visualizer",
    label: "Event Loop Visualizer",
    category: "JavaScript",
    type: "tool",
    component: EventLoopVisualizer,
  },
  {
    id: "memoization",
    label: "Memoization",
    category: "React",
    content: memoization,
  },
  {
    id: "state-management",
    label: "State Management",
    category: "React",
    content: stateManagement,
  },
  {
    id: "render-commit",
    label: "Render vs Commit Phase",
    category: "React",
    content: renderCommit,
  },
  {
    id: "rendering-strategies",
    label: "Rendering Strategies",
    category: "React",
    content: renderingStrategies,
  },
  {
    id: "dsa-arrays-strings-hashmaps",
    label: "1. Arrays, Strings & Hash Maps",
    category: "DSA",
    content: dsaArraysStringsHashmaps,
  },
  {
    id: "dsa-sliding-window-two-pointers",
    label: "2. Sliding Window & Two Pointers",
    category: "DSA",
    content: dsaSlidingWindowTwoPointers,
  },
  {
    id: "dsa-binary-search",
    label: "3. Binary Search",
    category: "DSA",
    content: dsaBinarySearch,
  },
  {
    id: "dsa-trees-bfs-dfs",
    label: "4. Trees, BFS & DFS",
    category: "DSA",
    content: dsaTreesBfsDfs,
  },
  {
    id: "dsa-stacks-queues-linked-lists",
    label: "5. Stacks, Queues & Linked Lists",
    category: "DSA",
    content: dsaStacksQueuesLinkedLists,
  },
  {
    id: "system-design-exercises",
    label: "4 Exercises",
    category: "System Design",
    content: systemDesignExercises,
  },
];

// Virtualization already has its own full V1→V8 practice app instead of a
// single markdown doc — link out to it rather than duplicating it here.
export const externalTopic = {
  id: "virtualization",
  label: "Virtualization (V1 → V8)",
  runCommand: "cd react-virtualization-deep-dive && npm install && npm run dev",
  description:
    "Separate Vite app with 8 progressively better implementations of a virtualized list — from a naive .map() to react-window, @tanstack/virtual, infinite scroll, and a production-grade version.",
};
