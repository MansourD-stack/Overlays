import { defineConfig } from "vite";
import { resolve } from "path";

const root = import.meta.dirname;

/**
 * Browser-only demo: `npm run build:demo` → dist-demo/. Same pages as the
 * product, with src/demo/install.ts standing in for the Jokko server
 * (in-browser data, simulated payments, BroadcastChannel instead of the
 * WebSocket relay). Relative paths, so it works from any static host.
 */
export default defineConfig({
  base: "./",
  define: { "import.meta.env.VITE_JOKKO_DEMO": JSON.stringify("1") },
  resolve: {
    alias: {
      "@demo-install": resolve(root, "src/demo/install.ts"),
      "@": resolve(root, "src"),
      "@config": resolve(root, "config"),
    },
  },
  build: {
    outDir: "dist-demo",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        control: resolve(root, "control.html"),
        dashboard: resolve(root, "dashboard.html"),
        support: resolve(root, "support.html"),
        paySim: resolve(root, "pay-sim.html"),
        admin: resolve(root, "admin.html"),
      },
    },
  },
});
