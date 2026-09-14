# Better Auth × Convex Client

`@strawdev/auth-client` provides headless organization, member, invitation, and session workflows around an existing Better Auth client backed by Convex. It uses Better Auth HTTP endpoints for data and writes, TanStack Query for caching, and authenticated Convex revision queries for invalidation.

Version `0.2.0` adds headless organization, member, invitation, and session workflows. The existing `v0.1.0` tag contains the low-level API only and remains unchanged.

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

## Organization and session components

The configured client exposes these components and matching hooks. Components return your rendered children without adding elements. They share the existing provider, queries, subscriptions, and mutation coordinator. `organization: true` enables organization/member/invitation workflows; `sessions: true` enables session workflows.

| Component / hook                                       | Owned behavior                                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `OrganizationDirectory` / `useOrganizationDirectory`   | Directory reads and controlled selection                                            |
| `OrganizationCreateForm` / `useOrganizationCreateForm` | Creation drafts, validation, canonical completion, recovery                         |
| `OrganizationSettings` / `useOrganizationSettings`     | Detail/role reads, editable drafts, updates, leave/delete, preparation and recovery |
| `OrganizationMembers` / `useOrganizationMembers`       | Member reads, pagination, role changes, removal and policy decisions                |
| `Sessions` / `useSessions`                             | Session list, current-session identity, revocation and freshness feedback           |

All actions return `WorkflowOutcome<T>` (`success`, `error`, or `ignored`). `WorkflowError` retains the upstream cause and distinguishes `validation`, `preparation`, `write`, `synchronization`, and `callback`, with `writeSucceeded`. Reads expose `queryError` separately. `pendingAction` contains an operation and relevant resource IDs; it never contains a session token. Handlers can be passed directly to controls without binding `this`.

### Directory and creation

```tsx
<authData.OrganizationDirectory
  selection={organizationId ? { organizationId } : undefined}
  onSelect={(organization) => navigateToOrganization(organization.slug)}
>
  {(directory) => directory.data?.map((organization) => (
    <button key={organization.id} onClick={() => void directory.selectOrganization(organization.id)}>
      {organization.name}
    </button>
  ))}
</authData.OrganizationDirectory>

<authData.OrganizationCreateForm
  initialValues={{ name: "", slug: "" }}
  onCreated={({ organization }) => navigateToOrganization(organization.slug)}
>
  {(form) => (
    <>
      <input aria-label="Name" value={form.field("name").value}
        onChange={(event) => form.field("name").onChange(event.target.value)}
        onBlur={form.field("name").onBlur} disabled={form.field("name").isDisabled} />
      <input aria-label="Slug" value={form.field("slug").value}
        onChange={(event) => form.field("slug").onChange(event.target.value)}
        onBlur={form.field("slug").onBlur} disabled={form.field("slug").isDisabled} />
      <button disabled={form.isBusy} onClick={() => void form.submit()}>Create</button>
      {form.pendingSync && <button onClick={() => void form.retrySync()}>Retry refresh</button>}
    </>
  )}
</authData.OrganizationCreateForm>
```

Directory selection accepts an explicit ID or slug. Its status is `loading`, `error`, `empty`, `unselected`, `unavailable`, or `ready`. Default `fallback="none"` leaves omitted selection unselected; opt into `fallback="first"` to use the first returned organization. Invalid explicit selections never fall back. Selection callbacks do not change Better Auth's active organization or navigate automatically.

Creation requires the upstream required fields, including configured custom fields. Optional schemas infer draft input separately from submission output, as with invitation forms. Required name/slug checks do not trim, slugify, or impose custom product policy. `keepCurrentActiveOrganization` defaults to `true` and can be explicitly changed; direct `organization.create` retains upstream behavior. On success, the form resets to the latest defaults and the workflow resolves the canonical organization from a fresh directory before `onCreated`.

### Settings and deletion preparation

