import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dashboard reads the markdown files living one level up (repo root) via
// `?raw` imports, so Vite's dev server needs permission to serve outside
// the project root. ponytail: single-repo tool, no path allowlist needed.
export default defineConfig({
  plugins: [react()],
  server: {
    fs: { allow: [".."] },
  },
});
