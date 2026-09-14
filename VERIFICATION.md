# Verification

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
- Fallow retains the guarded action runner, two browser-covered example controls with estimated-coverage warnings, and two small invitation fragments. Their lifecycle/presentation differences do not justify another abstraction. Seven inherited dead-code findings and eleven inherited complexity findings are recorded separately; no suppressions were added. Gaia introduces no Fallow dead-code, complexity, duplication, or styling findings.

## Reproduce

Run `pnpm verify`, `pnpm test:package`, and `pnpm test:git`. For browser qualification, use the isolated example setup in the README, then `pnpm test:e2e`. Publication uses the existing manually dispatched Release workflow; never move a published tag. Consumers install the compiled Git tag and do not build library source.