```tsx
<authData.OrganizationSettings
  organizationId={organizationId}
  getInitialValues={(organization) => ({ name: organization.name, slug: organization.slug })}
  policy={{
    delete: ({ organization }) =>
      protectedIds.has(organization.id)
        ? { allowed: false, code: "protected-organization" }
        : { allowed: true },
  }}
  beforeDelete={({ organizationId, signal }) => prepareApplicationDeletion(organizationId, signal)}
  onUpdated={({ organization }) => navigateToOrganization(organization.slug)}
  onLeft={() => navigateHome()}
  onDeleted={() => navigateHome()}
>
  {(settings) =>
    settings.form && (
      <>
        <input
          aria-label="Name"
          value={settings.form.field("name").value}
          onChange={(event) => settings.form?.field("name").onChange(event.target.value)}
          disabled={settings.form.field("name").isDisabled}
        />
        {settings.hasServerChanges && <p>The organization changed remotely.</p>}
        <button disabled={settings.isBusy} onClick={() => settings.form?.reset()}>
          Reset draft
        </button>
        <button
          disabled={settings.isBusy || !settings.availability.update.allowed}
          onClick={() => void settings.form?.submit()}
        >
          Save
        </button>
        <button
          disabled={settings.isBusy || !settings.availability.delete.allowed}
          onClick={() => void settings.delete()}
        >
          Delete
        </button>
        {settings.pendingSync && (
          <button onClick={() => void settings.retrySync()}>Retry refresh</button>
        )}
      </>
    )
  }
</authData.OrganizationSettings>
```

Settings accept ID or slug scope. Once resolved, the mounted workflow follows the organization ID so a successful slug rename can refresh its detail. `form` is `null` until an authorized record exists. `getInitialValues` projects editable fields, and must return schema input when a schema is supplied. Custom update fields and callbacks retain the concrete client's types. `update(data)` handles partial writes such as an uploaded logo URL without submitting the form.

Pristine forms adopt new server projections. Dirty forms retain the complete draft and expose `hasServerChanges`; explicit reset adopts the latest projection. Confirmed form writes reset to the submitted draft baseline, and successful refresh adopts the canonical projection. This is not optimistic concurrency or conflict prevention; the server decides the write result.

Create/update completion resolves the organization from the refreshed directory; settings also refresh detail. Leave/delete completion verifies its absence from that directory. A failed read after a successful write produces `writeSucceeded: true` and retains only an operation/organization-ID recovery receipt. `retrySync()` repeats reads, never the write or deletion preparation. `reset()` does not discard recovery. Further writes through that workflow are unavailable while recovery is pending. Callbacks run once after recovery is cleared; callback failures never replay writes or callbacks.

`beforeDelete` runs under the organization's exclusive workflow lock, before Better Auth deletion. Failures are `preparation` errors. Unmounting, disabling, identity changes, and disposal abort its signal and suppress subsequent deletion. The application owns cleanup, timeouts, and server guards; cleanup must be safe for explicit retries. Aborting cannot undo completed cleanup or an HTTP request already sent. Put confirmation UI and confirmation-text state in the application.

### Members and policies

```tsx
<authData.OrganizationMembers
  organizationId={organizationId}
  pageSize={25}
  query={{ sortBy: "role", sortDirection: "asc" }}
>
  {(members) => (
    <>
      {members.members.map((member) => (
        <div key={member.id}>
          {member.user.name}
          <button
            disabled={members.isBusy || !members.availability(member.id).remove.allowed}
            onClick={() => void members.removeMember({ memberId: member.id })}
          >
            Remove
          </button>
        </div>
      ))}
      <button disabled={!members.hasPreviousPage} onClick={members.previousPage}>
        Previous
      </button>
      <button disabled={!members.hasNextPage} onClick={members.nextPage}>
        Next
      </button>
    </>
  )}
</authData.OrganizationMembers>
```

