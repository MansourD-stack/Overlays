import type { PaymentStatus } from "../store";
import { HttpError } from "../util";
import type { CheckoutRequest, CheckoutResult, PaymentProvider, WebhookResult } from "./provider";

export interface CinetPayKeys {
  apiKey: string;
  siteId: string;
  /** CinetPay uses the same endpoints for test and live; this flag only tells Jokko whether money is real. */
  mode: "test" | "live";
}

type FetchLike = typeof fetch;
const BASE = "https://api-checkout.cinetpay.com/v2";

function mapStatus(status: unknown): PaymentStatus {
  switch (status) {
    case "ACCEPTED":
      return "completed";
    case "REFUSED":
      return "failed";
    case "CANCELED":
    case "CANCELLED":
      return "cancelled";
    default:
      return "pending";
  }
}

/**
 * CinetPay (backup aggregator, multi-country UEMOA).
 *  - init : POST /v2/payment → { code: "201", data: { payment_url } }
 *  - check: POST /v2/payment/check → { code: "00", data: { status, amount } }
 *  - notification: POST form-encoded with cpm_trans_id / cpm_site_id. It is
 *    never trusted as such: the status and amount are always re-read through
 *    `check` with our own API key before anything is credited.
 */
export class CinetPayProvider implements PaymentProvider {
  readonly name = "cinetpay";
  readonly livemode: boolean;

  constructor(
    private keys: CinetPayKeys,
    private fetchImpl: FetchLike = fetch
  ) {
    this.livemode = keys.mode === "live";
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    if (req.amount % 5 !== 0) throw new HttpError(400, "Avec ce moyen de paiement, le montant doit être un multiple de 5 F.", "amount_not_multiple_of_5");
    const res = await this.fetchImpl(`${BASE}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        apikey: this.keys.apiKey,
        site_id: this.keys.siteId,
        transaction_id: req.ref,
        amount: req.amount,
        currency: "XOF",
        description: req.description.replace(/[^\p{L}\p{N} .,'-]/gu, " ").slice(0, 120),
        notify_url: req.callbackUrl,
        return_url: req.returnUrl,
        channels: "ALL",
        lang: "fr",
        metadata: req.method,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { code?: string; data?: { payment_url?: string } };
    if (json.code !== "201" || !json.data?.payment_url) throw new Error(`CinetPay a refusé l'initialisation (${json.code ?? res.status}).`);
    return { redirectUrl: json.data.payment_url, providerToken: req.ref };
  }

  async parseWebhook(body: unknown): Promise<WebhookResult | null> {
    const b = body as Record<string, unknown>;
    const transactionId = typeof b?.cpm_trans_id === "string" ? b.cpm_trans_id : null;
    if (!transactionId || String(b.cpm_site_id ?? "") !== this.keys.siteId) return null;
    const checked = await this.check(transactionId);
    return { providerToken: transactionId, status: checked.status, amount: checked.amount };
  }

  async checkStatus(providerToken: string): Promise<PaymentStatus> {
    return (await this.check(providerToken)).status;
  }

  private async check(transactionId: string): Promise<{ status: PaymentStatus; amount?: number }> {
    const res = await this.fetchImpl(`${BASE}/payment/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({ apikey: this.keys.apiKey, site_id: this.keys.siteId, transaction_id: transactionId }),
    });
    const json = (await res.json().catch(() => ({}))) as { code?: string; data?: { status?: string; amount?: unknown } };
    if (!json.data) return { status: "pending" };
    const amount = Number(json.data.amount);
    return { status: mapStatus(json.data.status), amount: Number.isFinite(amount) ? amount : undefined };
  }
}
