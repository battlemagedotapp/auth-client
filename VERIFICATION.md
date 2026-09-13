# Verification — 2026-09-13

## Completed

- `pnpm check`: library and both examples typecheck; type-aware Oxlint and Oxfmt pass.
- `pnpm test`: 22 controlled tests pass, including actual Better Auth transport callbacks, private cache isolation, identity races, protocol failures, deduplicated watch cleanup, Strict Mode, transactional signals, trigger ordering, authorization, and expiry selection.
- Compile-time fixtures reject missing plugin capabilities, disabled feature methods, invalid organization arguments, and invalid custom-field types. Payload inference is checked against accidental `any`.
- `pnpm test:e2e`: two real-browser journeys pass against the isolated local Convex deployment. Coverage includes email verification, invitation delivery and acceptance, remote membership/role/profile/organization changes, removal, reconnect recovery, an idle period without organization polling, sign-out, and sibling-session revocation clearing protected reads.
- `pnpm test:package`: packed tarball installs and typechecks in an isolated consumer with no Expo dependency. All three package entry points resolve. Bundle checks use the installed tarball and assert that client exports exclude backend code and backend exports exclude React/TanStack. Source files ship alongside declaration/source maps.
- Expo Web export and Android Metro/Hermes export passed during the original September 12 qualification; they were not rerun during this review.
- During the September 12 qualification, the Android development APK built and installed on `straw_api_37`. Manual smoke verified sign-in, secure session restoration after force-stop, a web-driven organization update, foreground recovery, and sign-out. A Metro restart was needed after development dependency changes; the final native runtime loaded successfully.
- `pnpm peers check` and the Expo dependency compatibility check pass.

## Library review

The September 13 review separated the internal runtime from the public React entry point and hardened disposal, session-generation boundaries, stale subscription cleanup, mutation completion, resource recovery, and shared expiry timers. Explicit refresh waits for all current attempts before reporting failure. Runtime scope validation prevents falling back to the active organization. Better Auth 400 responses for invalid invitations now hide stale details, while 5xx failures retain previously authorized data. Component readers return only the authorization metadata the bridge needs. No runtime dependency was added.

Regression coverage includes mounted disposal, writes rejected after disposal, actual Better Auth HTTP error behavior, synchronization recovery, late mutations across session changes, stale watch callbacks, invalidation during an in-flight request, shared expiry timers, and refresh failure settlement.

## Bundle measurement

The package check uses esbuild 0.28.1 with browser ESM bundling, minification, and production React. Its baseline exports the Better Auth client/organization plugin and the official Convex React client/auth provider; the comparison additionally exports this adapter.

| Output            |   Bytes | Gzip bytes |
| ----------------- | ------: | ---------: |
| Upstream baseline | 118,598 |     36,388 |
| With adapter      | 162,013 |     49,146 |
| Increment         |  43,415 |     12,758 |

This is a reproducible synthetic import comparison, not a guarantee for every consuming application. TanStack Query already present in an application can reduce its incremental cost. Expo bundles were verified separately from the isolated tarball typecheck.

## Qualification limits

- iOS has not been exercised.
- This is the tested dependency baseline, not a broad multi-version compatibility matrix.
- Native smoke was manual; browser journeys and controlled tests are automated.
- The upstream Convex auth provider's abstract session type requires a narrow cast in the example with Better Auth 1.6.22. The adapter itself retains concrete endpoint types.
- The example's email sink is development-only, in-memory, and localhost-bound. Cloud deployments need an application-configured email service.

## Running review environment

The example uses an isolated local Convex deployment, with client port 3210 and HTTP port 3211. Expo Web runs at http://localhost:8099 and the development mailbox on port 8025. Deployment selection and credentials remain in ignored local environment files.

Library build, Convex, and Expo watchers were left running for review. the reference application was not modified. Nothing was published or committed.

## Upstream and reference compatibility audit — September 13

Reviewed the installed Better Auth 1.6.22, Convex integration 0.12.5, Convex 1.45.0, and TanStack Query 5.102.8 source alongside their official documentation. This audits the pinned compatibility lines; it does not certify untested newer versions.

