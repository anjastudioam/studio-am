export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(msg: MailMessage): Promise<void>;
}

/** Development: prints the email (including the sign-in link) to the console. */
export class ConsoleMailer implements Mailer {
  async send(msg: MailMessage): Promise<void> {
    console.log(`\n--- EMAIL to ${msg.to} ---\n${msg.subject}\n\n${msg.text}\n--- end ---\n`);
  }
}

/** Production without an email provider: sends nothing and prints nothing. */
export class NullMailer implements Mailer {
  async send(): Promise<void> {}
}

/** Tests: keeps messages in memory. */
export class MemoryMailer implements Mailer {
  public sent: MailMessage[] = [];
  async send(msg: MailMessage): Promise<void> {
    this.sent.push(msg);
  }
}

export class ResendMailer implements Mailer {
  constructor(
    private apiKey: string,
    private from: string,
  ) {}

  async send(msg: MailMessage): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.from, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
    });
    if (!res.ok) {
      // Never log the API key or the message body.
      throw new Error(`Email provider rejected the message (status ${res.status})`);
    }
  }
}
