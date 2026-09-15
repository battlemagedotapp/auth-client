# Verification

## v0.4.0 candidate — 2026-09-15

Authentication and account workflows now share the same headless root/hook contract as the
organization and session workflows. Better Auth still owns credentials and reactive session state;
the adapter observes that session without caching a second copy. The application supplies a typed,
identity-checked reactive current-user projection for profile synchronization.

- `pnpm verify`: 88 controlled tests, type contracts, backend/example checks, lint, and formatting.
- `pnpm test:package` and `pnpm test:git`: compiled imports, declarations, backend separation, and
  compilation-free `v0.4.0-rc.1` candidate installation passed.
- `pnpm test:e2e`: all eight isolated local browser journeys passed in 1 minute 18 seconds.
- Live email qualification covers delivered registration verification, password reset, two-step
  email change, and the existing invitation verification/acceptance flow. Its result is recorded
  after the development-provider run rather than inferred from controlled delivery.

Secret fields are cleared after submitted attempts. Successful writes retain only bounded internal
receipts for read or named cleanup recovery; retries do not resubmit credentials, consumed reset
tokens, or primary writes. Callback delivery remains owned by a mounted workflow even when the
official authentication provider remounts for an expected identity transition.

## v0.3.1 — 2026-09-15

Ownership moved to `strawdotdev/auth-client`. Package metadata, installation guidance, and the
`@strawdev/resend-tui` v0.1.2 development dependency now resolve directly to canonical
`strawdotdev` repositories. Runtime behavior is unchanged. `pnpm verify` passed 77 controlled
tests; package, Git-installation, and all eight isolated browser journeys also passed. The
implementation qualified as `v0.3.1-rc.1` (source
`ebe5a102a33d880c9cb70ea515b7efef90b705a1`).

## Live email ownership — 2026-09-14

The isolated example keeps controlled mail local and selects Convex Resend explicitly for live
qualification. `@strawdev/resend-tui` v0.1.2 is pinned only as repository test tooling;
`@convex-dev/resend` 0.2.7 belongs only to the example backend, not the published Auth Client
runtime.

- `pnpm verify`: 77 controlled tests, backend/example types, lint, and formatting passed.
- `pnpm test:package`: the unchanged Auth Client runtime package installed and bundled in an
  isolated consumer.
- `pnpm test:e2e`: all eight local HTTP-mailbox browser journeys passed in 1 minute 24 seconds.
- `pnpm test:email`: the delivered wrong-account, verification, rejection, acceptance, membership,
  and canonical-completion journey passed against development deployment `uncommon-gopher-566` in
  45.5 seconds.

Auth Client owns the detailed authentication journey. Gaia retains only its template, route,
presentation, cleanup, and application-handoff checks; `resend-tui` owns component mailbox behavior.

## v0.3.0 — 2026-09-14

The implementation qualified as `v0.3.0-rc.1` (source `d12c8936f605dca96bdefb44f9434dfbfaaa72f1`). Stable changes only the version and documentation.

- `pnpm verify`: 77 controlled tests, backend integration, type contracts, lint, and formatting passed.
- `pnpm test:package` and `pnpm test:git`: compiled imports, declarations, backend separation, and compilation-free installation passed. The public RC tag was installed into Gaia through pnpm.
- `pnpm test:e2e`: eight isolated local Convex/Expo Web journeys passed. They cover root ownership, organization lifecycle, invitations, sessions, scope retirement, and read-only recovery.
- Gaia: root checks and affected deterministic suites passed, including session validation and deletion preparation. Live journeys passed for creation, dirty updates, section-preserving rename, failed writes, single-write recovery, coordinated deletion, account switching, invitation delivery/wrong-account/acceptance/rejection/leave, session revocation/freshness, and navigation away during pending work. Controlled HTTP member pagination/removal and compact/expanded packaged web reviews passed.

Gaia consumes roots above availability gates and standalone hooks for collection/account composition. Its controls no longer interpret workflow phases or assemble synchronization retries. Product policy, presentation, routing, cleanup, and unsupported account coordination remain outside this library.

## Retained limitations

- Member pagination fetches progressively larger HTTP prefixes; it is not cursor pagination.
- Session lists remain authoritative and bounded; the current session is separate.
- Native execution is unverified. Qualification uses Expo Web and non-production Convex targets only.
- Fallow retains the guarded action runner, two browser-covered example controls with estimated-coverage warnings, and two small invitation fragments. Their lifecycle/presentation differences do not justify another abstraction. Current findings are inherited; no suppressions or new findings were added.

## Reproduce

Run `pnpm verify`, `pnpm test:package`, and `pnpm test:git`. For browser qualification, use the isolated example setup in the README, then `pnpm test:e2e`. Publication uses the existing manually dispatched Release workflow; never move a published tag. Consumers install the compiled Git tag and do not build library source.
