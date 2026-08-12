import type { TerangaEvent } from "@/types";

export interface QueuedAlertHandler {
  /** Renders the alert and resolves once it has fully played out and can be dismissed. */
  play(event: TerangaEvent): Promise<void>;
}

const MAX_QUEUE_LENGTH = 6;

/**
 * Alerts must never overlap on screen (spec: "Limiter les alertes simultanées
 * et prévoir une file d'attente"). One alert plays at a time; if the queue
 * grows past MAX_QUEUE_LENGTH we drop the oldest low-priority entries first
 * so a gift spam burst can't lock the overlay in a multi-minute backlog.
 */
export class AlertQueue {
  private queue: TerangaEvent[] = [];
  private playing = false;
  private handler: QueuedAlertHandler | null = null;

  attach(handler: QueuedAlertHandler) {
    this.handler = handler;
  }

  push(event: TerangaEvent) {
    this.queue.push(event);
    if (this.queue.length > MAX_QUEUE_LENGTH) {
      const dropIndex = this.queue.findIndex((e) => e.type !== "raid" && e.type !== "victory" && e.type !== "defeat");
      if (dropIndex >= 0) this.queue.splice(dropIndex, 1);
    }
    void this.drain();
  }

  clear() {
    this.queue = [];
  }

  get length() {
    return this.queue.length;
  }

  private async drain() {
    if (this.playing || !this.handler) return;
    this.playing = true;
    while (this.queue.length > 0) {
      const next = this.queue.shift()!;
      try {
        await this.handler.play(next);
      } catch {
        /* a broken alert render must not stall the whole queue */
      }
    }
    this.playing = false;
  }
}

export const alertQueue = new AlertQueue();
