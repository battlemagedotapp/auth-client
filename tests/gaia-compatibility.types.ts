import { useMutation } from "@tanstack/react-query";
import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthDataClient, type InvalidationApi } from "../packages/auth-client/src/index.js";

const authClient = createAuthClient({ plugins: [organizationClient()] });
const authData = createAuthDataClient({
  authClient,
  api: {} as InvalidationApi,
  features: { organization: true, sessions: true },
});

// A representative migration boundary: UI mutation state stays in the app,
// while resource keys, observers, and invalidation stay inside the adapter.
export function useMigrationFixture(organizationId: string | null) {
  const directory = authData.useListOrganizations();
  const members = authData.useListMembers(
    {
      organizationId: organizationId ?? "",
      limit: 20,
      offset: 20,
      sortBy: "createdAt",
      sortDirection: "asc",
    },
    { enabled: Boolean(organizationId) },
  );
  const sessions = authData.useListSessions();
  const acceptance = useMutation({
    mutationFn: (
      input: Omit<
        NonNullable<Parameters<typeof authClient.organization.acceptInvitation>[0]>,
        "fetchOptions"
      >,
    ) => authData.organization.acceptInvitation(input, { throw: true }),
    gcTime: 1000,
    networkMode: "always",
  });
  async function acceptAndResolveDestination(invitationId: string) {
    const accepted = await acceptance.mutateAsync({ invitationId });
    // This separate read phase must not be reported as a failed acceptance.
    const refreshed = await directory.refetch();
    const organization = refreshed?.data?.find(
      (item) => item.id === accepted.member.organizationId,
    );
    const slug: string | undefined = organization?.slug;
    // @ts-expect-error refetched endpoint payload remains typed
    const wrong: number | undefined = organization?.slug;
    void wrong;
    return slug;
  }
  return { members, sessions, acceptance, acceptAndResolveDestination };
}
