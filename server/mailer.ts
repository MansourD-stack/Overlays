/** Outgoing e-mail. Console in development (the link is printed in the
 *  terminal), Resend's HTTP API when RESEND_API_KEY is set — no SMTP dependency. */
export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  readonly name: string;
  send(mail: Mail): Promise<void>;
}

export class ConsoleMailer implements Mailer {
  readonly name = "console";
  async send(mail: Mail) {
    console.log(`\n[jokko] ✉ e-mail pour ${mail.to} — ${mail.subject}\n${mail.text}\n`);
  }
}

export class ResendMailer implements Mailer {
  readonly name = "resend";
  constructor(
    private apiKey: string,
    private from: string,
    private fetchImpl: typeof fetch = fetch
  ) {}

  async send(mail: Mail) {
    const res = await this.fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ from: this.from, to: [mail.to], subject: mail.subject, text: mail.text }),
    });
    if (!res.ok) throw new Error(`Envoi d'e-mail refusé (${res.status}).`);
  }
}
