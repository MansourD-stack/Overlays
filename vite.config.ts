import { defineConfig, type Plugin } from "vite";
import { resolve } from "path";
import { WebSocketServer, type WebSocket } from "ws";

const BRIDGE_PATH = "/overlay-bridge";

/**
 * Local event bridge: relays events between the control panel and every
 * open overlay scene (OBS/TikTok LIVE Studio Browser Sources included).
 * Runs on the same HTTP server Vite already binds — no extra port, so
 * `npm run dev` remains the single command needed to start everything.
 */
function overlayBridgePlugin(): Plugin {
  return {
    name: "overlay-bridge",
    configureServer(server) {
      const wss = new WebSocketServer({ noServer: true });
      const clients = new Set<WebSocket>();

      server.httpServer?.on("upgrade", (req, socket, head) => {
        if (!req.url?.startsWith(BRIDGE_PATH)) return;
        wss.handleUpgrade(req, socket, head, (ws) => {
          clients.add(ws);
          ws.on("close", () => clients.delete(ws));
          ws.on("message", (data) => {
            for (const client of clients) {
              if (client !== ws && client.readyState === client.OPEN) {
                client.send(data.toString());
              }
            }
          });
        });
      });

      // Serve the control panel at the clean URL the spec asks for: /control
      server.middlewares.use((req, _res, next) => {
        if (req.url === "/control" || req.url?.startsWith("/control?")) {
          req.url = req.url.replace("/control", "/control.html");
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === "/control" || req.url?.startsWith("/control?")) {
          req.url = req.url.replace("/control", "/control.html");
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [overlayBridgePlugin()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
      "@config": resolve(import.meta.dirname, "config"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        control: resolve(import.meta.dirname, "control.html"),
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