Supply a positive integer `pageSize`. The workflow owns `page`, `setPage`, next/previous actions, page bounds and total. Filter/sort fields match the upstream endpoint; changing them, scope, or page size resets page zero. Removals clamp invalid pages. Old pages/scopes are not displayed as current results. Search over the visible page is not global search, and generic table search/sort UI stays in the application.

The supported Convex Better Auth 0.12.5 adapter rejects nonzero offsets. Member pagination therefore requests a server-filtered, sorted prefix with `limit = (page + 1) * pageSize`, then exposes the requested page through `members`. `data` remains the unchanged endpoint response, including that prefix. Later pages fetch more rows; this is not efficient cursor/offset pagination and remains subject to upstream endpoint and Convex limits. No arbitrary membership cap is added. A future cursor implementation requires upstream support or an explicitly expanded backend contract.

`updateMemberRole({ memberId, role })` and `removeMember({ memberId })` act on observed members. Arbitrary-ID/email actions remain on direct methods. Role input retains the upstream endpoint's actual signature: Better Auth's role-update endpoint permits additional string roles; the adapter does not invent a narrower union. Invitation role inputs retain their independently inferred constraints.

Optional member `policy` callbacks are `removeMember(context)`, `updateMemberRole({ ...context, nextRole })`, and `assignableRoles(context)`. Context includes organization, actor ID/role, and the target member. Settings policies are `update`, `leave`, and `delete`. Decisions are `{ allowed: true }` or `{ allowed: false, code }`. Policy denials are exposed for controls and enforced before writes; policies are synchronous and pure. Missing policy means no additional local restriction, not guaranteed server permission. Never infer last-owner protection from a partial member page; Better Auth's authorization and original error codes remain authoritative.

### Sessions and action isolation

```tsx
<authData.Sessions>
  {(sessions) => (
    <>
      {sessions.needsFreshSession && <p>Sign in again to manage sessions.</p>}
      {sessions.data?.map((session) => (
        <button
          key={session.id}
          disabled={sessions.isBusy}
          onClick={() => void sessions.revokeSession(session.id)}
        >
          Revoke session
        </button>
      ))}
      <button disabled={sessions.isBusy} onClick={() => void sessions.revokeOtherSessions()}>
        Revoke others
      </button>
    </>
  )}
</authData.Sessions>
```

Workflow `revokeSession(sessionId)` resolves its token from observed list data. The direct `authData.revokeSession({ token })` API is unchanged. Session ordering and upstream list bounds are preserved. `currentSession`/`currentSessionId` come separately from the existing public session hook; the workflow does not insert a missing current session into the list. `needsFreshSession` reflects `SESSION_NOT_FRESH`; authentication/session renewal remains application-owned. Current/all-session revocation can retire the initiating identity and therefore suppress its callback even though the server applied the write.

Each workflow has one active operation. Namespaced invitation/member/session locks prevent duplicate cross-component writes; organization leave/delete exclude other participating writes for that organization. Session-wide revocation excludes individual revocations. Conflicts return `ignored: busy`; no operations are queued. Locks survive initiating unmount until settlement. These are adapter-local protections, not distributed locks; original-client/server writes remain governed by the backend.

### Gaia reconciliation

Compared against the reference application at `c67014ff8cde8d81f1c53153e5b72f5891b53d9b`. This is a later migration guide, not a migration performed here.

| Reference responsibility                         | Replace with                                     | Application retains                                                   |
| ------------------------------------------------ | ------------------------------------------------ | --------------------------------------------------------------------- |
| Directory resolution / workspace selection       | `OrganizationDirectory`                          | Route parsing, ordering, personal-organization labels                 |
| Creation form and post-create refresh            | `OrganizationCreateForm`                         | Slugification/schema policy, uploads, navigation                      |
| Settings forms and update/leave/delete mutations | `OrganizationSettings`                           | Confirmation UI, personal restrictions, cleanup service/server guards |
| Member query/page state and mutation runners     | `OrganizationMembers`                            | Generic table presentation, policy callbacks                          |
| Invite form / outgoing mutation state            | `InvitationForm`, `OrganizationInvitations`      | Role choices, status filters, table search/sort                       |
| Received/detail acceptance sequencing            | `ReceivedInvitations`, `InvitationResponse`      | Link parsing, wrong-account UI, navigation                            |
| Session list and revocation mutation state       | `Sessions`                                       | Reauthentication, translations, timestamps, device labels             |
| Cache invalidation and duplicate-action guards   | Existing runtime and shared workflow coordinator | Foreground/network recovery wiring                                    |

