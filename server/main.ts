/**
 * Production entry point: `npm run build && npm start`.
 * Serves the built overlay/control/dashboard/support pages, the Jokko API and
 * the realtime bridge on a single port (PORT, default 8080).
 */
import { createServer } from "node:http";
import { loadDotEnv, readConfig } from "./config";
import { createJokkoApp } from "./app";
import { distDir, serveStatic } from "./static";

const root = process.cwd();
loadDotEnv(root);
const cfg = readConfig(root, process.env, "production");
const app = createJokkoApp(cfg);
const dist = distDir(root);

const server = createServer((req, res) => {
  app
    .handle(req, res)
    .then((handled) => {
      if (!handled) serveStatic(dist, req, res);
    })
    .catch((err) => {
      console.error("[jokko]", err);
      if (!res.headersSent) res.writeHead(500).end();
    });
});
app.hub.attach(server);

const port = Number(process.env.PORT) || 8080;
server.listen(port, () => {
  console.log(`\n  Jokko prêt sur http://localhost:${port}`);
  console.log(`  Paiements : ${app.provider.name}${app.provider.livemode ? " (RÉEL)" : " (mode test, aucun argent réel)"}`);
  if (cfg.provider === "paydunya" && !cfg.publicUrl) console.warn("  ⚠ JOKKO_PUBLIC_URL non défini : PayDunya ne pourra pas joindre le webhook.");
  if (!cfg.adminToken) console.log("  (JOKKO_ADMIN_TOKEN non défini : API d'administration des retraits désactivée)");
});

function shutdown() {
  app.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
