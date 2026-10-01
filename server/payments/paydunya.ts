import { createHash } from "node:crypto";
import type { PayDunyaKeys } from "../config";
import type { PaymentMethod, PaymentStatus } from "../store";
import { safeEqual } from "../util";
import type { CheckoutRequest, CheckoutResult, PaymentProvider, WebhookResult } from "./provider";

/** PayDunya channel ids for Senegalese wallets — restricts the hosted
 *  checkout to the method the fan already picked on the Jokko page. */
const CHANNELS: Record<PaymentMethod, string> = {
  wave: "wave-senegal",
  "orange-money": "orange-money-senegal",
  "free-money": "free-money-senegal",
};

type FetchLike = typeof fetch;

function mapStatus(status: unknown): PaymentStatus {
  switch (status) {
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    case "failed":
      return "failed";
    default:
      return "pending";
  }
}

/**
 * PayDunya "Checkout Invoice" integration (HTTP/JSON API).
 *  - create : POST {base}/checkout-invoice/create → { response_code: "00", response_text: <checkout url>, token }
 *  - confirm: GET  {base}/checkout-invoice/confirm/{token} → { status, invoice: { total_amount } }
 *  - IPN    : POST to callback_url, form-encoded `data[...]`, authenticated by
 *             data[hash] = SHA-512(master key). We also re-confirm through the
 *             API before crediting anything (defence in depth).
 * Keys come exclusively from environment variables (see .env.example).
 */
export class PayDunyaProvider implements PaymentProvider {
  readonly name = "paydunya";
  readonly livemode: boolean;
  private base: string;
  private expectedHash: string;

  constructor(
    private keys: PayDunyaKeys,
    private storeName = "Jokko",
    private fetchImpl: FetchLike = fetch
  ) {
    this.livemode = keys.mode === "live";
    this.base = keys.mode === "live" ? "https://app.paydunya.com/api/v1" : "https://app.paydunya.com/sandbox-api/v1";
    this.expectedHash = createHash("sha512").update(keys.masterKey).digest("hex");
  }

  private headers() {
    return {
      "Content-Type": "application/json",
      "PAYDUNYA-MASTER-KEY": this.keys.masterKey,
      "PAYDUNYA-PRIVATE-KEY": this.keys.privateKey,
      "PAYDUNYA-TOKEN": this.keys.token,
    };
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    const res = await this.fetchImpl(`${this.base}/checkout-invoice/create`, {
      method: "POST",
      headers: this.headers(),
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        invoice: { total_amount: req.amount, description: req.description },
        store: { name: this.storeName },
        channels: [CHANNELS[req.method]],
        custom_data: { jokko_ref: req.ref },
        actions: { cancel_url: req.cancelUrl, return_url: req.returnUrl, callback_url: req.callbackUrl },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { response_code?: string; response_text?: string; token?: string };
    if (json.response_code !== "00" || !json.token || !json.response_text) {
      throw new Error(`PayDunya a refusé la création de facture (${json.response_code ?? res.status}).`);
    }
    return { redirectUrl: json.response_text, providerToken: json.token };
  }

  async parseWebhook(body: unknown): Promise<WebhookResult | null> {
    const data = (body as { data?: Record<string, unknown> })?.data;
    if (!data || typeof data.hash !== "string") return null;
    if (!safeEqual(data.hash.toLowerCase(), this.expectedHash)) return null;
    const invoice = data.invoice as { token?: unknown } | undefined;
    const token = typeof invoice?.token === "string" ? invoice.token : null;
    if (!token) return null;
    // Never trust the notification's status alone — ask PayDunya.
    const confirmed = await this.confirm(token);
    return { providerToken: token, status: confirmed.status, amount: confirmed.amount };
  }

  async checkStatus(providerToken: string): Promise<PaymentStatus> {
    return (await this.confirm(providerToken)).status;
  }

  private async confirm(token: string): Promise<{ status: PaymentStatus; amount?: number }> {
    const res = await this.fetchImpl(`${this.base}/checkout-invoice/confirm/${encodeURIComponent(token)}`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(8_000),
    });
    const json = (await res.json().catch(() => ({}))) as { response_code?: string; status?: string; invoice?: { total_amount?: unknown } };
    if (json.response_code !== "00") return { status: "pending" };
    const amount = Number(json.invoice?.total_amount);
    return { status: mapStatus(json.status), amount: Number.isFinite(amount) ? amount : undefined };
  }
}