Account profile/email/password and sign-in/up flows remain outside this increment. No feature model needs mutation keys, query invalidation effects, locks, or canonical-refresh sequencing for the supported workflows. These headless APIs are included in `v0.2.0`; the published `v0.1.0` tag remains unchanged.

### Navigation and failure integration

Navigate from `onCreated`, `onUpdated`, `onAccepted`, `onLeft`, or `onDeleted` after the workflow confirms its completion contract. Do not watch query data or a success flag in an effect to trigger the same navigation: reactive updates are not new user actions. Failed writes never call completion callbacks. A successful write followed by a failed refresh exposes `writeSucceeded: true` and `pendingSync`; render a read-only recovery action instead of submitting again. `reset()` clears feedback but retains that recovery, so retry controls should depend on `pendingSync`, not only the current action error.

Host the workflow in a stable route/layout component above availability gates that could remove its screen after a deletion, leave, or slug change. Render unavailable content below that owner. This matters in Gaia: its organization layout can replace the tab content when the directory no longer resolves the route. Unmounting intentionally retires the workflow and its recovery; it will not navigate afterward. An ordinary user's navigation away should have exactly that behavior. Do not keep protected data visible merely to keep a workflow mounted.

If a completion callback itself navigates and unmounts its owner, the callback has run once, but the action promise may resolve as `ignored: obsolete`. This does not undo the write or mean it should be repeated. The library checks ownership before invoking a callback; it cannot cancel application code once that callback has started. Keep route transitions immediate, or guard any application-owned asynchronous continuation separately.

Gaia's personal-organization ordering, owner-count queries for policy presentation, field-specific server-error messages, authentication-wide locks, reauthentication/displaced-session cleanup, and route parsing/redirect rules remain application-owned. The private QueryClient does not feed Gaia's existing application-wide mutation error host; consumers must present the workflow's error/outcome. Session records remain authoritative and unmerged; if the separately exposed current session is absent from the bounded list, the existing direct method remains available for token-based operations.

## Headless invitation components

Use components from the configured client inside its matching `AuthDataProvider`. They render only their children, with no HTML or native elements. Your application supplies controls, navigation, notifications, and permission presentation.

Create the configured client outside component rendering so its component identities remain stable. Render-prop children are pure render functions: invoke actions from events, and use the equivalent workflow hook inside a regular component when you need additional hooks. Field bindings accept values, never browser or native event objects. The package does not supply accessibility markup; labels, focus behavior, and announcements belong to the controls you render.

```tsx
<authData.InvitationForm
  organizationId={organizationId}
  initialValues={{ role: "member" }}
  onInvited={() => notify("Invitation sent")}
>
  {(form) => (
    <>
      <input
        aria-label="Invitation email"
        value={form.field("email").value}
        onChange={(event) => form.field("email").onChange(event.target.value)}
        onBlur={form.field("email").onBlur}
        disabled={form.field("email").isDisabled}
      />
      <button disabled={form.isBusy} onClick={() => void form.submit()}>Invite</button>
    </>
  )}
</authData.InvitationForm>

<authData.InvitationResponse
  invitationId={invitationId}
  onAccepted={({ organization }) => openOrganization(organization.slug)}
>
  {(state) => (
    <>
      <span>{state.invitation?.organizationName}</span>
      <button disabled={state.isBusy || state.isPending} onClick={() => void state.accept()}>Accept</button>
      <button disabled={state.isBusy || state.isPending} onClick={() => void state.reject()}>Reject</button>
      {state.error?.phase === "synchronization" && (
        <button onClick={() => void state.retrySync()}>Retry organization refresh</button>
      )}
    </>
  )}
</authData.InvitationResponse>
```

