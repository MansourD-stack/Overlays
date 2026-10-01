import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { JokkoConfig } from "../config";
import { createJokkoApp, type JokkoApp } from "../app";
import { Store } from "../store";
import type { PaymentProvider } from "../payments/provider";
import type { Mail, Mailer } from "../mailer";

/** Captures outgoing e-mails instead of sending them. */
export class MemoryMailer implements Mailer {
  readonly name = "memory";
  sent: Mail[] = [];
  async send(mail: Mail) {
    this.sent.push(mail);
  }
}

export function testConfig(overrides: Partial<JokkoConfig> = {}): JokkoConfig {
  return {
    dataDir: "",
    publicUrl: null,
    provider: "simulated",
    paydunya: null,
    cinetpay: null,
    livemode: false,
    secret: "test-secret-0123456789abcdef",
    adminToken: "admin-token-0123456789",
    commission: { free: 0.1, pro: 0.05 },
    minAmount: 200,
    maxAmount: 500_000,
    minWithdrawal: 1_000,
    allowLocalBridge: true,
    trustProxy: false,
    mail: null,
    ...overrides,
  };
}

export async function startServer(opts: { provider?: PaymentProvider; cfg?: Partial<JokkoConfig> } = {}) {
  const mailer = new MemoryMailer();
  const app: JokkoApp = createJokkoApp(testConfig(opts.cfg), { store: new Store(null), provider: opts.provider, mailer });
  const server: Server = createServer((req, res) => {
    void app.handle(req, res).then((handled) => {
      if (!handled) res.writeHead(404).end();
    });
  });
  app.hub.attach(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  let cookie = "";
  async function api(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const json = (await res.json().catch(() => null)) as any;
    return { status: res.status, json };
  }
  return {
    app,
    base,
    mailer,
    api,
    setCookie: (c: string) => (cookie = c),
    getCookie: () => cookie,
    close: () =>
      new Promise<void>((r) => {
        app.close();
        server.close(() => r());
        server.closeAllConnections?.();
      }),
  };
}