- **Integration ownership:** the example uses the official Convex authentication provider, the Convex client plugin, SecureStore-backed Expo plugin on native, and cross-domain plugin on web. Those two platform plugins are selected exclusively. Authentication, token renewal, and native/browser lifecycle remain outside the adapter. This follows the [Convex Expo guide](https://labs.convex.dev/better-auth/framework-guides/expo) and [Better Auth Expo guide](https://better-auth.com/docs/integrations/expo). The upstream provider typing workaround remains isolated to the example; its session typing incompatibility is not hidden by widening the adapter client.
- **Backend:** application-owned schema and generated references follow [local installation](https://labs.convex.dev/better-auth/features/local-install). Signals use [official transactional triggers](https://labs.convex.dev/better-auth/features/triggers); scheduled session-deletion signals remain an explicit eventual-consistency exception. Whole HTTP endpoint atomicity is not promised. The example now retains its generated Convex DataModel instead of erasing it with `any`.
- **Development typecheck:** fixed missing Node environment types in the Convex CLI tsconfig. The backend check now runs both its package config and the actual Convex function config, so a passing workspace check cannot conceal this deployment typecheck failure.
- **TanStack:** one stable private QueryClient, complete argument/session keys, explicit QueryClient hook argument, consumed cancellation signals, and cancel-before-invalidate follow the [query-key](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [useQuery](https://tanstack.com/query/latest/docs/framework/react/reference/useQuery), and [cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation) contracts. We do not mount a second QueryClientProvider or attach TanStack global focus/online handlers; network mode is always, automatic retries/focus/reconnect refresh are disabled, and application-owned recovery is explicit.
- **React effects:** exhaustive dependency checking is enabled. Subscription inputs use stable serialized query values while original endpoint arguments remain unchanged; no global effect-dependency suppression remains.
- **Public types:** read payload extraction now follows the reference application's success-envelope discrimination, preserving actual successful null while excluding error-envelope null. Custom fields on organizations, members, and invitations, configured roles, both fetch-option forms, and generic mutation signatures have compile-time coverage against both source and the installed tarball declarations. The provider accepts an opaque adapter type. Runtime dependency inspection uses unknown metadata rather than propagating `any` payloads.
- **Signal correctness:** joined revision counters are preserved individually rather than summed, preventing equal-total collisions after inviter changes. Organization triggers signal both old/new slugs as well as IDs. A controlled backend regression covers the collision.
- **Backend types:** component metadata return types are derived from their validators; helper references specify exact arguments/results. Signal queries retain application DataModel context, and trigger composition supports the official `Triggers<DataModel, Schema>` contract. Compile-time fixtures reject incorrect app writes, incorrect auth fields, and incompatible query references.

A small parameter-variance bridge remains for Better Auth's generated generic functions, as in the reference application. Assertions are limited to assembling conditional capabilities, the app-registered signal table/index contract, and the upstream example/provider or schema-generation boundaries. Removing those assertions mechanically would not prove runtime correctness; the corresponding contracts are covered by inference, backend, transport, and browser tests. Upstream fields such as organization `metadata` retain upstream types, including upstream `any` where applicable.

| the reference application reference use case                             | Adapter mapping / ownership                                                                               |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Shared organization directory                                            | `useListOrganizations`; returned organization revisions avoid update fan-out                              |
| Detail by slug and explicit member role                                  | `useOrganization`, `useMemberRole`                                                                        |
| Member pagination, sorting, filtering, joined profiles                   | `useListMembers` preserves endpoint query fields and profile dependencies                                 |
| Outgoing and received invitations; invitation detail                     | `useListInvitations`, `useListUserInvitations`, `useInvitation`                                           |
| Create/update/delete/leave organization                                  | Explicit `organization` mutation wrappers                                                                 |
| Invite/resend, cancel, accept/reject, remove member, change role         | Explicit wrappers, local invalidation plus remote signals                                                 |
| Session listing and individual/other/all revocation                      | Session capability                                                                                        |
| Foreground and reconnection recovery                                     | Application lifecycle calls `refresh()`                                                                   |
| Sign-in/out, verification, password/email/profile edits                  | Original auth client; relevant backend signals still update supported reads                               |
| Personal organizations, navigation, permissions UI, logo storage         | Application/domain layer, outside the adapter                                                             |
| the reference application's service cleanup before organization deletion | Application orchestration must complete before calling delete; deliberately not reproduced by the library |

Reference comparison inspected the private application’s auth client, shared query/mutation helpers, organization and account flows, navigation postconditions, and backend signal helpers. No private application source, credentials, or deployment configuration is included here.

Final audit verification: `pnpm verify` passes (22 controlled tests plus source type fixtures); `pnpm test:package` passes including the emitted-declaration fixtures and import separation; both browser journeys pass in 22.3 seconds. The restarted root development session and mailbox remain running. Native testing was not repeated for this audit.

Naming update: the public API now uses `createAuthDataClient`, `AuthDataProvider`, and `AuthDataClient`; examples use `authData`. Backend example modules and generated references use `authData`. Supporting names are `CacheRuntime`, `ResourceDependency`, `InvalidationSnapshot`, and `InvalidationApi`. Package identity and existing development deployment/native credential identifiers are unchanged. Source checks, 22 controlled tests, 2 browser journeys, and the packed declaration consumer passed after the rename.

## Migration and public-repository readiness

The private reference application's pinned Better Auth, Expo integration, Convex integration, Convex, TanStack Query, React, and TypeScript versions match this workspace. Its shared member index also matches the component-reader contract. All eight supported reactive reads have mappings. These are semantic mappings, not drop-in replacements for the full TanStack query/mutation observer API.

A representative migration fixture compiles UI-owned mutation state, paginated member reads, and invitation acceptance followed by canonical-slug resolution through typed directory `refetch()`. It is checked against emitted tarball declarations too. A controlled regression verifies that imperative refetch results do not cross a committed session transition. The actual private application has not been migrated or compiled against an installed copy of this package; that integration qualification remains the adoption gate.

A scan of the 72 current non-ignored candidate files found no private-key blocks, common GitHub/AWS token literals, private reference imports, private filesystem paths, or local deployment identifiers. Ignored credentials and generated runtime artifacts remain outside the candidate set. Private-project paths and deployment identity were removed from public-facing documentation. This targeted scan is not a general secret-scanner certification. Upstream MIT attribution is retained.

Compiled release installation is checked by `pnpm test:git`; release snapshots expose the library at their root. The source workspace is not the consumer installation target. No GitHub remote/release, visibility change, registry publication, or commit was made by this review. The application-specific mutation UI, error presentation, session-freshness reauthentication, and organization service-cleanup workflow remain intentionally outside the library. Controlled migration is the recommended next step, rather than removing all existing wrappers at once.

Latest migration-readiness qualification: `pnpm verify` passed with 22 controlled tests; the packed consumer passed including migration type fixtures; both browser journeys passed in 22.7 seconds. Imperative resource refetch waits for its replacement invalidation work rather than exposing the pre-write state restored by cancellation. The reference application’s configured invitation verification policy and Convex-generated IDs match the example contract. No application migration has been performed.

Package naming verification: renamed the published package and consumer imports to `@strawdev/auth-client`. `pnpm verify` passes all type/lint/format checks and 22 controlled tests. `pnpm test:package` installs the renamed tarball in an isolated consumer and verifies declarations and all entry points; measured bundle sizes are unchanged. Repository and source-directory names are unchanged.

## Compiled release qualification

The release path is a manually dispatched GitHub workflow producing precompiled snapshots on `dist`, with version tags and GitHub Release entries. Source-install preparation, the nested build workspace/lockfile, consumer build allowances, and manual source tagging instructions have been removed. The shared `prepareRelease` function emits fresh JavaScript, declarations, maps and attribution, and strips scripts, development dependencies and package-manager metadata from the release manifest. Both tarball and Git checks consume this same output; tarballs are a verification artifact, not a second publication workflow.

`pnpm test:git` installs a release tag from a local compiled Git fixture with no library build permission. The fixture has a newer development commit, but installation must still return the tagged version. A clean frozen-lockfile reinstall, consumer type fixtures and client/backend bundle checks also run. `tests/release.test.ts` exercises publication to a temporary local bare repository: successive releases preserve earlier tags and distribution history, remove obsolete files, and reject version reuse. GitHub CLI calls are stubbed in that test; no authentication or publication occurs externally.

GitHub SSH access and a fresh clone are verified. Release workflow execution and installation from the first actual release tag remain unverified. Browser/native journeys were not rerun for this packaging-only change. The reference application and working repository's commits/tags remain unchanged; only isolated fixtures get commits and tags.

Current packaging results: `pnpm verify` passes all type/lint/format checks and 23 controlled tests; `pnpm test:git` and `pnpm test:package` pass against the compiled output. Installed JavaScript and declaration maps for all three entry points resolve to shipped sources inside the package. Consumer bundle measurements remain 43,415 bytes incremental (12,758 gzip). No library lifecycle script runs during Git installation, and no library build allowance is configured in that consumer.

Post-push qualification: GitHub repository `battlemagedotapp/auth-client` is public, `main` matches source commit `a74341f`, and the manually dispatched Release workflow is active with Actions enabled. A fresh shallow clone installs with the frozen lockfile and passes all 23 tests and type/lint/format checks. The renamed local workspace also passes both compiled consumer checks. No remote tags or workflow runs existed at this check; no release was dispatched.
