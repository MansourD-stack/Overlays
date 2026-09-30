import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join, resolve } from "node:path";

export type ProviderName = "simulated" | "paydunya";
export type Plan = "free" | "pro";

export interface PayDunyaKeys {
  mode: "test" | "live";
  masterKey: string;
  privateKey: string;
  token: string;
}

/** Everything the Jokko server needs from its environment. Secrets (PayDunya
 *  keys, server secret, admin token) only ever come from environment
 *  variables or the git-ignored data directory — never from versioned files. */
export interface JokkoConfig {
  dataDir: string;
  /** Public base URL (e.g. https://jokko.example.com). Needed for PayDunya
   *  return/callback URLs; falls back to the request's Host header when unset. */
  publicUrl: string | null;
  provider: ProviderName;
  paydunya: PayDunyaKeys | null;
  /** True only when real money moves (PayDunya live mode). Balances and fan
   *  ranks are always computed per mode so test money can never be withdrawn as real money. */
  livemode: boolean;
  secret: string;
  adminToken: string | null;
  commission: Record<Plan, number>;
  minAmount: number;
  maxAmount: number;
  minWithdrawal: number;
  /** Anonymous "local" bridge channel used by the original single-streamer
   *  setup (npm run dev, no account). On by default in dev, off in production. */
  allowLocalBridge: boolean;
  /** Behind a reverse proxy (nginx, Render, Railway…): take the client IP from
   *  X-Forwarded-For, otherwise every fan shares one rate-limit bucket. */
  trustProxy: boolean;
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(n) ? n : fallback;
}

/** Loads `.env` if present (Node ≥ 20.12) so beginners can configure keys without touching the shell. */
export function loadDotEnv(root: string) {
  const file = join(root, ".env");
  if (!existsSync(file)) return;
  try {
    (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile?.(file);
  } catch {
    /* malformed .env — keep going with the real environment */
  }
}

function resolveSecret(dataDir: string, env: NodeJS.ProcessEnv): string {
  if (env.JOKKO_SECRET && env.JOKKO_SECRET.length >= 16) return env.JOKKO_SECRET;
  const file = join(dataDir, "secret.key");
  if (existsSync(file)) return readFileSync(file, "utf8").trim();
  const secret = randomBytes(32).toString("hex");
  writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

export function readConfig(root: string, env: NodeJS.ProcessEnv = process.env, mode: "development" | "production" = "development"): JokkoConfig {
  const dataDir = resolve(root, env.JOKKO_DATA_DIR || "data");
  mkdirSync(dataDir, { recursive: true });

  const provider: ProviderName = env.JOKKO_PAYMENT_PROVIDER === "paydunya" ? "paydunya" : "simulated";
  let paydunya: PayDunyaKeys | null = null;
  if (provider === "paydunya") {
    const { PAYDUNYA_MASTER_KEY, PAYDUNYA_PRIVATE_KEY, PAYDUNYA_TOKEN } = env;
    if (!PAYDUNYA_MASTER_KEY || !PAYDUNYA_PRIVATE_KEY || !PAYDUNYA_TOKEN) {
      throw new Error(
        "JOKKO_PAYMENT_PROVIDER=paydunya mais PAYDUNYA_MASTER_KEY / PAYDUNYA_PRIVATE_KEY / PAYDUNYA_TOKEN sont manquants (voir .env.example)."
      );
    }
    paydunya = {
      mode: env.PAYDUNYA_MODE === "live" ? "live" : "test",
      masterKey: PAYDUNYA_MASTER_KEY,
      privateKey: PAYDUNYA_PRIVATE_KEY,
      token: PAYDUNYA_TOKEN,
    };
  }

  return {
    dataDir,
    publicUrl: env.JOKKO_PUBLIC_URL ? env.JOKKO_PUBLIC_URL.replace(/\/+$/, "") : null,
    provider,
    paydunya,
    livemode: paydunya?.mode === "live",
    secret: resolveSecret(dataDir, env),
    adminToken: env.JOKKO_ADMIN_TOKEN && env.JOKKO_ADMIN_TOKEN.length >= 16 ? env.JOKKO_ADMIN_TOKEN : null,
    commission: {
      free: num(env.JOKKO_COMMISSION_FREE, 0.1),
      pro: num(env.JOKKO_COMMISSION_PRO, 0.05),
    },
    minAmount: num(env.JOKKO_MIN_AMOUNT, 200),
    maxAmount: num(env.JOKKO_MAX_AMOUNT, 500_000),
    minWithdrawal: num(env.JOKKO_MIN_WITHDRAWAL, 1_000),
    allowLocalBridge: env.JOKKO_LOCAL_BRIDGE ? env.JOKKO_LOCAL_BRIDGE === "1" : mode === "development",
    trustProxy: env.JOKKO_TRUST_PROXY === "1",
  };
}
