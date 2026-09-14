import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthDataClient, type InvalidationApi } from "../packages/auth-client/src/index.js";
const api = {} as InvalidationApi;
const base = createAuthClient();
const organization = createAuthClient({ plugins: [organizationClient()] });
const adapter = createAuthDataClient({
  authClient: organization,
  api,
  features: { organization: true },
});
// @ts-expect-error missing organization capability
createAuthDataClient({ authClient: base, api, features: { organization: true } });
// @ts-expect-error session feature not enabled
adapter.useListSessions();
// @ts-expect-error explicit organization required
adapter.useOrganization({});
// @ts-expect-error wrong input
void adapter.organization.create({ wrong: true });
