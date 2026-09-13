# Better Auth × Convex Client

`@strawdev/auth-client` adds subscription-driven React reads to an existing Better Auth client backed by Convex. It uses Better Auth HTTP endpoints for data and writes, TanStack Query for caching, and authenticated Convex revision queries for invalidation.

The package does not configure authentication, install Better Auth plugins, own session state, set Convex tokens, or import Expo/React Native. The Expo example owns those concerns.

## Client

```tsx
import { createAuthDataClient, AuthDataProvider } from "@strawdev/auth-client";

export const authData = createAuthDataClient({
  authClient, // your existing, concretely typed Better Auth React client
  api: api.authData, // generated Convex references
  features: { organization: true, sessions: true },
});

// Inside your existing ConvexBetterAuthProvider:
<AuthDataProvider client={authData}>{children}</AuthDataProvider>;
```

Enable `organizationClient()` on your original client to use organization capabilities. Disabled features expose no adapter methods. Keep authentication and unsupported plugins on the original client; the adapter does not proxy them.

```tsx
const organizations = authData.useListOrganizations();
const organization = authData.useOrganization({ organizationSlug: "design" });
const members = authData.useListMembers({ organizationId, limit: 20, offset: 0 });
const received = authData.useListUserInvitations();
const invitation = authData.useInvitation({ id: invitationId });
await authData.organization.inviteMember({ organizationId, email, role: "member" });
```

Other reads: `useMemberRole`, `useListInvitations`, `useListSessions`. Each returns `data`, `error`, `isPending`, `isFetching`, and `refetch`. Resource `refetch()` can retry after a synchronization failure. Client errors (HTTP 4xx except rate limiting) hide previous private results; server/network refresh errors can retain previously authorized data. Query arguments use the upstream endpoint fields. The second hook argument accepts `{ enabled: false }`. Explicit organization scope is required; these hooks do not follow `activeOrganizationId`.

Mutation methods preserve upstream argument tuples, callbacks, throw options, and return values. Supported organization methods are `create`, `update`, `delete`, `leave`, `inviteMember` (including resend), `cancelInvitation`, `acceptInvitation`, `rejectInvitation`, `removeMember`, and `updateMemberRole`. Session methods are `revokeSession`, `revokeOtherSessions`, and `revokeSessions`.

A successful mutation starts cache invalidation; it does not wait for the UI to refresh. Read failures do not change the mutation result. A write finishing after a session change cannot invalidate the new session's cache. `await authData.refresh()` explicitly waits for observed reads to refresh and rejects refresh failures. Original-client/server mutations also propagate through backend signals.

The adapter has a private QueryClient and does not shadow an application's QueryClientProvider. Construct one adapter per configured client and mount its provider once. `dispose()` permanently releases its cache and subscriptions, hides mounted results, and rejects subsequent writes; ordinary unmounting supports remount/Strict Mode.

## Backend registration

Use the official Better Auth **local component installation** with organization schema generation. The runnable setup is in `examples/backend/convex`.

1. Add `authSignalTables` from `/convex` to your application schema.
2. In the Better Auth component, re-export `lookup` from `/convex/component` in an `authData.ts` module. These helpers must remain inside the component, not be exposed directly as public application endpoints.
3. Ensure the local `member` schema has `organizationId_userId`; retain Better Auth's generated `user.email_name` and `organization.slug` indexes.
4. Export `markSessionsChanged` from `/convex` in the app's `authData.ts`.
5. Pass `createSignalTriggers({ features, lookup: components.betterAuth.authData.lookup, markSessionsChanged: internal.authData.markSessionsChanged })` into the official `createClient` triggers option. Use `composeTriggers(applicationTriggers, signalTriggers)` to preserve existing callbacks and ordering.
6. Export `createSignalQueries({ features, lookup, getAuthUser, requireVerifiedInvitationEmail }).signals` as an authenticated public app query. `getAuthUser` delegates to your official auth component.
7. Pass the generated `api.authData` reference to the adapter.

Use the same feature flags on both sides. Protocol/capability mismatches surface as synchronization errors. Supply the **effective** invitation verification requirement from your auth configuration; it is required rather than guessed. In the example a shared `true` constant configures both Better Auth and the bridge. Account for Better Auth's generated/custom-ID defaults if your policy is implicit.

The example sets `advanced.database.generateId: false` so Convex allocates database IDs. Its indexes include session expiry and invitation lookup indexes. Schema generation remains application-owned; regenerate after changing auth plugins/options.

## Guarantees and limits

- Only observed reads subscribe. Identical dependency batches share a watch; each batch is bounded to 100 subjects.
- Directory results watch their organizations, without rewriting a signal for every member on rename. Member rows watch visible profiles; received invitations watch organization/inviter changes.
- Identity keys and cancellation prevent old responses from crossing user/session boundaries. Authentication/access loss masks protected results.
- Initial dependency snapshots revalidate HTTP reads. This is eventual freshness across two transports, not an atomic multi-endpoint snapshot.
- Triggers are atomic with the triggering database operation. A Better Auth endpoint can perform several operations. Bulk session deletion uses a scheduled revision update to reduce contention.
- Reads use a five-second stale time, five-minute inactive retention, cancellation, and no retries. There is no periodic polling. Observers of the same resource share one expiry timer. Future expiry dates cause one-shot refreshes; returned records are never filtered/reinterpreted by the adapter.
- Call `refresh()` from application-owned foreground/network events. It does not renew the Better Auth session. Browser and native wiring live in the example layout.
- Custom fields flow through endpoint types and payloads. Custom table/field renaming, arbitrary additional plugins, teams, SSR, and offline mutation replay are outside this release.

