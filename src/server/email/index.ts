import "server-only";
import nodemailer from "nodemailer";
import { getEnv } from "../env";
import { logger } from "../logger";
import type { EmailTemplate } from "./templates";

const env = getEnv();
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
});

export async function sendEmail(to: string, template: EmailTemplate) {
  const result = await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
  logger.info({ messageId: result.messageId, recipientDomain: to.split("@")[1] }, "email_sent");
}

export async function checkSmtp() {
  return transporter.verify();
}

