import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import type { Store } from "./store";
import { SESSION_COOKIE, parseCookies, streamerForSession } from "./auth";

export const BRIDGE_PATH = "/overlay-bridge";
export const LOCAL_CHANNEL = "local";

interface Client {
  ws: WebSocket;
  channel: string;
  /** Overlays (joined with their read-only key) only listen; the streamer's
   *  logged-in control panel — or the local single-streamer mode — may send. */
  canSend: boolean;
  alive: boolean;
}

/**
 * Channel-scoped WebSocket relay. Each streamer gets an isolated channel:
 * their overlays, their /control panel and server-side events (payments)
 * meet there. A leaked overlay URL lets someone watch the overlay, never
 * inject fake alerts.
 */
/** Lets the app veto/rewrite a controller message before it is relayed (plan
 *  limits) and persist it (hosted overlay settings). Return null to drop it. */
export type ControllerFilter = (channel: string, message: Record<string, unknown>) => Record<string, unknown> | null;

export class RealtimeHub {
  filter: ControllerFilter | null = null;
  private wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  private clients = new Set<Client>();
  private heartbeat: NodeJS.Timeout;

  constructor(
    private store: Store,
    private allowLocal: boolean
  ) {
    this.heartbeat = setInterval(() => {
      for (const c of this.clients) {
        if (!c.alive) {
          c.ws.terminate();
          continue;
        }
        c.alive = false;
        c.ws.ping();
      }
    }, 30_000);
    this.heartbeat.unref();
  }

  private resolve(req: IncomingMessage): { channel: string; canSend: boolean } | null {
    const url = new URL(req.url ?? "/", "http://x");
    const key = url.searchParams.get("key");
    if (key) {
      const streamer = this.store.streamerByOverlayKey(key);
      return streamer ? { channel: streamer.id, canSend: false } : null;
    }
    const streamer = streamerForSession(this.store, parseCookies(req.headers.cookie)[SESSION_COOKIE]);
    if (streamer) return { channel: streamer.id, canSend: true };
    return this.allowLocal ? { channel: LOCAL_CHANNEL, canSend: true } : null;
  }

  /** Returns true when the upgrade request was for the bridge (handled or rejected). */
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): boolean {
    if (!req.url?.startsWith(BRIDGE_PATH)) return false;
    const target = this.resolve(req);
    if (!target) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return true;
    }
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      const client: Client = { ws, ...target, alive: true };
      this.clients.add(client);
      ws.on("pong", () => (client.alive = true));
      ws.on("close", () => this.clients.delete(client));
      ws.on("error", () => ws.terminate());
      ws.on("message", (data) => {
        if (!client.canSend) return;
        let text = data.toString();
        if (this.filter && client.channel !== LOCAL_CHANNEL) {
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(text);
          } catch {
            return;
          }
          if (!parsed || typeof parsed !== "object") return;
          const next = this.filter(client.channel, parsed);
          if (!next) return;
          text = JSON.stringify(next);
        }
        for (const other of this.clients) {
          if (other !== client && other.channel === client.channel && other.ws.readyState === other.ws.OPEN) other.ws.send(text);
        }
      });
    });
    return true;
  }

  attach(server: Pick<Server, "on">) {
    server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      this.handleUpgrade(req, socket, head);
    });
  }

  publish(channel: string, message: unknown) {
    const text = JSON.stringify(message);
    for (const c of this.clients) if (c.channel === channel && c.ws.readyState === c.ws.OPEN) c.ws.send(text);
  }

  close() {
    clearInterval(this.heartbeat);
    for (const c of this.clients) c.ws.terminate();
    this.wss.close();
  }
}
