# Verification

## v0.3.0-rc.1 candidate — 2026-09-14

The workflow contract now uses ordinary-child roots and matching context hooks, typed schema definitions, action handles, value-only fields, and bound read-only recovery. Superseded workflow aliases and public recovery receipts are removed. Low-level methods, the private cache, official authentication integration, and transactional signals remain unchanged.

Qualification: `pnpm verify` passes 77 controlled tests and source/type/lint/format checks. All eight isolated local Convex/Expo Web browser journeys pass; the two settings/deletion journeys also pass after the final readiness simplification. Package and Git consumer checks are rerun for the candidate version before publication. Gaia integration qualification is still pending; this is not stable-release approval.

Fallow: no new dead-code or styling findings. Retained findings are the explicit guarded action runner (completion-before-departure differs from departure-before-completion), two browser-covered example controls with estimated coverage warnings, and two small invitation fragments whose different operations/presentation do not justify another abstraction. Seven inherited dead-code findings and eleven inherited complexity findings are separate from this change. No suppressions were added. Graph review confirmed the intentional breaking API boundary; installed declaration tests and the converted example cover the library-side consumers.

Native execution remains unverified. Member pagination remains HTTP-prefix based. The example stays on its isolated local backend; no production deployment is involved.

## v0.2.0 release qualification — 2026-09-14

The user selected `v0.2.0` without a prerelease suffix. The package version and installation examples are updated accordingly. `pnpm verify` passes with 74 controlled tests; both `pnpm test:package` and `pnpm test:git` pass using the exact `0.2.0` manifest, strict installed declarations, backend declaration/runtime separation, source maps, and compilation-free installation. The preceding full browser run passed all 8 journeys; no runtime code changed after that run. The measured adapter increment remains 194,706 bytes minified / 59,300 gzip.

Release limitations remain explicit: member reads use prefix pagination; Gaia must host completion/recovery above availability gates when migrating; native execution is unverified. Publication uses the existing manually dispatched compiled-distribution workflow. The `v0.1.0` tag must remain unchanged.

## Gaia scope and failure/navigation audit — 2026-09-14

Compared directly with Gaia at `c67014ff8cde8d81f1c53153e5b72f5891b53d9b`: organization creation/settings/member collection models, deletion preparation mutations, received/detail invitation models, account sessions, shared workspace selection, and the organization route layout/availability gate. Gaia was read only. The domain workflows cover the intended reusable mechanisms, but this is not a claim of a completed Gaia migration or exact behavior parity.

The main integration finding is the lifetime of route-owned workflows. Gaia's `apps/organization/src/app/(authenticated)/organizations/[organizationSlug]/_layout.tsx` removes tab content when organization availability is no longer ready. A workflow placed inside that content can be retired by its own successful leave/delete/rename before canonical refresh and navigation finish. The migration must place the workflow owner above that availability gate and render protected/unavailable content below it. This preserves the library's deliberate rule that genuinely abandoned screens do not later navigate. The reference repository was not changed to implement that arrangement.

Scope reconciliation:

| Gaia use case                                | Library coverage                                                                                      | Remaining application responsibility or difference                                                                                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Directory and workspace selection            | Controlled ID/slug selection, explicit fallback and unavailable status                                | Route parsing, personal-first ordering/provisioning, section-preserving redirects                                                                                                      |
| Create and rename                            | Typed drafts, validation, write state, canonical organization completion and read-only recovery       | Slugification, uploads, product validation, stable route hosting and navigation callbacks                                                                                              |
| Leave/delete                                 | Exclusive scoped operations, preparation, server failure preservation, directory-absence confirmation | Cleanup service/polling/guards and confirmations; unlike Gaia's current flow, a failed post-write refresh delays navigation until recovery                                             |
| Members                                      | Page state, role/removal actions, conflicts, policies and server errors                               | Owner-count policy queries, table search and presentation; prefix pagination is not efficient cursor pagination                                                                        |
| Invitation creation/outgoing/received/detail | Forms, resend/cancel/respond, ID conflicts, canonical acceptance and independent recovery             | Recipient/verification presentation, account switching, return URLs, role choices and navigation                                                                                       |
| Sessions                                     | Authoritative list, separate current session, ID-based revocation and freshness feedback              | Reauthentication and displaced-session cleanup, device labels/order; arbitrary or list-absent token revocation uses the existing direct API                                            |
| Errors and authentication actions            | Inline phased error state, preserved upstream codes, successful-write distinction                     | Gaia's global mutation host cannot observe the private cache; notifications, field-specific server-error presentation, and coordination with unsupported auth actions remain app-owned |

