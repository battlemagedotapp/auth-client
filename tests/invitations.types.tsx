import { createAuthClient } from "better-auth/react";
import { z } from "zod";
import { organizationClient, inferOrgAdditionalFields } from "better-auth/client/plugins";
import { betterAuth } from "better-auth/minimal";
import { organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { createAuthDataClient, type InvalidationApi } from "../packages/auth-client/src/index.js";

const access = createAccessControl({ project: ["read"] });
const roles = { reviewer: access.newRole({ project: ["read"] }) };
const server = betterAuth({
  plugins: [
    organization({
      ac: access,
      roles,
      schema: {
        organization: { additionalFields: { description: { type: "string", required: false } } },
        invitation: {
          additionalFields: {
            ticket: { type: "number", required: true },
            note: { type: "string", required: false },
          },
        },
      },
    }),
  ],
});
const authClient = createAuthClient({
  plugins: [
    organizationClient({ ac: access, roles, schema: inferOrgAdditionalFields<typeof server>() }),
  ],
});
const authData = createAuthDataClient({
  authClient,
  api: {} as InvalidationApi,
  features: { organization: true },
});
export function TypedForm() {
  return (
    <authData.InvitationForm
      organizationId="org"
      initialValues={{ role: "reviewer", ticket: 42 }}
      onInvited={(invitation) => {
        const ticket: number = invitation.ticket;
        // @ts-expect-error callback payload must not degrade to any
        const wrong: string = invitation.ticket;
        void [ticket, wrong];
      }}
    >
      <InvitationFormControls1 />
    </authData.InvitationForm>
  );
}
export function TypedResponse() {
  return (
    <authData.InvitationResponse
      invitationId="invite"
      onAccepted={({ organization: org }) => {
        const description: string | null | undefined = org.description;
        // @ts-expect-error inferred field is not a number
        const wrong: number = org.description;
        void [description, wrong];
      }}
    >
      <InvitationResponseControls2 />
    </authData.InvitationResponse>
  );
}
export function useTypedWorkflow() {
  const invitations = authData.useOrganizationInvitations({ organizationId: "org" });
  void invitations.invitation("id").resend.run();
  // @ts-expect-error resend resolves the observed invitation rather than accepting a replacement payload
  void invitations.resend({ email: "a@example.com", role: "reviewer" });
  // @ts-expect-error initial values must include required custom fields
  authData.useInvitationForm({ organizationId: "org", initialValues: { role: "reviewer" } });
}
const disabled = createAuthDataClient({
  authClient,
  api: {} as InvalidationApi,
  features: { sessions: true },
});
// @ts-expect-error organization capability was not selected
void disabled.InvitationForm;
// @ts-expect-error organization capability was not selected
void disabled.useInvitationResponse;

const draftSchema = z.object({
  email: z.string(),
  role: z.literal("reviewer"),
  ticket: z.string().transform(Number),
  note: z.string().optional(),
});
const DefinedInvitation = authData.defineInvitationForm(draftSchema);
function DefinedInvitationControls() {
  const form = DefinedInvitation.useWorkflowContext();
  const ticket: string = form.field("ticket").value;
  // @ts-expect-error transformed context fields accept draft values only
  form.field("ticket").onChange(42);
  void ticket;
  return null;
}
export function DefinedInvitationForm() {
  return (
    <DefinedInvitation.Root
      organizationId="org"
      initialValues={{ email: "", role: "reviewer", ticket: "" }}
    >
      <DefinedInvitationControls />
    </DefinedInvitation.Root>
  );
}
// @ts-expect-error a form definition cannot drop required custom server fields
authData.defineInvitationForm(z.object({ email: z.string(), role: z.literal("reviewer") }));
export function DraftForm() {
  return (
    <DefinedInvitation.Root
      organizationId="org"
      initialValues={{ email: "", role: "reviewer", ticket: "" }}
      validate={(values) => {
        const ticket: number = values.ticket;
        void ticket;
        return Promise.resolve({});
      }}
    >
      <InvitationFormControls3 />
    </DefinedInvitation.Root>
  );
}
export function useSchemaTypes() {
  const form = authData.useInvitationForm({
    schema: draftSchema,
    organizationId: "org",
    initialValues: { email: "", role: "reviewer", ticket: "" },
  });
  const ticket: string = form.field("ticket").value;
  void ticket;
  authData.useInvitationForm({
    // @ts-expect-error schema output lacks a required invitation field
    schema: z.object({ email: z.string(), role: z.literal("reviewer") }),
    organizationId: "org",
    initialValues: { email: "", role: "reviewer" },
  });
  authData.useInvitationForm({
    // @ts-expect-error schema role output must match the configured client
    schema: z.object({ email: z.string(), role: z.literal("owner"), ticket: z.number() }),
    organizationId: "org",
    initialValues: { email: "", role: "owner", ticket: 1 },
  });
  authData.useInvitationForm({
    // @ts-expect-error schema cannot override explicit organization scope
    schema: draftSchema.extend({ organizationId: z.string() }),
    organizationId: "org",
    initialValues: { email: "", role: "reviewer", ticket: "", organizationId: "other" },
  });
  const received = authData.useReceivedInvitations();
  void received.feedback[0]?.recovery?.run();
}

function InvitationFormControls1() {
  const form = authData.useInvitationFormContext();
  const email: string = form.field("email").value;
  const ticket: number = form.field("ticket").value;
  const note: string | null | undefined = form.field("note").value;
  // @ts-expect-error optional custom fields retain their value type
  form.field("note").onChange(123);
  // @ts-expect-error owned form feedback is read-only
  form.touched.email = true;
  // @ts-expect-error owned field errors cannot be assigned by consumers
  form.fieldErrors.email = { code: "external" };
  form.field("role").onChange("reviewer");
  // @ts-expect-error roles retain the configured union
  form.field("role").onChange("owner");
  // @ts-expect-error custom field setter retains its type
  form.field("ticket").onChange("wrong");
  // @ts-expect-error unsupported team input is not exposed
  form.field("teamId");
  const {
    reset,
    actions: { submit },
  } = form;
  void [email, ticket, note, reset, submit];
  return null;
}
function InvitationResponseControls2() {
  const state = authData.useInvitationResponseContext();
  const ticket: number | undefined = state.invitation?.ticket;
  void ticket;
  return null;
}
function InvitationFormControls3() {
  const form = DefinedInvitation.useWorkflowContext();
  const ticket: string = form.values.ticket;
  // @ts-expect-error editable ticket is a string, not the parsed output
  form.field("ticket").onChange(4);
  const { isDirty, isValidating } = form;
  void [ticket, isDirty, isValidating];
  return null;
}
