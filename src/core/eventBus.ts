import type { BridgeMessage } from "@/types";

type Handler = (message: BridgeMessage) => void;

/**
 * Local event bus. Connects to the WebSocket bridge (attached to the Vite
 * dev server, see vite.config.ts) so /control can drive every open overlay
 * scene in real time. If the bridge is unreachable (e.g. the static build is
 * opened without `npm run dev`) the bus degrades to a same-tab-only
 * simulation mode instead of throwing — a scene must never hard-fail just
 * because nothing is broadcasting to it.
 */
class TerangaEventBus {
  private socket: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private reconnectDelay = 1000;
  private connected = false;

  connect() {
    if (this.socket) return;
    try {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      this.socket = new WebSocket(`${proto}://${window.location.host}/overlay-bridge`);
      this.socket.addEventListener("open", () => {
        this.connected = true;
        this.reconnectDelay = 1000;
      });
      this.socket.addEventListener("message", (ev) => {
        try {
          const message = JSON.parse(ev.data) as BridgeMessage;
          for (const handler of this.handlers) handler(message);
        } catch {
          /* ignore malformed frames */
        }
      });
      this.socket.addEventListener("close", () => {
        this.connected = false;
        this.socket = null;
        setTimeout(() => this.connect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 15000);
      });
      this.socket.addEventListener("error", () => this.socket?.close());
    } catch {
      this.connected = false;
    }
  }

  get isConnected() {
    return this.connected;
  }

  send(message: BridgeMessage) {
    // Deliver to same-tab listeners regardless (covers simulation mode / control-panel self-preview).
    for (const handler of this.handlers) handler(message);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  on(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
}

export const eventBus = new TerangaEventBus();
