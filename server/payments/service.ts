import type { JokkoConfig } from "../config";
import type { Payment, PaymentMethod, PaymentStatus, Store, Streamer, Withdrawal } from "../store";
import type { PaymentProvider } from "./provider";
import type { RealtimeHub } from "../realtime";
import { rankFor, type Rank } from "../ranks";
import { HttpError, hmac, randomId } from "../util";
import { METHOD_LABELS, cleanName, moderateMessage, normalizeSenegalPhone, parseAmount } from "../validation";

export interface CreatePaymentInput {
  streamer: Streamer;
  amount: unknown;
  method: PaymentMethod;
  fanName: unknown;
  fanMessage: unknown;
  phone: unknown;
  baseUrl: string;
}

/** A pending payment is re-checked with the provider at most this often while the fan waits. */
const STATUS_RECHECK_MS = 3_000;

/**
 * Payment lifecycle: create → provider checkout → webhook (or active re-check)
 * → completed, exactly once. Completion is idempotent: duplicate or late
 * notifications never credit a streamer twice nor replay an alert.
 */
export class PaymentService {
  constructor(
    private store: Store,
    private provider: PaymentProvider,
    private cfg: JokkoConfig,
    private hub: RealtimeHub
  ) {}

  get livemode() {
    return this.provider.livemode;
  }

  commissionRate(streamer: Streamer): number {
    return this.cfg.commission[streamer.plan];
  }

  async create(input: CreatePaymentInput): Promise<{ ref: string; redirectUrl: string }> {
    const { streamer } = input;
    const amount = parseAmount(input.amount, this.cfg.minAmount, this.cfg.maxAmount);
    let fanKey: string | null = null;
    if (input.phone !== undefined && input.phone !== null && String(input.phone).trim() !== "") {
      const phone = normalizeSenegalPhone(String(input.phone));
      if (!phone) throw new HttpError(400, "Numéro sénégalais invalide (ex. 77 123 45 67).", "invalid_phone");
      fanKey = `${this.livemode ? "live" : "test"}:${hmac(this.cfg.secret, `fan:${phone}`)}`;
    }
    const commission = Math.round(amount * this.commissionRate(streamer));
    const ref = randomId("jk", 12);
    const payment: Payment = {
      id: randomId("pay"),
      ref,
      streamerId: streamer.id,
      amount,
      currency: "XOF",
      method: input.method,
      fanName: cleanName(input.fanName),
      fanMessage: moderateMessage(input.fanMessage, streamer.blockedWords),
      fanKey,
      status: "pending",
      provider: this.provider.name,
      providerToken: null,
      livemode: this.livemode,
      commission,
      net: amount - commission,
      createdAt: Date.now(),
      completedAt: null,
      lastCheckAt: Date.now(),
    };

    const back = `${input.baseUrl}/s/${encodeURIComponent(streamer.slug)}?ref=${encodeURIComponent(ref)}`;
    const checkout = await this.provider.createCheckout({
      ref,
      amount,
      method: input.method,
      description: `Soutien à ${streamer.displayName} via Jokko`,
      returnUrl: back,
      cancelUrl: `${back}&cancelled=1`,
      callbackUrl: `${input.baseUrl}/api/webhooks/${this.provider.name}`,
    });
    payment.providerToken = checkout.providerToken;
    this.store.data.payments.push(payment);
    this.store.save();
    return { ref, redirectUrl: checkout.redirectUrl };
  }

  /** Entry point for the provider's notification. Returns false if it was not authentic. */
  async handleWebhook(body: unknown): Promise<boolean> {
    const result = await this.provider.parseWebhook(body);
    if (!result) return false;
    const payment = this.store.paymentByProviderToken(this.provider.name, result.providerToken);
    if (!payment) return true; // authentic but unknown (e.g. other environment) — acknowledge, do nothing
    this.applyStatus(payment, result.status, result.amount);
    return true;
  }

  /** Called while the fan's page polls: if the webhook is late, ask the provider directly. */
  async refresh(payment: Payment): Promise<Payment> {
    if (payment.status !== "pending" || !payment.providerToken) return payment;
    if (Date.now() - payment.lastCheckAt < STATUS_RECHECK_MS) return payment;
    payment.lastCheckAt = Date.now();
    try {
      const status = await this.provider.checkStatus(payment.providerToken);
      this.applyStatus(payment, status);
    } catch {
      /* provider unreachable — the webhook can still arrive */
    }
    return payment;
  }