## Replacing an application-owned auth cache

The adapter replaces query keys/options, auth cache invalidation metadata, and signal subscription effects for its supported resources. Keep forms, navigation, mutation pending/error/reset state, reauthentication, and domain cleanup in the application.

- Thin `useMutation` wrappers can call adapter methods with `{ throw: true }`. Keep application mutation variables to endpoint body fields rather than a broad fetch-options bag; this preserves the upstream generic return inference. The adapter itself preserves the original client's throw behavior.
- Mutation completion confirms the write, not refreshed navigation data. Where a destination depends on the updated directory, observe `useListOrganizations()` and await its typed `refetch()` result in a separate post-write phase. A failure there is a synchronization failure, not a failed write.
- `refetch()` returns `{ data, error }`, or `undefined` when disabled/disposed or when the identity changed. It rejects read failures. Hook state uses `isPending` and `isFetching`; it is not the full TanStack observer API.
- Keep account changes on the original auth client. Backend triggers update supported resources; call `refresh()` when a workflow explicitly needs to await them. Keep cleanup of application-owned organization data before deleting the Better Auth organization.
- Move each connected set of readers and writers together. During a staged migration, retain old signal producers while any application still consumes their contract; do not assume an existing application's signal queries are interchangeable with this package's generated references.

## Installation

Install an exact precompiled release. Replace `OWNER/REPOSITORY` with the actual GitHub repository:

```sh
pnpm add '@strawdev/auth-client@github:OWNER/REPOSITORY#v0.1.0'
```

Release tags contain the ready-to-use package at the repository root: JavaScript, declarations, and source maps. Installation does not compile this library, install its development tooling, or require permission to run its build scripts. The application still bundles normally and supplies the documented peer dependencies and authentication/backend configuration.

Keep the dependency manifest and lockfile in each application. Upgrade deliberately to another release tag; development commits do not change an installed release. Private repositories require Git access on developer machines and CI. No npm account or package registry configuration is needed.

The repository has one release path: its manually triggered **Release** GitHub Actions workflow builds and tests the package, updates the `dist` distribution branch, and creates a version tag and GitHub Release. Tags point to compiled snapshots; do not tag source commits manually. The package version determines the tag. Never move or reuse a released tag. No release has been published yet; remote GitHub installation remains unverified until the repository exists.

## Development

Node 24 and pnpm 12. Run `pnpm install`, then `pnpm build`. `pnpm check` covers library/example types, Oxlint, and Oxfmt; `pnpm test` runs controlled contracts. `pnpm test:package` installs a packed tarball in an isolated plain-React consumer and reports bundled incremental size.

For the example:

1. In `examples/backend`, run `pnpm exec convex dev` and select a separate development deployment. The checked-in generated files are refreshed by Convex.
2. Configure deployment variables `BETTER_AUTH_SECRET`, `SITE_URL` (default example web URL `http://localhost:8099`), and `MAILBOX_URL`.
3. Run `pnpm mailbox`. The development-only sink binds localhost:8025 and stores messages in memory. A local Convex backend can use `http://127.0.0.1:8025`; a cloud deployment needs its own reachable test email delivery service.
4. Copy the Expo `.env.example` to `.env.local` and set that deployment's client and HTTP URLs.
5. Run root `pnpm dev`. The library, backend, and Expo watchers remain active. Run `pnpm test:e2e` against the example and mailbox.

`pnpm --filter @example/expo build` exports web; `build:native` produces an Android JavaScript bundle. `android` builds the development app. Use `adb reverse` for local backend/Metro ports when testing on an emulator. Native OS permissions, storage, deep links, and lifecycle events are application responsibilities.

No credentials are included. Publishing and migrating existing applications are separate actions.

## Compatibility and provenance

Development baseline: Better Auth 1.6.22, Convex integration 0.12.5, Convex 1.45.0, TanStack React Query 5.102.8, React 19.2; the example uses Expo SDK 57. Peers initially cover these minor lines. React/TanStack are optional peers for backend-only installs and required when importing the root React entry point.

The official 0.12.5 provider type resolves its abstract session to `never` with this Better Auth version in the example. The example isolates a type cast at that upstream provider boundary; adapter and hook types remain concrete.

Architecture and cancellation patterns were informed by the reference application and Better Auth UI; see `THIRD_PARTY_NOTICES.md`. Verification results and remaining qualification are recorded in `VERIFICATION.md`.

For a typed application context, call `createSignalQueries<DataModel>(options)` using the application's generated Convex `DataModel`. Compose application hooks with `composeTriggers<DataModel, typeof localAuthSchema>(applicationTriggers, signalTriggers)` to retain the official integration's schema-specific callback types. Component lookup references are checked against the exported reader's validator-derived arguments and return metadata.
