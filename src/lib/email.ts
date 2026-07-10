import nodemailer from "nodemailer";
import { logger } from "@/lib/logger";

export interface SendEmailInput {
  to: string[];
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
}

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  if (cachedTransporter) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return cachedTransporter;
}

/**
 * Real SMTP integration point, not a stub — flipping to production email
 * later needs zero code changes, just env vars, same posture as
 * AI_ENGINE_URL/INTERNAL_TOKEN. When SMTP_HOST is unset (the dev default),
 * logs the would-be send instead of throwing, so scheduled-report runs can
 * still be verified end-to-end without real credentials.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const transporter = getTransporter();

  if (!transporter) {
    logger.info("email.log_fallback", {
      to: input.to,
      subject: input.subject,
      attachments: input.attachments?.map((a) => a.filename) ?? [],
      note: "logged, not sent — SMTP not configured",
    });
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "noreply@retailos.local",
    to: input.to.join(", "),
    subject: input.subject,
    html: input.html,
    attachments: input.attachments,
  });
}