  applyStatus(payment: Payment, status: PaymentStatus, reportedAmount?: number) {
    if (payment.status !== "pending" || status === "pending") return;
    if (status === "completed" && reportedAmount !== undefined && reportedAmount !== payment.amount) {
      payment.status = "failed";
      this.store.save();
      console.warn(`[jokko] montant incohérent pour ${payment.ref} : attendu ${payment.amount}, reçu ${reportedAmount}`);
      return;
    }
    payment.status = status;
    if (status !== "completed") {
      this.store.save();
      return;
    }
    payment.completedAt = Date.now();
    const rank = this.creditFan(payment);
    this.store.save();
    const streamer = this.store.streamerById(payment.streamerId);
    if (streamer) this.announce(streamer, payment, rank);
  }

  private creditFan(payment: Payment): Rank | null {
    if (!payment.fanKey) return null;
    let fan = this.store.fan(payment.fanKey);
    if (!fan) {
      fan = { key: payment.fanKey, total: 0, donations: 0, streamerIds: [], lastName: payment.fanName, createdAt: Date.now() };
      this.store.data.fans.push(fan);
    }
    fan.total += payment.amount;
    fan.donations += 1;
    fan.lastName = payment.fanName;
    if (!fan.streamerIds.includes(payment.streamerId)) fan.streamerIds.push(payment.streamerId);
    return rankFor(fan.total);
  }

  fanRank(payment: Payment): { rank: Rank; total: number; streamers: number } | null {
    const fan = payment.fanKey ? this.store.fan(payment.fanKey) : undefined;
    return fan ? { rank: rankFor(fan.total), total: fan.total, streamers: fan.streamerIds.length } : null;
  }

  donationPayload(streamer: Streamer, payment: Pick<Payment, "fanName" | "fanMessage" | "amount" | "method">, rank: Rank | null, test: boolean) {
    return {
      username: payment.fanName,
      amount: payment.amount,
      currency: "XOF",
      method: payment.method,
      methodLabel: METHOD_LABELS[payment.method],
      message: streamer.showMessages ? payment.fanMessage : "",
      rank: rank ? { id: rank.id, label: rank.label } : null,
      test,
    };
  }

  /** Pushes the donation alert + updated goal to every overlay of this streamer. */
  announce(streamer: Streamer, payment: Pick<Payment, "fanName" | "fanMessage" | "amount" | "method">, rank: Rank | null, test = !this.livemode) {
    const payload = this.donationPayload(streamer, payment, rank, test);
    this.hub.publish(streamer.id, {
      kind: "event",
      event: { id: randomId("evt", 8), type: "donation", payload, ts: Date.now() },
    });
    this.hub.publish(streamer.id, {
      kind: "config-patch",
      patch: {
        goals: { donations: { current: this.goalProgress(streamer), target: streamer.goal.target, label: streamer.goal.label } },
        lastSupporter: { name: payment.fanName, type: "donation" },
      },
    });
  }

  goalProgress(streamer: Streamer): number {
    let sum = 0;
    for (const p of this.store.data.payments) {
      if (p.streamerId === streamer.id && p.status === "completed" && p.livemode === this.livemode && (p.completedAt ?? 0) >= streamer.goal.since) sum += p.amount;
    }
    return sum;
  }

  balance(streamer: Streamer) {
    let received = 0;
    let net = 0;
    let commission = 0;
    let count = 0;
    for (const p of this.store.data.payments) {
      if (p.streamerId !== streamer.id || p.status !== "completed" || p.livemode !== this.livemode) continue;
      received += p.amount;
      net += p.net;
      commission += p.commission;
      count += 1;
    }
    let withdrawn = 0;
    let pendingWithdrawals = 0;
    for (const w of this.store.data.withdrawals) {
      if (w.streamerId !== streamer.id || w.livemode !== this.livemode) continue;
      if (w.status === "paid") withdrawn += w.amount;
      if (w.status === "pending") pendingWithdrawals += w.amount;
    }
    return { received, net, commission, count, withdrawn, pendingWithdrawals, available: net - withdrawn - pendingWithdrawals };
  }

  requestWithdrawal(streamer: Streamer, amountInput: unknown): Withdrawal {
    if (!streamer.payout.phone) throw new HttpError(400, "Connecte d'abord ton numéro Wave pour recevoir tes retraits.", "no_payout");
    const { available } = this.balance(streamer);
    const amount = parseAmount(amountInput, this.cfg.minWithdrawal, Number.MAX_SAFE_INTEGER);
    if (amount > available) throw new HttpError(400, `Solde insuffisant (disponible : ${available} F CFA).`, "insufficient_balance");
    const withdrawal: Withdrawal = {
      id: randomId("wd"),
      streamerId: streamer.id,
      amount,
      phone: streamer.payout.phone,
      method: "wave",
      status: "pending",
      livemode: this.livemode,
      createdAt: Date.now(),
      processedAt: null,
      note: "",
    };
    this.store.data.withdrawals.push(withdrawal);
    this.store.save();
    return withdrawal;
  }
}
