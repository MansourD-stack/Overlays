import { HttpError } from "./errors";
import type { PaymentMethod } from "./store";

export const PAYMENT_METHODS: PaymentMethod[] = ["wave", "orange-money", "free-money"];

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  wave: "Wave",
  "orange-money": "Orange Money",
  "free-money": "Free Money",
};

/** Senegalese mobile numbers: 9 digits starting with 70, 75, 76, 77 or 78.
 *  Accepts spaces, dots, dashes and +221 / 00221 prefixes. Returns E.164 or null. */
export function normalizeSenegalPhone(input: string): string | null {
  let digits = input.replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+221")) digits = digits.slice(4);
  else if (digits.startsWith("00221")) digits = digits.slice(5);
  else if (digits.length === 12 && digits.startsWith("221")) digits = digits.slice(3);
  return /^7[05678]\d{7}$/.test(digits) ? `+221${digits}` : null;
}

export function maskPhone(phone: string): string {
  return phone.length > 6 ? `${phone.slice(0, 6)} ••• •• ${phone.slice(-2)}` : phone;
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && (PAYMENT_METHODS as string[]).includes(value);
}

export function parseAmount(value: unknown, min: number, max: number): number {
  const n = typeof value === "string" ? Number(value.replace(/\s/g, "")) : Number(value);
  if (!Number.isInteger(n)) throw new HttpError(400, "Montant invalide (nombre entier en F CFA).", "invalid_amount");
  if (n < min) throw new HttpError(400, `Montant minimum : ${min} F CFA.`, "amount_too_low");
  if (n > max) throw new HttpError(400, `Montant maximum : ${max} F CFA.`, "amount_too_high");
  return n;
}

const DEFAULT_BLOCKED = ["pute", "salope", "connard", "nique", "fdp", "enculé", "encule"];

function stripControl(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f​-‏‪-‮]/g, " ");
}

/** Fan name shown on stream: plain text, short, never empty. */
export function cleanName(value: unknown): string {
  const s = stripControl(String(value ?? "")).replace(/\s+/g, " ").trim().slice(0, 32);
  return s || "Anonyme";
}

/**
 * Fan messages appear live on a stream, so they are moderated before storage:
 * control characters and links removed, length capped, blocked words masked.
 * Rendering always uses textContent, so this is about content, not XSS.
 */
export function moderateMessage(value: unknown, extraBlocked: string[] = []): string {
  let s = stripControl(String(value ?? "")).replace(/\s+/g, " ").trim();
  s = s.replace(/\b(?:https?:\/\/|www\.)\S+/gi, "[lien]").replace(/\b\S+\.(?:com|net|org|sn|io|me|ly|gg)\b\S*/gi, "[lien]");
  for (const word of [...DEFAULT_BLOCKED, ...extraBlocked]) {
    const w = word.trim();
    if (!w) continue;
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    s = s.replace(new RegExp(`(^|[^\\p{L}])${escaped}(?=$|[^\\p{L}])`, "giu"), (_m, pre: string) => `${pre}${"*".repeat(w.length)}`);
  }
  return s.slice(0, 140);
}

const RESERVED_SLUGS = new Set(["admin", "api", "control", "dashboard", "jokko", "support", "pay", "login", "signup", "s", "assets", "help"]);

export function validateSlug(value: unknown): string {
  const slug = String(value ?? "").trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/.test(slug)) {
    throw new HttpError(400, "Identifiant : 3 à 30 caractères, lettres minuscules, chiffres ou tirets.", "invalid_slug");
  }
  if (RESERVED_SLUGS.has(slug)) throw new HttpError(400, "Cet identifiant est réservé.", "reserved_slug");
  return slug;
}

export function validateEmail(value: unknown): string {
  const email = String(value ?? "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Adresse e-mail invalide.", "invalid_email");
  return email;
}

export function validatePassword(value: unknown): string {
  const password = String(value ?? "");
  if (password.length < 8) throw new HttpError(400, "Mot de passe : 8 caractères minimum.", "weak_password");
  if (password.length > 200) throw new HttpError(400, "Mot de passe trop long.", "invalid_password");
  return password;
}

export function cleanText(value: unknown, max: number, fallback = ""): string {
  const s = stripControl(String(value ?? "")).replace(/\s+/g, " ").trim().slice(0, max);
  return s || fallback;
}
