// Shared data generation for all versions
// Simulates a realistic dataset with variable content lengths

export interface Item {
  id: number;
  name: string;
  email: string;
  company: string;
  description: string;
  status: "active" | "inactive" | "pending";
  avatar: string;
  tags: string[];
}

const COMPANIES = [
  "Acme Corp", "Globex", "Initech", "Umbrella Inc", "Stark Industries",
  "Wayne Enterprises", "Cyberdyne", "Aperture Science", "Massive Dynamic",
  "Oscorp", "LexCorp", "Weyland-Yutani", "Soylent Corp", "Tyrell Corp",
];

const TAGS = [
  "engineering", "design", "product", "marketing", "sales",
  "support", "devops", "security", "data", "mobile",
];

const STATUSES: Item["status"][] = ["active", "inactive", "pending"];

const DESCRIPTIONS = [
  "Short bio.",
  "A slightly longer description that spans a couple of lines when rendered in a typical list item.",
  "This is a much longer description that simulates real-world content variability. In production, user-generated content varies wildly in length, and your virtualization solution must handle this gracefully without layout shifts or jitter. This kind of content is what breaks naive fixed-height assumptions.",
  "Medium length description for testing.",
  "Another variable-length piece of text that tests how well the virtualized list handles dynamic content heights. This is particularly important when using VariableSizeList or measurement-based approaches.",
];

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) & 0xffffffff;
    return (state >>> 0) / 0xffffffff;
  };
}

export function generateItems(count: number): Item[] {
  const rand = seededRandom(42); // deterministic for consistent benchmarks
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    name: `User ${i}`,
    email: `user${i}@example.com`,
    company: COMPANIES[Math.floor(rand() * COMPANIES.length)],
    description: DESCRIPTIONS[Math.floor(rand() * DESCRIPTIONS.length)],
    status: STATUSES[Math.floor(rand() * STATUSES.length)],
    avatar: `https://api.dicebear.com/7.x/initials/svg?seed=User${i}&size=40`,
    tags: Array.from(
      { length: 1 + Math.floor(rand() * 3) },
      () => TAGS[Math.floor(rand() * TAGS.length)]
    ),
  }));
}

// Pre-generate datasets of different sizes for benchmarking
export const SMALL_DATASET = generateItems(100);
export const MEDIUM_DATASET = generateItems(5_000);
export const LARGE_DATASET = generateItems(50_000);
