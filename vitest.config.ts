import { defineConfig } from "vitest/config";

// Separate from vite.config.ts so tests never boot the Jokko dev plugin
// (which would create a data/ directory and bind the realtime bridge).
export default defineConfig({
  test: {
    include: ["server/test/**/*.test.ts"],
    environment: "node",
  },
});
