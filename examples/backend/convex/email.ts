import { Resend } from "@convex-dev/resend";
import type { GenericCtx } from "@convex-dev/better-auth";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

export const resend = new Resend(components.resend);

type AuthEmail = {
  to: string;
  subject: string;
  url: string;
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
}

async function sendControlledEmail(email: AuthEmail) {
  const mailbox = process.env.MAILBOX_URL;
  if (!mailbox) throw new Error("Set MAILBOX_URL when AUTH_EMAIL_DELIVERY=controlled");
  const response = await fetch(mailbox, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(email),
  });
  if (!response.ok) throw new Error("Controlled mailbox delivery failed");
}

async function sendResendEmail(ctx: GenericCtx<DataModel>, email: AuthEmail) {
  const from = process.env.AUTH_EMAIL_FROM;
  if (!from) throw new Error("Set AUTH_EMAIL_FROM when AUTH_EMAIL_DELIVERY=resend");
  if (!("runMutation" in ctx)) throw new Error("Email delivery requires a mutable context");
  await resend.sendEmail(ctx, {
    from,
    to: email.to,
    subject: email.subject,
    html: `<p><a href="${escapeHtml(email.url)}">Continue</a></p>`,
    text: `Continue: ${email.url}`,
  });
}

export async function sendAuthEmail(ctx: GenericCtx<DataModel>, email: AuthEmail) {
  const mode = process.env.AUTH_EMAIL_DELIVERY;
  if (mode === "controlled") return sendControlledEmail(email);
  if (mode === "resend") return sendResendEmail(ctx, email);
  throw new Error("Set AUTH_EMAIL_DELIVERY to controlled or resend");
}
