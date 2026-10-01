import { defineConfig, type Plugin } from "vite";
import { resolve } from "path";
import { loadDotEnv, readConfig } from "./server/config";
import { PROTECTED_PAGES, createJokkoApp, pageFor } from "./server/app";

const root = import.meta.dirname;

/**
 * Mounts the whole Jokko server (API, payment webhooks, realtime bridge) on
 * the Vite dev server — `npm run dev` stays the single command a streamer
 * needs. Production uses the same code through server/main.ts.
 */
function jokkoPlugin(): Plugin {
  return {
    name: "jokko-server",
    configureServer(server) {
      loadDotEnv(root);
      const app = createJokkoApp(readConfig(root));
      server.httpServer?.on("upgrade", (req, socket, head) => app.hub.handleUpgrade(req, socket, head));
      server.httpServer?.on("close", () => app.close());

      server.middlewares.use((req, res, next) => {
        app
          .handle(req, res)
          .then((handled) => {
            if (handled) return;
            const pathname = (req.url ?? "/").split("?")[0];
            const page = pageFor(pathname);
            if (page) {
              if (PROTECTED_PAGES.has(page)) res.setHeader("X-Frame-Options", "DENY");
              req.url = `/${page}${(req.url ?? "").slice(pathname.length)}`;
            }
            next();
          })
          .catch(next);
      });
      const provider = app.provider;
      server.httpServer?.once("listening", () => {
        setTimeout(() => {
          console.log(`  Jokko : paiements ${provider.name}${provider.livemode ? " (RÉEL)" : " (mode test)"} · tableau de bord → /dashboard\n`);
        }, 50);
      });
    },
  };
}

export default defineConfig({
  plugins: [jokkoPlugin()],
  resolve: {
    alias: {
      "@": resolve(root, "src"),
      "@config": resolve(root, "config"),
    },
  },
  build: {
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
  server: {
    // Local only by default: the dev server holds accounts and payment state.
    // Set VITE_HOST=0.0.0.0 to test from a phone on the same Wi-Fi.
    host: process.env.VITE_HOST || "localhost",
    port: 5173,
  },
});