| Component / equivalent hook                              | Scope and actions                                                                                    |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `InvitationForm` / `useInvitationForm`                   | Explicit `organizationId`, required `initialValues`, `submit()`; optional `mode: "resend"`           |
| `ReceivedInvitations` / `useReceivedInvitations`         | Upstream recipient `data`, `accept(invitationId)`, `reject(invitationId)`, `retrySync(invitationId)` |
| `InvitationResponse` / `useInvitationResponse`           | Explicit `invitationId`, `invitation`, `accept()`, `reject()`, `retrySync()`                         |
| `OrganizationInvitations` / `useOrganizationInvitations` | Explicit `organizationId`, outgoing `data`, `cancel(invitationId)`, `resend(values)`                 |

Hooks accept the same options as their components and return the same state. For example, `authData.useOrganizationInvitations({ organizationId })` supports a custom component layout without another provider or cache. Lists preserve upstream status semantics; the application decides which invitations to display.

### Form contract

`initialValues` requires the configured role and all required custom invitation fields. Email defaults to an empty string. The example's `"member"` is an application choice, not a library default. Values exclude organization scope, team fields, resend flags, and transport options. Both resend surfaces call the public invitation endpoint with `resend: true`; outgoing `resend(values)` requires complete typed values rather than guessing custom fields from a list row.

React Hook Form owns `values`, `touched`, `fieldErrors`, `isDirty`, and `isValidating`. The existing `field(name)` bindings expose typed `value`, `onChange(value)`, `onBlur()`, `error`, and `isDisabled`; there is no additional form provider or RHF control object to pass around. Field names are literal top-level names, including names containing dots or brackets.

The default form validates required email and nonempty role selections; Better Auth owns email-format, permissions, duplicate, and policy validation. Optional synchronous or asynchronous `validate(values)` receives **validated submission values** and returns field issues such as `{ email: { code: "company-email", message: "Use your work email" } }`. Upstream errors are not guessed into field errors. Root schema issues and unexpected validator failures appear in `validationError`, with `code`, optional `message`, and the original `cause` for thrown failures.

Validation runs on blur and revalidates the whole form on subsequent changes once a field has been touched or submission attempted. This updates dependent-field errors too. No debounce or remote validation is added automatically. Older asynchronous results cannot restore errors belonging to a retired draft, reset, identity, or organization. A pending submit acquires its conflict lock before validation begins.

Edits are blocked while submitting without removing their values from the payload. Successful writes reset fields before `onInvited`. Changing the initial-values object does not overwrite edits; `reset()` uses the latest defaults and clears touched/dirty/validation feedback. Identity, organization, or mode changes reset the form. Schema changes apply to subsequent validations; defaults apply on explicit or lifecycle resets. Disabling and re-enabling preserves edits and retires old completions.

### Schema-backed draft values

Supply an optional Zod 4 schema when editable values differ from the endpoint body. Its input type determines `initialValues`, `values`, and field bindings; its output must satisfy the supplied Better Auth client's configured roles and required custom fields. Schemas exclude organization scope, teams, resend flags, and transport options. Schema-mode defaults must include required input fields rather than guessing defaults from the output type.

```tsx
import { z } from "zod";

// The application configures `ticket` as a numeric invitation field in Better Auth.
const schema = z.object({
  email: z.string().min(1),
  role: z.literal("member"),
  ticket: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().nonnegative()),
});

<authData.InvitationForm
  organizationId={organizationId}
  schema={schema}
  initialValues={{ email: "", role: "member", ticket: "" }}
>
  {(form) => (
    <input
      aria-label="Invitation ticket"
      value={form.field("ticket").value}
      onChange={(event) => form.field("ticket").onChange(event.target.value)}
      onBlur={form.field("ticket").onBlur}
      disabled={form.field("ticket").isDisabled}
    />
  )}
</authData.InvitationForm>;
```

