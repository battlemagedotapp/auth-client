import { createSignalQueries } from "@strawdev/auth-client/convex";
import { authComponent, features, requireVerifiedInvitationEmail } from "./auth";
import type { DataModel } from "./_generated/dataModel";
import { components } from "./_generated/api";
export { markSessionsChanged } from "@strawdev/auth-client/convex";
export const { signals } = createSignalQueries<DataModel>({
  features,
  requireVerifiedInvitationEmail,
  getAuthUser: (ctx) => authComponent.getAuthUser(ctx),
  lookup: components.betterAuth.authData.lookup,
});
