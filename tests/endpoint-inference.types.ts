import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthDataClient, type InvalidationApi } from "../packages/auth-client/src/index.js";
const auth = createAuthClient({ plugins: [organizationClient()] });
const adapter = createAuthDataClient({
  authClient: auth,
  api: {} as InvalidationApi,
  features: { organization: true },
});
type D = ReturnType<typeof adapter.useListOrganizations>["data"];
type IsAny<T> = 0 extends 1 & T ? true : false;
const notAny: IsAny<D> = false;
void notAny;
import type { Data } from "../packages/auth-client/src/client/types.js";
const rawNotAny: IsAny<Data<typeof auth.organization.list>> = false;
void rawNotAny;

import { betterAuth } from "better-auth/minimal";
import { organization as organizationPlugin } from "better-auth/plugins";
import { inferOrgAdditionalFields } from "better-auth/client/plugins";
const server = betterAuth({
  plugins: [
    organizationPlugin({
      schema: {
        organization: { additionalFields: { description: { type: "string", required: false } } },
        member: { additionalFields: { department: { type: "string", required: false } } },
        invitation: { additionalFields: { ticket: { type: "number", required: false } } },
      },
    }),
  ],
});
const custom = createAuthClient({
  plugins: [organizationClient({ schema: inferOrgAdditionalFields<typeof server>() })],
});
const customAdapter = createAuthDataClient({
  authClient: custom,
  api: {} as InvalidationApi,
  features: { organization: true },
});
type CustomOrganization = NonNullable<ReturnType<typeof customAdapter.useOrganization>["data"]>;
const description: CustomOrganization["description"] = "custom";
void description;
// @ts-expect-error Custom fields retain their server type
const wrongDescription: CustomOrganization["description"] = 123;
void wrongDescription;

type Expect<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
export type ExactWrites = Expect<
  Equal<
    typeof customAdapter.organization,
    Pick<typeof custom.organization, keyof typeof customAdapter.organization>
  >
>;
type Members = NonNullable<ReturnType<typeof customAdapter.useListMembers>["data"]>;
type Invitation = NonNullable<ReturnType<typeof customAdapter.useInvitation>["data"]>;
export type MemberField = Expect<
  Equal<NonNullable<Members["members"][number]["department"]>, string>
>;
export type InvitationField = Expect<Equal<NonNullable<Invitation["ticket"]>, number>>;
export type MemberPayloadNotAny = Expect<Equal<IsAny<Members["members"][number]>, false>>;
export type InvitationPayloadNotAny = Expect<Equal<IsAny<Invitation>, false>>;

import { createAccessControl } from "better-auth/plugins/access";
const ac = createAccessControl({ project: ["read"] });
const roles = { reviewer: ac.newRole({ project: ["read"] }) };
const roleAuth = createAuthClient({ plugins: [organizationClient({ ac, roles })] });
const roleAdapter = createAuthDataClient({
  authClient: roleAuth,
  api: {} as InvalidationApi,
  features: { organization: true, sessions: true },
});
export async function verifyGenericMutationCalls() {
  const response = await roleAdapter.organization.inviteMember(
    { email: "a@example.com", role: "reviewer", organizationId: "org" },
    { throw: true },
  );
  const id: string = response.id;
  const ordinary = await roleAdapter.organization.inviteMember({
    email: "a@example.com",
    role: "reviewer",
    organizationId: "org",
    fetchOptions: { throw: false },
  });
  const ordinaryId: string | undefined = ordinary.data?.id;
  // @ts-expect-error unknown configured role
  await roleAdapter.organization.inviteMember({ email: "a@example.com", role: "unknown-role" });
  // @ts-expect-error member custom field stays string
  const department: Members["members"][number]["department"] = 42;
  void [id, ordinaryId, department];
}
export type SessionWrites = Expect<
  Equal<typeof roleAdapter.revokeSession, typeof roleAuth.revokeSession>
>;

export type ListsDoNotIncludeErrorNull = Expect<
  Equal<null extends Data<typeof auth.organization.list> ? true : false, false>
>;
export type SuccessfulNullIsPreserved = Expect<
  Equal<Data<() => Promise<string | null>>, string | null>
>;
export type PayloadDataFieldIsNotAnEnvelope = Expect<
  Equal<Data<() => Promise<{ data: string; count: number }>>, { data: string; count: number }>
>;