The draft ticket remains a string; the HTTP request receives a number. Zod parsing supports asynchronous refinements/transforms through the maintained Zod resolver. Parsed output is authoritative: fields stripped by a schema are not merged back into the request. Required email/role checks still apply after parsing, followed by optional `validate()`. The first issue for each top-level field is exposed, with nested issues attached to their owning top-level field. The library does not derive runtime custom-field rules from TypeScript types.

For example, a HeroUI input can consume the same binding (illustrative, HeroUI is not installed):

```tsx
const email = form.field("email");
<Input
  value={email.value}
  onValueChange={email.onChange}
  onBlur={email.onBlur}
  isDisabled={email.isDisabled}
  isInvalid={Boolean(email.error)}
  errorMessage={email.error?.message ?? email.error?.code}
/>;
```

### Completion, errors, and recovery

Read workflows expose `isPending`, `isFetching`, `queryError`, and `refetch()`. Every workflow exposes action `error`, `isBusy`, structured `pendingAction` (`operation` and invitation ID when known), and `reset()` for settled feedback. `enabled: false` suspends actions and reads. Expected action failures resolve rather than rejecting event handlers:

```tsx
const outcome = await state.accept();
if (outcome.status === "success") console.log(outcome.data.organization.slug);
if (outcome.status === "error") console.log(outcome.error.phase, outcome.error.cause);
if (outcome.status === "ignored") console.log(outcome.reason);
```

Errors distinguish `validation`, `write`, `synchronization`, and `callback`, retaining the original cause and `writeSucceeded`. Ignored reasons are `disabled`, `busy`, `obsolete`, or `unavailable`. Concurrent actions on a known invitation ID share a lock across workflows; unrelated invitations remain independent. Writes are never retried or queued offline.

Workflow-owned calls disable retries at both the TanStack and HTTP transport layers. `writeSucceeded` reports confirmation through the public client result; a transport failure does not prove that the server made no change. Existing direct methods continue honoring their original transport options. Disabling a workflow prevents retained field bindings from editing it and retires pending completion callbacks; re-enabling does not revive those callbacks or discard form edits.

Acceptance refreshes the observed organization directory and resolves the confirmed membership's organization before `onAccepted`. A failed refresh has `writeSucceeded: true`; recovery repeats only directory resolution, never acceptance. An unavailable detail read after acceptance remains a separate `queryError`.

Received-invitation workflows expose a read-only `pendingSync` collection of `{ invitationId, organizationId, error }`. Call `retrySync(invitationId)` for the relevant entry. A failed recovery for one invitation does not block unrelated responses once the active operation settles. Other receipts survive successful writes, retries, and `reset()`; they are cleared when their initiating workflow retires. Each workflow still performs one active operation at a time, with cross-workflow invitation-ID locks.

Single-invitation workflows retain parameterless `retrySync()` and expose their single receipt as `pendingSync`, or `null`. Received-list recovery requires an ID; the low-level API from `v0.1.0` is unchanged.

```tsx
<authData.ReceivedInvitations>
  {(state) =>
    state.pendingSync.map((pending) => (
      <button
        key={pending.invitationId}
        disabled={state.isBusy}
        onClick={() => void state.retrySync(pending.invitationId)}
      >
        Retry organization refresh
      </button>
    ))
  }
</authData.ReceivedInvitations>
```

