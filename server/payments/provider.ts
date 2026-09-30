import type { PaymentMethod, PaymentStatus } from "../store";

export interface CheckoutRequest {
  ref: string;
  amount: number;
  method: PaymentMethod;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  callbackUrl: string;
}

export interface CheckoutResult {
  /** Where the fan's browser goes next to approve the payment. */
  redirectUrl: string;
  providerToken: string;
}

export interface WebhookResult {
  providerToken: string;
  status: PaymentStatus;
  /** Amount the provider says was paid, when it reports one — checked against our record. */
  amount?: number;
}

/**
 * Every payment aggregator (PayDunya today; CinetPay/Hub2 as backups, per the
 * spec's dependency risk) implements this contract. The payment service never
 * branches on a provider name, so adding a second aggregator is one new file.
 */
export interface PaymentProvider {
  readonly name: string;
  readonly livemode: boolean;
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
  /** Verifies authenticity; returns null for a forged or malformed notification. */
  parseWebhook(body: unknown): Promise<WebhookResult | null>;
  /** Asks the provider directly — used when a webhook is late, so confirmation stays under 10 s. */
  checkStatus(providerToken: string): Promise<PaymentStatus>;
}
