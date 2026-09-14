import { createAuthClient } from "better-auth/react";
import { organizationClient, inferOrgAdditionalFields } from "better-auth/client/plugins";
import { betterAuth } from "better-auth/minimal";
import { organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { z } from "zod";
import { createAuthDataClient, type InvalidationApi } from "../packages/auth-client/src/index.js";
const access = createAccessControl({ document: ["read"] });
const roles = { reviewer: access.newRole({ document: ["read"] }) };
const server = betterAuth({
  plugins: [
    organization({
      ac: access,
      roles,
      schema: {
        organization: { additionalFields: { ticket: { type: "number", required: true } } },
        member: { additionalFields: { note: { type: "string", required: false } } },
      },
    }),
  ],
});
const authClient = createAuthClient({
  plugins: [
    organizationClient({ ac: access, roles, schema: inferOrgAdditionalFields<typeof server>() }),
  ],
});
const client = createAuthDataClient({
  authClient,
  api: {} as InvalidationApi,
  features: { organization: true, sessions: true },
});
const schema = z.object({
  name: z.string(),
  slug: z.string(),
  ticket: z.string().transform(Number),
});
export function TypedWorkflows() {
  const settings = client.useOrganizationSettings({
    organizationId: "org",
    schema,
    getInitialValues: (org) => ({ name: org.name, slug: org.slug, ticket: String(org.ticket) }),
    validate: (values) => {
      const ticket: number | undefined = values.ticket;
      void ticket;
      return {};
    },
    policy: {
      delete: ({ organization: org, actorId }) => {
        const ticket: number = org.ticket;
        void [ticket, actorId];
        return { allowed: false, code: "protected" };
      },
    },
    beforeDelete: async ({ organizationId, signal }) => {
      const abort: AbortSignal = signal;
      void [organizationId, abort];
    },
  });
  settings.form?.field("ticket").onChange("123");
  // @ts-expect-error transformed draft remains a string
  settings.form?.field("ticket").onChange(123);
  // @ts-expect-error updates preserve custom field types
  void settings.update({ ticket: "123" });
  const members = client.useOrganizationMembers({
    organizationId: "org",
    pageSize: 10,
    policy: {
      assignableRoles: ({ member }) => {
        const note: string | null | undefined = member.note;
        void note;
        return ["reviewer"];
      },
    },
  });
  void members.updateMemberRole({ memberId: "id", role: "reviewer" });
  // @ts-expect-error role payload retains the upstream string/string-array type
  void members.updateMemberRole({ memberId: "id", role: 123 });
  const sessions = client.useSessions();
  const expires: Date | undefined = sessions.currentSession?.expiresAt;
  // @ts-expect-error no credentials in pending state
  void sessions.pendingAction?.token;
  void expires;
  return (
    <>
      <client.OrganizationCreateForm
        schema={schema}
        initialValues={{ name: "", slug: "", ticket: "" }}
        onCreated={({ organization: org }) => {
          const ticket: number = org.ticket;
          // @ts-expect-error canonical custom fields do not become any
          const wrong: string = org.ticket;
          void [ticket, wrong];
        }}
      >
        {(form) => {
          const ticket: string = form.field("ticket").value;
          // @ts-expect-error JSX bindings retain schema input types
          const wrong: number = form.field("ticket").value;
          void [ticket, wrong];
          return null;
        }}
      </client.OrganizationCreateForm>
      <client.OrganizationSettings
        organizationSlug="slug"
        getInitialValues={(org) => ({ name: org.name, ticket: org.ticket })}
      >
        {(state) => {
          const ticket: number | undefined = state.form?.field("ticket").value;
          void ticket;
          return null;
        }}
      </client.OrganizationSettings>
      <client.OrganizationMembers organizationId="id" pageSize={5}>
        {(state) => {
          const note: string | null | undefined = state.members[0]?.note;
          void note;
          return null;
        }}
      </client.OrganizationMembers>
      <client.OrganizationDirectory fallback="first">
        {(state) => {
          const ticket: number | undefined = state.organization?.ticket;
          void ticket;
          return null;
        }}
      </client.OrganizationDirectory>
      <client.Sessions>
        {(state) => {
          const id: string | undefined = state.currentSessionId;
          void id;
          return null;
        }}
      </client.Sessions>
    </>
  );
}
function InvalidContracts() {
  // @ts-expect-error create requires custom ticket
  client.useOrganizationCreateForm({ initialValues: { name: "", slug: "" } });
  client.useOrganizationCreateForm({
    // @ts-expect-error incompatible transformed output
    schema: z.object({ name: z.string(), slug: z.string(), ticket: z.string() }),
    initialValues: { name: "", slug: "", ticket: "" },
  });
  // @ts-expect-error a scope is required
  client.useOrganizationSettings({ getInitialValues: () => ({ name: "" }) });
  // @ts-expect-error the workflow owns pagination offsets
  client.useOrganizationMembers({ organizationId: "org", pageSize: 5, query: { offset: 10 } });
  const limited = createAuthDataClient({ authClient, api: {} as InvalidationApi, features: {} });
  // @ts-expect-error disabled organization capability
  void limited.OrganizationSettings;
  // @ts-expect-error disabled sessions capability
  limited.useSessions();
}
void InvalidContracts;
