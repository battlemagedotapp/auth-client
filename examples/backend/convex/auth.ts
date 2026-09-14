import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { betterAuth } from "better-auth/minimal";
import { organization } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { createSignalTriggers } from "@strawdev/auth-client/convex";
import { components, internal } from "./_generated/api";
import authConfig from "./auth.config";
import type { DataModel } from "./_generated/dataModel";
import schema from "./betterAuth/schema";
export const features = { organization: true, sessions: true } as const;
export const requireVerifiedInvitationEmail = true;
export const authComponent: ReturnType<typeof createClient<DataModel, typeof schema>> =
  createClient(components.betterAuth, {
    local: { schema },
    authFunctions: internal.auth,
    triggers: createSignalTriggers({
      features,
      lookup: components.betterAuth.authData.lookup,
      markSessionsChanged: internal.authData.markSessionsChanged,
    }),
  });
async function sendMail(to: string, url: string) {
  const mailbox = process.env.MAILBOX_URL;
  if (!mailbox) throw new Error("Set MAILBOX_URL for the isolated development example");
  const response = await fetch(mailbox, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ to, url }),
  });
  if (!response.ok) throw new Error("Development mailbox delivery failed");
}
export const createAuthOptions = (ctx: GenericCtx<DataModel>) => ({
  baseURL: process.env.CONVEX_SITE_URL,
  trustedOrigins: [process.env.SITE_URL ?? "http://localhost:8099", "reactive-auth-example://"],
  database: authComponent.adapter(ctx),
  advanced: { database: { generateId: false as const } },
  emailAndPassword: { enabled: true, requireEmailVerification: true },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) =>
      sendMail(user.email, url),
  },
  plugins: [
    expo(),
    organization({
      schema: { invitation: { additionalFields: { ticket: { type: "number", required: false } } } },
      requireEmailVerificationOnInvitation: requireVerifiedInvitationEmail,
      sendInvitationEmail: async (data) =>
        sendMail(data.email, `${process.env.SITE_URL}/?invitationId=${data.id}`),
    }),
    convex({ authConfig }),
    crossDomain({ siteUrl: process.env.SITE_URL ?? "http://localhost:8099" }),
  ],
});
export const createAuth = (ctx: GenericCtx<DataModel>) => betterAuth(createAuthOptions(ctx));
export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();
