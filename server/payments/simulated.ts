import type { PaymentStatus } from "../store";
import { hmac, safeEqual } from "../util";
import type { CheckoutRequest, CheckoutResult, PaymentProvider, WebhookResult } from "./provider";

/**
 * Test provider used by default: no external account, no real money. The
 * checkout "page" is Jokko's own /pay/sim/<ref> screen; approving there sends
 * a signed notification through the exact same webhook pipeline PayDunya
 * uses, so the whole flow (confirmation, alert, goal, rank) is exercised.
 */
export class SimulatedProvider implements PaymentProvider {
  readonly name = "simulated";
  readonly livemode = false;
  private outcomes = new Map<string, PaymentStatus>();

  constructor(private secret: string) {}

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    const providerToken = `sim_${req.ref}`;
    this.outcomes.set(providerToken, "pending");
    return { redirectUrl: `/pay/sim/${encodeURIComponent(req.ref)}`, providerToken };
  }

  sign(providerToken: string, status: PaymentStatus): string {
    return hmac(this.secret, `sim:${providerToken}:${status}`);
  }

  /** Builds the notification the simulator page triggers. */
  notification(providerToken: string, status: PaymentStatus) {
    this.outcomes.set(providerToken, status);
    return { token: providerToken, status, signature: this.sign(providerToken, status) };
  }

  async parseWebhook(body: unknown): Promise<WebhookResult | null> {
    const b = body as { token?: unknown; status?: unknown; signature?: unknown };
    if (typeof b?.token !== "string" || typeof b.status !== "string" || typeof b.signature !== "string") return null;
    const status = b.status as PaymentStatus;
    if (!["completed", "failed", "cancelled"].includes(status)) return null;
    if (!safeEqual(b.signature, this.sign(b.token, status))) return null;
    return { providerToken: b.token, status };
  }

  async checkStatus(providerToken: string): Promise<PaymentStatus> {
    return this.outcomes.get(providerToken) ?? "pending";
  }
}