Optional callbacks are `onInvited(result)`, `onAccepted({ invitationId, organization })`, `onRejected({ invitationId, result })`, `onCancelled({ invitationId, result })`, and `onResent(result)`. Callback failures become callback-phase errors and do not repeat writes. Identity changes, scope changes, authentication loss, disposal, or unmounting suppress obsolete continuations. Already-sent HTTP writes cannot be undone. Cancellation and resend completion confirm the write, not a fully refreshed list; existing subscriptions keep the list reactive.

## Low-level reads and methods

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

The adapter replaces query keys/options, auth cache invalidation metadata, and signal subscription effects for its supported resources. Invitation components additionally own standard form state, mutation feedback, concurrency, and acceptance-directory sequencing. Keep navigation, reauthentication, domain cleanup, and forms for other features in the application.

- Thin `useMutation` wrappers can call adapter methods with `{ throw: true }`. Keep application mutation variables to endpoint body fields rather than a broad fetch-options bag; this preserves the upstream generic return inference. The adapter itself preserves the original client's throw behavior.
- Direct mutation completion confirms the write, not refreshed navigation data. Invitation response workflows own directory resolution; custom low-level flows can observe `useListOrganizations()` and await its typed `refetch()` in a separate post-write phase.
- `refetch()` returns `{ data, error }`, or `undefined` when disabled/disposed or when the identity changed. It rejects read failures. Hook state uses `isPending` and `isFetching`; it is not the full TanStack observer API.
- Keep account changes on the original auth client. Backend triggers update supported resources; call `refresh()` when a workflow explicitly needs to await them. Keep cleanup of application-owned organization data before deleting the Better Auth organization.
- Move each connected set of readers and writers together. During a staged migration, retain old signal producers while any application still consumes their contract; do not assume an existing application's signal queries are interchangeable with this package's generated references.

## Installation

Install the first precompiled release:

```sh
pnpm add '@strawdev/auth-client@github:battlemagedotapp/auth-client#v0.2.0'
```

Release tags contain the ready-to-use package at the repository root: JavaScript, declarations, and source maps. Installation does not compile this library, install its development tooling, or require permission to run its build scripts. The application still bundles normally and supplies the documented peer dependencies and authentication/backend configuration.

Keep the dependency manifest and lockfile in each application. Upgrade deliberately to another release tag; development commits do not change an installed release. Private repositories require Git access on developer machines and CI. No npm account or package registry configuration is needed.

The repository has one release path: its manually triggered **Release** GitHub Actions workflow builds and tests the package, updates the `dist` distribution branch, and creates a version tag and GitHub Release. Tags point to compiled snapshots; do not tag source commits manually. The package version determines the tag. Never move or reuse a released tag. The repository is public at [battlemagedotapp/auth-client](https://github.com/battlemagedotapp/auth-client). [v0.1.0](https://github.com/battlemagedotapp/auth-client/releases/tag/v0.1.0) is published and its GitHub installation has been verified in an isolated consumer.

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

Version `0.2.0` adds React Hook Form 7.88.0 and @hookform/resolvers 5.9.1 as runtime dependencies. Zod is a peer on the tested `~4.6.4` line (`pnpm add zod@4.6.4`). These are installed dependencies, not vendored code; the application does not compile the library. Backend entry points still exclude React/form code from their import graph, although installed runtime dependencies may bring their own React peer requirements. The existing `v0.1.0` release does not contain these form additions.

The official 0.12.5 provider type resolves its abstract session to `never` with this Better Auth version in the example. The example isolates a type cast at that upstream provider boundary; adapter and hook types remain concrete.

Architecture and cancellation patterns were informed by the reference application and Better Auth UI; see `THIRD_PARTY_NOTICES.md`. Verification results and remaining qualification are recorded in `VERIFICATION.md`.

For a typed application context, call `createSignalQueries<DataModel>(options)` using the application's generated Convex `DataModel`. Compose application hooks with `composeTriggers<DataModel, typeof localAuthSchema>(applicationTriggers, signalTriggers)` to retain the official integration's schema-specific callback types. Component lookup references are checked against the exported reader's validator-derived arguments and return metadata.