Added five controlled regressions: update/leave/delete each prove failed writes do not navigate, failed synchronization retains recovery after feedback reset, and read-only retry invokes completion exactly once without another write; a callback may navigate/unmount its initiating creation workflow; navigating away during post-write synchronization suppresses the later callback. These extend existing validation, preparation, callback-failure, invitation recovery, conflict, identity, disposal, freshness and access-removal coverage.

Added an Expo Web browser journey that first rejects deletion with an intercepted HTTP 403, then allows the real deletion but intercepts the directory refresh with HTTP 503. The URL retains its organization selection in both failure states. Restoring reads and clicking recovery clears the selection through the application callback, with exactly two deletion requests total (the denied request and the successful write), and no repeated deletion. Fault injection is explicit; the surrounding authentication and successful write use the isolated real backend.

The README now documents navigation ownership, stable hosting, recovery controls keyed to `pendingSync`, and callback lifetime. If navigation itself unmounts the owner, the already-executed callback is not replayed; the retiring action can resolve `ignored: obsolete`. Once an application callback starts, the library cannot cancel its own asynchronous code. No runtime defect was reproduced by these new tests, so this pass changes verification and migration guidance rather than weakening lifecycle guards.

Idiomatic behavior was checked against React's [event versus effect guidance](https://react.dev/learn/separating-events-from-effects) and TanStack's [mutation callback lifecycle](https://tanstack.com/query/latest/docs/framework/react/guides/mutations): user-action navigation belongs in completion callbacks, not effects watching reactive data; unmounted owners do not receive late completion UI. Existing RHF form ownership and explicit private QueryClient usage remain intact.

Validation: `pnpm verify` passes with **74 controlled tests**, strict source/example/type fixtures, lint and formatting. `pnpm test:e2e` passes all **8 browser journeys** together (1.3 minutes), including the new failure/navigation journey. Package/Git consumer checks were not repeated in this pass because library source, dependencies and exports did not change; the preceding audit's passing checks remain the last artifact qualification. Efficient component cursor pagination, actual Gaia migration/navigation qualification, and native execution remain outstanding or separately scoped. No commits, publication, dependency/version changes, or Gaia edits.

## Source organization and boundary audit — 2026-09-14

Moved the publishable package to `packages/auth-client` and updated workspace links, build/release paths, source fixtures, and documentation. Removed the obsolete package directory after verifying it contained only ignored build/dependency output and empty source directories. Dependency versions, public import paths, package version, and release behavior are unchanged by this pass.

The frontend entry point now only exports the supported API. Client construction, provider lifecycle, and cached reads have separate modules. Domain workflows and their types are grouped under invitations, organizations, and sessions. Shared form/action types no longer live in invitation-specific files; the old invitation field-error names remain compatible aliases. Private names now identify their roles, including `AuthDataContext`, `useCachedResource`, `useWorkflowAction`, `ActionExecution`, `useCommittedRef`, `useOrganizationResource`, and `useOrganizationRecovery`. Compile-time fixtures have descriptive `.types.ts`/`.types.tsx` names. See [source organization](docs/architecture.md).

The audit found a declaration-boundary defect: backend `BackendOptions` and signal helpers imported the frontend client type module, pulling React workflow declarations into their local type graph. Shared wire types now live in `signal-protocol.ts`, and backend declarations depend on that frontend-independent contract. Installed-package verification now traverses relative backend declaration imports and rejects a dependency on client/workflow declarations, in addition to the existing runtime bundle separation check. Public type exports remain available from their existing entry point.

The Convex review corrects the scope of the previous pagination limitation: components do support pagination through `convex-helpers`, and the installed integration already uses helper streams internally. Better Auth's public HTTP endpoint does not expose those cursors. Replacing prefix reads with direct component pages requires an authenticated application wrapper and a defined member-data projection, not merely a different React hook. [Pagination review and proposed extension](docs/pagination.md) records the official guidance, response-contract differences, reactive page boundaries, and required authorization tests. The current transport and signal-only backend contract remain unchanged; efficient member cursor pagination is not claimed as implemented.

Validation completed:

- `pnpm verify`: strict source/example/consumer type checks, Oxlint, formatting, and all **69 controlled tests** pass.
- `pnpm test:integration`: all **5 backend tests** pass.
- `pnpm test:package` and `pnpm test:git`: pass, including the new backend declaration-graph check, strict installed declarations, source/declaration maps, runtime import separation, and compiled Git installation/reinstallation without library compilation.
- `pnpm test:e2e`: all **7 browser journeys** pass together (1.4 minutes).
- Measured adapter increment: **194,706 bytes minified / 59,300 gzip**, versus the previous **194,692 / 59,326**. The small difference reflects module layout/minifier ordering, not a claimed optimization. Runtime dependency contents are unchanged.
- `git diff --check`: clean. An initial offline install could not resolve pnpm's local policy metadata; the subsequent frozen-lockfile install passed without version changes.

No new runtime behavior was intentionally introduced during this cleanup. Native execution remains unverified. Gaia, repository commits, remote branches, release tags, and publication were untouched. Temporary compiled-Git fixtures retain their existing isolated test behavior.

## Organization and session workflows — 2026-09-14

Implemented the five additional client-bound components and equivalent hooks: `OrganizationDirectory`, `OrganizationCreateForm`, `OrganizationSettings`, `OrganizationMembers`, and `Sessions`. Existing invitation components now share the private workflow coordinator and RHF form foundation. All components remain render-prop wrappers without host markup, styles, event objects, navigation, or another provider/cache.

The implementation adds controlled directory selection, typed creation/settings drafts, pristine-server adoption and dirty-draft preservation, canonical-result recovery without repeated writes, deletion preparation, application policies, member pagination/actions, session-ID revocation, and upstream freshness feedback. Shared locks distinguish resource types, coordinate destructive organization operations with scoped writes, and coordinate individual versus bulk session revocation. Identity changes retire drafts, resolved scope metadata, pagination, and callbacks. Required custom fields, schema input/output transforms, configured role contracts, completion discriminants, and disabled capabilities are covered by source and installed type fixtures.

Two discrepancies were found in browser qualification and fixed:

1. **Convex Better Auth 0.12.5 does not support offset pagination.** Its `src/client/adapter.ts` rejects nonzero offsets, and a real second-page request returned HTTP 500. The workflow now requests a server-filtered/sorted prefix through the public `listMembers` method, then slices its unchanged records for `members`. `data` remains the authoritative full prefix response. This is a deliberate deviation from the planned efficient server pagination: later pages transfer more rows and remain subject to upstream/Convex limits. No dependency patch, endpoint reconstruction, business membership cap, or backend protocol change was introduced. Efficient cursor pagination remains future work requiring upstream support or an expanded backend contract. The controlled transport now rejects offsets, preventing the mock from concealing this limitation again.
2. **Settings initially exposed undefined required fields before RHF adopted loaded defaults.** Pristine settings now expose the actual server projection during the layout-reset boundary; RHF remains the state owner. A regression records every non-null form render and verifies its required name binding is always a string. Canonical schema transformations also replace the submitted draft after refresh.

Completed checks:

- `pnpm verify`: strict source, examples, JSX/hook inference, lint, formatting, and **69 controlled tests** pass, retaining the previous 54-test baseline. Added cases include cross-instance member/session conflicts, preparation failure and retirement, policy changes, dirty/server drafts, pagination correction, read-only recovery, callback failures, and identity changes during revocation.
- `pnpm test:integration`: **5 backend contract tests** pass.
- `pnpm test:package` and `pnpm test:git`: pass. Installed declarations are checked with `strict`, `exactOptionalPropertyTypes`, and `noUncheckedIndexedAccess`; JavaScript/declaration maps and client/backend import separation pass. The temporary compiled Git consumer installs and reinstalls from its test tag without library build hooks. These disposable fixture commits/tags do not modify this repository or the published release.
- Browser qualification: all **6 cross-client journeys** pass together (71.5 seconds rounded to 1.2 minutes by Playwright). The additional **real session-freshness journey** passes separately (5.5 seconds including startup). Coverage includes creation/selection/rename, remote edits while dirty, canonical slug adoption, member page correction/removal, leave and last-owner denial, failed/successful deletion preparation, invitation continuity and recipient restrictions, remote session revocation, and application-owned sign-in recovery. Normal assertion/action bounds are ten seconds; account setup has a separate test-level allowance.
- Bundle fixture: baseline **118,598 bytes minified / 36,388 gzip**; with adapter **313,290 / 95,714**; adapter increment **194,692 / 59,326**. The increase over the prior **55,690-byte gzip** increment is **3,636 gzip bytes**. This measurement retains the complete client factory/capabilities, not a guarantee for every consumer bundle.

The root and package READMEs contain the component-first API, application-policy examples, recovery semantics, pagination limitation, and Gaia reconciliation matrix at `c67014ff8cde8d81f1c53153e5b72f5891b53d9b`. The Expo Web example uses the new components; the plain React/type fixtures exercise their consumer API independently of Expo. Existing RHF/resolver/Zod dependency versions and release machinery are unchanged by this increment; no UI framework or native dependency was added to the library.

Native execution remains unverified for these workflows. Large-organization scalability is not qualified by the small browser fixture, particularly given the prefix-pagination limitation. No Gaia edits, repository commits, pushes, version changes, publication, or released-tag changes were made.

## Forms and recovery code review — 2026-09-14

Reviewed the RHF resolver bridge, public TypeScript inference, React lifecycle guards, invitation locks, acceptance receipts, and private-query transport configuration. Three discrepancies were reproduced with failing regressions and fixed:

1. **Transformed resend targets bypassed shared locks.** The form used its draft email to find an invitation ID before schema parsing. A schema could transform that email into a recipient whose cancellation was already in flight, allowing a second write. Forms now claim the validated target synchronously before the TanStack mutation starts. Conflicts resolve as `ignored: busy`, preserve edits, clear busy state, and allow a later retry after the conflicting operation settles. Direct mutation behavior is unchanged.
2. **Field feedback lost original Zod ordering/codes.** Traversing resolver-nested errors could select a later numeric child before the first issue, while union handling could replace `invalid_union` with a branch code. The resolver bridge now records the first original issue per top-level field for that validation attempt before nesting/union expansion. RHF remains the sole persistent error-state owner. A regression checks issue ordering and union codes with malformed runtime input.
3. **Cached reads inherited upstream HTTP retries.** Disabling TanStack retries alone allowed a supplied Better Auth client's retry policy to send additional requests. Library-owned reads now also pass `retry: 0` through public fetch options, matching the documented no-automatic-retry contract. A real-client regression demonstrated two HTTP requests before the fix and one afterward.

Qualification: `pnpm verify` passes with **54 controlled tests**, plus strict source/example/type-fixture checks, Oxlint and formatting. `pnpm test:integration` passes all **5 backend tests**. Both `pnpm test:package` and `pnpm test:git` pass, including strict installed declarations, source maps, import separation, and compilation-free Git installation. All **5 browser journeys** pass (56.5 seconds). The measured adapter increment is now **182,094 bytes minified / 55,690 gzip**, an increase of **113 gzip bytes** from the preceding checkpoint.

The components remain render-prop wrappers with no host markup, UI events, styles, navigation, accessibility implementation, or additional provider. The existing inference fixtures cover schema inputs/outputs, configured roles, custom fields, callback payloads, and disabled capabilities. Review references included React's [ref and render contract](https://react.dev/reference/react/useRef), Zod's [library-author guidance](https://zod.dev/library-authors), and the installed RHF 7.88.0/resolver 5.9.1 public APIs and implementation. Native execution remains unverified. No dependency/version changes, commits, publication, release-tag changes, or Gaia edits were made during this review.

## React Hook Form, Zod, and invitation recovery — 2026-09-14

The invitation form now uses React Hook Form 7.88.0 for editable state and the Zod resolver 5.9.1 for validation. Zod 4.6.4 is an exact development/example dependency and a `~4.6.4` package peer. Existing dependency versions and the package version remain unchanged. A narrow pnpm minimum-release-age exception permits only the explicitly requested Zod version.

Schema-backed forms infer draft inputs separately from Better Auth submission values. Validation supports asynchronous transforms and application validators, preserves literal top-level field names, maps nested issues to their owning field, and keeps root failures separate from HTTP errors. RHF owns dirty/touched/errors; the existing coordinator owns submission locks and lifecycle guards. Recovery receipts are invitation-specific, so a failed acceptance refresh no longer blocks unrelated invitations or overwrites an earlier receipt.

Completed qualification:

- `pnpm verify`: strict library/example/type-fixture checks, Oxlint, formatting, and **51 controlled tests** pass. The prior 39-test baseline is retained. Added cases cover transformed drafts, authoritative schema output, optional undefined fields, nested/root/literal-field feedback, dirty/reset state, dependent async validation, stale validation across lifecycle transitions, double submission, validator failures, and independent recovery receipts.
- `pnpm test:integration`: all **5 backend contract tests** pass.
- `pnpm test:package` and `pnpm test:git`: compiled tarball and tagged temporary Git consumers pass under `strict`, `exactOptionalPropertyTypes`, and `noUncheckedIndexedAccess`. JavaScript/declaration maps, client/backend import separation, and frozen-lockfile Git reinstall pass. Consumer installation does not compile the library. Only the Zod resolver integration is imported; no UI or native dependency was added.
- `pnpm test:e2e`: all **5 browser journeys** pass (58.1 seconds) against the isolated example deployment. Actual Better Auth flows cover cross-client invitation operations, canonical-organization completion, session isolation, wrong recipients, cancelled/expired links, verification recovery, and a string draft reaching the real endpoint as numeric ticket data. Expiry and unverified-account preconditions use administrative fixtures in the local example component; verification recovery itself uses the actual email flow. Propagation assertions retain ten-second bounds.
- Measured browser adapter increment: **181,915 bytes minified / 55,577 bytes gzip**, compared with **54,382 / 15,814** before this increment: **+127,533 minified / +39,763 gzip**. This includes RHF, the resolver, and the library's default Zod schemas over the existing Better Auth/Convex baseline. Named public Zod imports avoid importing the full namespace and unused locale exports. The dependency cost is material; it is not presented as a size-neutral refactor. Measurements will differ when an application already includes these dependencies.

The Expo Web example includes schema-free and transformed-field forms, field/action feedback, and invitation-specific recovery controls. The isolated example schema adds only an optional numeric invitation field; the library backend signal protocol is unchanged. Temporary consumer tooling now resolves package-local build dependencies and writes a pnpm-compatible workspace configuration, preserving the existing compiled-release process.

Native execution for this increment is **unverified**. No Gaia migration, source commit, push, version bump, publication, or modification of the published `v0.1.0` tag was performed. The results below are historical checkpoints, not claims about the current dependency contents or bundle size.

Public API references: [Zod package and parsing contract](https://zod.dev/packages/zod), plus the installed React Hook Form and resolver declarations/source used by the controlled and packed-consumer tests.

## Headless quality and TypeScript audit — 2026-09-14

Reviewed public inference, internal endpoint calls, React render/effect ownership, conflict handling, mutation retention, callback recovery, and import/render boundaries. Fixed the following issues:

1. A TanStack mutation queued before unmount could still start its HTTP write afterward. The invocation now checks its initiating effect lifetime immediately before calling Better Auth. A regression reproduced the unwanted request before the fix.
2. Disabling and re-enabling a workflow could revive an old completion. A suspension counter now permanently retires that continuation. Retained form bindings also check current availability, while edits survive an explicit enabled toggle.
3. Effect teardown/restoration could reuse the same logical owner. Each action now captures its effect lifetime, preventing an old action from updating a restored workflow or clearing a newer action's pending state. A React Activity regression covers this with two independently delayed writes. Ownership uses state rather than relying on memo-cache retention.
4. TanStack retry suppression did not override a configured Better Auth transport retry. Workflow calls now explicitly set HTTP retries to zero too; a real-client regression supplies a retrying transport configuration. Direct mutation behavior is unchanged.
5. The internal invitation bridge inherited the general endpoint's permissive argument signature. It now declares the precise supported operation names, scope/ID arguments, and throwing/no-retry options, while keeping untrusted payloads `unknown`. Public roles/custom fields remain derived from the concrete client. Public actions/hooks use function properties, and owned touched/error maps are read-only. Additional negative type fixtures guard against accidental `any` payloads and invalid optional-field setters.

Headless boundaries remain intact: component wrappers only call their hook and return consumer-rendered children; they create no host elements, styles, platform events, accessibility behavior, navigation, or second provider/cache. The README clarifies pure render props, stable client construction, control-owned accessibility, and the distinction between an unconfirmed write and a confirmed successful write.

Validation: `pnpm verify` passes with **39 tests**, including 16 invitation tests. Both compiled consumer checks pass with **strict**, **exactOptionalPropertyTypes**, and **noUncheckedIndexedAccess**, including source/declaration maps and import separation. All **3 browser journeys** pass (35.0 seconds). Final incremental bundle size is **54,382 bytes minified / 15,814 gzip**, or **3,056 gzip bytes above the previous released adapter**. Native execution remains unverified. No dependency, version, release, commit, or reference-application change was made.

The remaining conditional-client assembly assertion is intentional: TypeScript cannot narrow the generic capability flags from runtime booleans. Runtime payload inspection remains `unknown` with guards, and real-client transport/type fixtures cover that boundary; this is not a claim that arbitrary third-party payloads are validated exhaustively.

Guidance checked: React's [ref/render separation](https://react.dev/reference/react/useRef), [memoization caveats](https://react.dev/reference/react/useMemo), [guarded state adjustment](https://react.dev/reference/react/useState#storing-information-from-previous-renders), and [Activity effect lifecycle](https://react.dev/reference/react/Activity); TanStack's [mutation contract](https://tanstack.com/query/latest/docs/framework/react/reference/functions/useMutation); TypeScript's [function typing](https://www.typescriptlang.org/docs/handbook/2/functions.html). Behavior was verified against the repository's installed versions, which remain pinned.

## Headless invitation increment — 2026-09-14

Local changes add four client-bound render-prop components and their equivalent hooks: invitation form, received invitations, single invitation response, and outgoing invitations. They use the existing provider, private QueryClient, direct mutation wrappers, and backend signals. No backend schema, protocol, dependency version, package version, or release mechanism changed.

- `pnpm verify`: source/example type checks, Oxlint, Oxfmt, and 35 controlled tests pass. Twelve invitation tests cover actual Better Auth transport behavior, required/custom validation, defaults and scope resets, disabled actions, shared locks (including resend forms and unmounted initiators), identity/authentication/disposal boundaries, synchronization-only recovery, original upstream write errors, callback failures, Strict Mode, and an unrelated application QueryClient.
- Source and installed-declaration fixtures cover configured roles, required custom invitation fields, optional organization fields, JSX render props/callbacks, typed form setters, workflow hooks, and disabled capabilities. Existing low-level fixtures continue passing.
- `pnpm test:package` and `pnpm test:git`: compiled consumers pass, including the new JSX fixture, source/declaration maps, client/backend import separation, and Git frozen-lockfile reinstall. No consumer library compilation is required. Git fixture tags exist only in temporary test repositories.
- `pnpm test:e2e`: all three browser journeys pass in 34.7 seconds. Two independent contexts exercise creation, resend, cancellation, rejection, list/detail acceptance, canonical organization completion, member/profile updates, removal, session revocation, offline recovery, and no periodic idle organization reads. Normal assertions retain ten-second bounds. Initial failed runs could not create users against the stale pre-rename local backend; restarting the isolated example backend resolved the setup failure.
- Measured incremental browser bundle over the existing Better Auth/Convex baseline: **54,023 bytes minified / 15,700 gzip**, versus the previous adapter's 43,415 / 12,758. This increment adds **10,608 bytes minified / 2,942 gzip**. The published package still has no Expo, React Native, UI, form, or validation dependencies.
- Expo Web runs the four components with ordinary React Native controls. Native execution for these new components is **unverified**; no Android or iOS qualification is claimed for this increment.

The README is component-first and documents form ownership, typed custom fields, completion callbacks, operational outcomes, and successful-write/failed-refresh recovery. Existing `v0.1.0` remains unchanged and does not include these additions. No source commit, push, publication, or reference-application migration was performed. Release approval remains a separate step.

## Previous verification — 2026-09-13

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

GitHub SSH access and a fresh clone are verified. The first release workflow and public tag installation have now been exercised; see the release record below. Browser/native journeys were not rerun for this packaging-only change. The reference application and working repository's commits/tags remain unchanged; only isolated fixtures get commits and tags.

Current packaging results: `pnpm verify` passes all type/lint/format checks and 23 controlled tests; `pnpm test:git` and `pnpm test:package` pass against the compiled output. Installed JavaScript and declaration maps for all three entry points resolve to shipped sources inside the package. Consumer bundle measurements remain 43,415 bytes incremental (12,758 gzip). No library lifecycle script runs during Git installation, and no library build allowance is configured in that consumer.

Post-push qualification: GitHub repository `battlemagedotapp/auth-client` is public, `main` matches source commit `a74341f`, and the manually dispatched Release workflow is active with Actions enabled. A fresh shallow clone installs with the frozen lockfile and passes all 23 tests and type/lint/format checks. The renamed local workspace also passes both compiled consumer checks. No remote tags or workflow runs existed at this check; no release was dispatched.

First release: `v0.1.0` was built from source `b0fd109d38ae440425cd91ae8ceb43eeb2733da9`, with distribution commit `6fe6085e644c1c3280224211322bb11f366bd24a`. GitHub Actions run `34749375910` passed verification, built the package, and pushed the distribution branch and tag. Its final release-page API request returned HTTP 502; the page was subsequently created from the existing tag without modifying it. The run remains marked failed because of that recovered API error.

An isolated consumer installed `github:battlemagedotapp/auth-client#v0.1.0` successfully and passed version, lifecycle-metadata, inferred-type, source-map and bundle-separation checks, followed by a frozen-lockfile reinstall. No library compilation or build allowance was required. This post-release documentation update does not alter the published tag. The private reference application remains untouched.
