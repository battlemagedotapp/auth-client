import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";
import { resend } from "./email";
const http = httpRouter();
authComponent.registerRoutes(http, createAuth, { cors: true });
http.route({
  path: "/resend-webhook",
  method: "POST",
  handler: httpAction((ctx, request) => resend.handleResendEventWebhook(ctx, request)),
});
export default http;
