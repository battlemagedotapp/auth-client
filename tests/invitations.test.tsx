// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, waitFor } from "@testing-library/react";
import { Activity, StrictMode, type ReactNode } from "react";
import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { z } from "zod";
import { makeFunctionReference } from "convex/server";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  AuthDataProvider,
  createAuthDataClient,
  type InvalidationApi,
  type WorkflowOutcome,
} from "../packages/auth-client/src/index.js";

let authenticated = true;
const convex = {
  watchQuery: vi.fn(() => ({ localQueryResult: () => undefined, onUpdate: () => () => {} })),
};
vi.mock("convex/react", () => ({
  useConvex: () => convex,
  useConvexAuth: () => ({ isAuthenticated: authenticated }),
}));
const api: InvalidationApi = { signals: makeFunctionReference("authData:signals") };
const dispose: Array<() => void> = [];
afterEach(() => {
  cleanup();
  dispose.splice(0).forEach((fn) => fn());
  authenticated = true;
  vi.clearAllMocks();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture(transportRetries = 0) {
  let identity = { user: { id: "user" }, session: { id: "session" } };
  const invitation = {
    id: "invite",
    organizationId: "org",
    email: "recipient@example.com",
    role: "member",
    status: "pending",
    ticket: 42,
  };
  const directory = [{ id: "org", name: "Organization", slug: "canonical" }];
  const invitations = [invitation];
  let directoryFails = false;
  const writes: Array<{ path: string; body: Record<string, unknown> }> = [];
  let writeHandler: ((path: string, body: Record<string, unknown>) => Promise<unknown>) | undefined;
  const transport = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(input instanceof Request ? input.url : String(input)).pathname;
    let value: unknown;
    if (init?.method === "POST") {
      if (typeof init.body !== "string") throw new Error("Expected JSON request body");
      const body = JSON.parse(init.body) as Record<string, unknown>;
      writes.push({ path, body });
      value = writeHandler
        ? await writeHandler(path, body)
        : path.endsWith("accept-invitation")
          ? { invitation, member: { id: "member", organizationId: "org" } }
          : { ...invitation, ...body };
      if (value instanceof Response) return value;
    } else if (path.endsWith("/list")) {
      if (directoryFails)
        return new Response(
          JSON.stringify({ code: "SYNC_DOWN", message: "Directory unavailable" }),
          { status: 503 },
        );
      value = directory;
    } else if (path.endsWith("get-invitation")) value = invitation;
    else value = invitations;
    return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
  });
  const upstream = createAuthClient({
    baseURL: "https://auth.example.com",
    plugins: [organizationClient()],
    fetchOptions: { customFetchImpl: transport, retry: transportRetries },
  });
  const authData = createAuthDataClient({
    authClient: {
      organization: upstream.organization,
      useSession: () => ({ data: identity, isPending: false }),
    },
    api,
    features: { organization: true },
  });
  dispose.push(() => authData.dispose());
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthDataProvider client={authData}>{children}</AuthDataProvider>
  );
  return {
    authData,
    wrapper,
    writes,
    transport,
    directory,
    invitations,
    failDirectory: (value: boolean) => {
      directoryFails = value;
    },
    handleWrite: (handler: NonNullable<typeof writeHandler>) => {
      writeHandler = handler;
    },
    switchIdentity: () => {
      identity = { user: { id: "second" }, session: { id: "second-session" } };
    },
  };
}

it("owns form edits and validation, preserves edits across rerenders, and submits once through the public client", async () => {
  const f = fixture();
  expect(f.transport).not.toHaveBeenCalled();
  const hold = deferred<unknown>();
  f.handleWrite(() => hold.promise);
  const callback = vi.fn();
  const hook = renderHook(
    ({ organizationId, email }) =>
      f.authData.useInvitationForm({
        organizationId,
        initialValues: { email, role: "member" },
        onInvited: callback,
      }),
    { wrapper: f.wrapper, initialProps: { organizationId: "org", email: "" } },
  );
  let outcome: WorkflowOutcome<unknown> | undefined;
  await act(async () => {
    outcome = await hook.result.current.actions.submit.run();
  });
  expect(outcome).toMatchObject({
    status: "error",
    error: { phase: "validation", writeSucceeded: false },
  });
  expect(hook.result.current.field("email").error?.code).toBe("required");
  expect(f.writes).toHaveLength(0);
  act(() => hook.result.current.field("email").onChange("recipient@example.com"));
  hook.rerender({ organizationId: "org", email: "latest-default@example.com" });
  expect(hook.result.current.values.email).toBe("recipient@example.com");
  let pending!: Promise<WorkflowOutcome<unknown>>;
  act(() => {
    pending = hook.result.current.actions.submit.run();
  });
  await waitFor(() => expect(f.writes).toHaveLength(1));
  await act(async () => {
    expect(await hook.result.current.actions.submit.run()).toEqual({
      status: "ignored",
      reason: "busy",
    });
  });
  act(() => hook.result.current.field("email").onChange("blocked@example.com"));
  expect(hook.result.current.values.email).toBe("recipient@example.com");
  await act(async () => {
    hold.resolve({ id: "invite" });
    await pending;
  });
  expect(callback).toHaveBeenCalledTimes(1);
  expect(hook.result.current.values.email).toBe("latest-default@example.com");
  expect(f.writes[0]?.body).toMatchObject({
    email: "recipient@example.com",
    organizationId: "org",
    resend: false,
  });
  act(() => hook.result.current.field("email").onChange("draft@example.com"));
  hook.rerender({ organizationId: "other-org", email: "" });
  expect(hook.result.current.values.email).toBe("");
});

it("recovers accepted-invitation synchronization without repeating acceptance or replaying callbacks", async () => {
  const f = fixture();
  const onAccepted = vi.fn();
  const onError = vi.fn();
  const hook = renderHook(
    () => f.authData.useInvitationResponse({ invitationId: "invite", onAccepted, onError }),
    { wrapper: f.wrapper },
  );
  await waitFor(() => expect(hook.result.current.invitation?.id).toBe("invite"));
  f.failDirectory(true);
  await act(async () => {
    expect(await hook.result.current.actions.accept.run()).toMatchObject({
      status: "error",
      error: { phase: "synchronization", writeSucceeded: true },
    });
  });
  expect(onAccepted).not.toHaveBeenCalled();
  expect(onError).toHaveBeenCalledOnce();
  act(() => hook.result.current.reset());
  expect(hook.result.current.actions.accept.disabledReason).toEqual({ code: "recovery" });
  await act(async () => {
    expect(await hook.result.current.actions.accept.run()).toMatchObject({ status: "ignored" });
  });
  f.failDirectory(false);
  await act(async () => {
    expect(await hook.result.current.feedback[0]!.recovery!.run()).toMatchObject({
      status: "success",
      data: { organization: { slug: "canonical" } },
    });
  });
  expect(f.writes).toHaveLength(1);
  expect(onAccepted).toHaveBeenCalledTimes(1);
  expect(hook.result.current.feedback).toHaveLength(0);
});

it("shares invitation locks across mounted workflows and retains them after the initiator unmounts", async () => {
  const f = fixture();
  const hold = deferred<unknown>();
  f.handleWrite(() => hold.promise);
  const callback = vi.fn();
  const first = renderHook(() => f.authData.useReceivedInvitations({ onRejected: callback }), {
    wrapper: f.wrapper,
  });
  const second = renderHook(
    () => f.authData.useOrganizationInvitations({ organizationId: "org" }),
    { wrapper: f.wrapper },
  );
  await waitFor(() => expect(first.result.current.data).toHaveLength(1));
  let pending!: Promise<WorkflowOutcome<unknown>>;
  act(() => {
    pending = first.result.current.invitation("invite").reject.run();
  });
  await waitFor(() => expect(f.writes).toHaveLength(1));
  first.unmount();
  await act(async () => {
    expect(await second.result.current.invitation("invite").cancel.run()).toEqual({
      status: "ignored",
      reason: "busy",
    });
    hold.resolve({ id: "invite" });
    expect(await pending).toEqual({ status: "ignored", reason: "obsolete" });
  });
  expect(callback).not.toHaveBeenCalled();
  await act(async () => {
    expect(await second.result.current.invitation("invite").cancel.run()).toMatchObject({
      status: "success",
    });
  });
  expect(f.writes).toHaveLength(2);
});

it.each(["identity", "authentication", "dispose", "scope"] as const)(
  "suppresses late writes and callbacks after %s changes",
  async (transition) => {
    const f = fixture();
    const hold = deferred<unknown>();
    f.handleWrite(() => hold.promise);
    const callback = vi.fn();
    const hook = renderHook(
      ({ organizationId }) =>
        f.authData.useInvitationForm({
          organizationId,
          initialValues: { role: "member" },
          onInvited: callback,
        }),
      { wrapper: f.wrapper, initialProps: { organizationId: "org" } },
    );
    act(() => hook.result.current.field("email").onChange("private@example.com"));
    let pending!: Promise<WorkflowOutcome<unknown>>;
    act(() => {
      pending = hook.result.current.actions.submit.run();
    });
    await waitFor(() => expect(f.writes).toHaveLength(1));
    if (transition === "identity") f.switchIdentity();
    if (transition === "authentication") authenticated = false;
    if (transition === "dispose") act(() => f.authData.dispose());
    hook.rerender({ organizationId: transition === "scope" ? "other" : "org" });
    expect(hook.result.current.values.email).toBe("");
    await act(async () => {
      hold.resolve({ id: "invite" });
      expect(await pending).toEqual({ status: "ignored", reason: "obsolete" });
    });
    expect(callback).not.toHaveBeenCalled();
    expect(hook.result.current.diagnostics.error).toBeNull();
  },
);

it("renders headless fields without adding elements or shadowing the application QueryClient", async () => {
  const f = fixture();
  const application = new QueryClient();
  function Controls() {
    const form = f.authData.useInvitationFormContext();
    expect(useQueryClient()).toBe(application);
    return (
      <input
        aria-label="email"
        value={form.field("email").value}
        onChange={(event) => form.field("email").onChange(event.target.value)}
      />
    );
  }
  function Child() {
    expect(useQueryClient()).toBe(application);
    return (
      <f.authData.InvitationForm organizationId="org" initialValues={{ role: "member" }}>
        <Controls />
      </f.authData.InvitationForm>
    );
  }
  const ui = render(
    <StrictMode>
      <QueryClientProvider client={application}>
        <f.wrapper>
          <Child />
        </f.wrapper>
      </QueryClientProvider>
    </StrictMode>,
  );
  expect(ui.container.children).toHaveLength(1);
  fireEvent.change(ui.getByLabelText("email"), { target: { value: "edited@example.com" } });
  expect((ui.getByLabelText("email") as HTMLInputElement).value).toBe("edited@example.com");
  expect(f.writes).toHaveLength(0);
});

it("reports callback errors after successful writes and sends resend=true with an explicit scope", async () => {
  const f = fixture();
  const hook = renderHook(
    () =>
      f.authData.useOrganizationInvitations({
        organizationId: "org",
        onResent: () => {
          throw new Error("Navigation failed");
        },
      }),
    { wrapper: f.wrapper },
  );
  await waitFor(() => expect(hook.result.current.data).toHaveLength(1));
  await act(async () => {
    expect(await hook.result.current.invitation("invite").resend.run()).toMatchObject({
      status: "error",
      error: { phase: "callback", writeSucceeded: true },
    });
  });
  expect(f.writes).toHaveLength(1);
  expect(f.writes[0]?.body).toEqual({
    organizationId: "org",
    resend: true,
    email: "recipient@example.com",
    role: "member",
    ticket: 42,
  });
});

it("preserves server write codes, never retries, and disables workflow actions explicitly", async () => {
  const f = fixture(2);
  f.handleWrite(
    async () =>
      new Response(JSON.stringify({ code: "INVITATION_EXPIRED", message: "Expired" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
  );
  const callback = vi.fn();
  const hook = renderHook(
    ({ enabled }) =>
      f.authData.useInvitationResponse({ invitationId: "invite", enabled, onAccepted: callback }),
    {
      wrapper: f.wrapper,
      initialProps: { enabled: false },
    },
  );
  await act(async () => {
    expect(await hook.result.current.actions.accept.run()).toEqual({
      status: "ignored",
      reason: "disabled",
    });
  });
  expect(f.transport).not.toHaveBeenCalled();
  hook.rerender({ enabled: true });
  await waitFor(() => expect(hook.result.current.invitation?.id).toBe("invite"));
  await act(async () => {
    expect(await hook.result.current.actions.accept.run()).toMatchObject({
      status: "error",
      error: {
        phase: "write",
        writeSucceeded: false,
        cause: { error: { code: "INVITATION_EXPIRED" }, status: 400 },
      },
    });
  });
  expect(f.writes).toHaveLength(1);
  expect(callback).not.toHaveBeenCalled();
});

it("does not inherit automatic HTTP retries for library-owned reads", async () => {
  const f = fixture(1);
  f.failDirectory(true);
  const hook = renderHook(() => f.authData.useListOrganizations(), { wrapper: f.wrapper });
  await waitFor(() => expect(hook.result.current.error).toBeTruthy(), { timeout: 4000 });
  expect(f.transport).toHaveBeenCalledTimes(1);
});

it("validates touched fields and resets edits to the latest defaults without writing", async () => {
  const f = fixture();
  const hook = renderHook(
    ({ email }) =>
      f.authData.useInvitationForm({
        organizationId: "org",
        initialValues: { email, role: "member" },
        validate: (values) =>
          values.email.endsWith("@work.example") ? {} : { email: { code: "work-email" } },
      }),
    { wrapper: f.wrapper, initialProps: { email: "personal@example.com" } },
  );
  act(() => hook.result.current.field("email").onBlur());
  expect(hook.result.current.touched.email).toBe(true);
  await waitFor(() => expect(hook.result.current.fieldErrors.email?.code).toBe("work-email"));
  hook.rerender({ email: "default@work.example" });
  expect(hook.result.current.values.email).toBe("personal@example.com");
  act(() => hook.result.current.reset());
  expect(hook.result.current.values.email).toBe("default@work.example");
  expect(hook.result.current.touched).toEqual({});
  expect(hook.result.current.fieldErrors).toEqual({});
  expect(f.writes).toHaveLength(0);
});

it("blocks retained field bindings while disabled without discarding edits", () => {
  const f = fixture();
  const hook = renderHook(
    ({ enabled }) =>
      f.authData.useInvitationForm({
        organizationId: "org",
        enabled,
        initialValues: { role: "member" },
      }),
    {
      wrapper: f.wrapper,
      initialProps: { enabled: true },
    },
  );
  const email = hook.result.current.field("email");
  act(() => email.onChange("draft@example.com"));
  hook.rerender({ enabled: false });
  act(() => {
    email.onChange("blocked@example.com");
    email.onBlur();
  });
  expect(hook.result.current.values.email).toBe("draft@example.com");
  expect(hook.result.current.touched.email).toBeUndefined();
  hook.rerender({ enabled: true });
  expect(hook.result.current.values.email).toBe("draft@example.com");
});

it("shares known-ID locks with resend forms and keeps acceptance callback failure separate from synchronization", async () => {
  const f = fixture();
  const hold = deferred<unknown>();
  f.handleWrite(() => hold.promise);
  const form = renderHook(
    () =>
      f.authData.useInvitationForm({
        organizationId: "org",
        mode: "resend",
        initialValues: { email: "recipient@example.com", role: "member" },
      }),
    { wrapper: f.wrapper },
  );
  const response = renderHook(
    () =>
      f.authData.useInvitationResponse({
        invitationId: "invite",
        onAccepted: () => {
          throw new Error("Callback failed");
        },
      }),
    { wrapper: f.wrapper },
  );
  await waitFor(() => expect(response.result.current.invitation?.id).toBe("invite"));
  let pending!: Promise<WorkflowOutcome<unknown>>;
  act(() => {
    pending = response.result.current.actions.accept.run();
  });
  await waitFor(() => expect(f.writes).toHaveLength(1));
  await act(async () => {
    expect(await form.result.current.actions.submit.run()).toEqual({
      status: "ignored",
      reason: "busy",
    });
    hold.resolve({ member: { organizationId: "org" } });
    expect(await pending).toMatchObject({
      status: "error",
      error: { phase: "callback", writeSucceeded: true },
    });
  });
  expect(response.result.current.feedback.every((entry) => entry.recovery === null)).toBe(true);
  expect(f.writes).toHaveLength(1);
});

it("does not send a queued write after its initiating workflow unmounts", async () => {
  const f = fixture();
  const hook = renderHook(() => f.authData.useReceivedInvitations(), { wrapper: f.wrapper });
  let pending!: Promise<WorkflowOutcome<unknown>>;
  act(() => {
    pending = hook.result.current.invitation("invite").reject.run();
    hook.unmount();
  });
  await act(async () => {
    expect(await pending).toEqual({ status: "ignored", reason: "obsolete" });
  });
  expect(f.writes).toHaveLength(0);
});

it("does not resurrect a completion after disabling and re-enabling its workflow", async () => {
  const f = fixture();
  const hold = deferred<unknown>();
  f.handleWrite(() => hold.promise);
  const callback = vi.fn();
  const hook = renderHook(
    ({ enabled }) => f.authData.useReceivedInvitations({ enabled, onRejected: callback }),
    {
      wrapper: f.wrapper,
      initialProps: { enabled: true },
    },
  );
  await waitFor(() => expect(hook.result.current.data).toHaveLength(1));
  let pending!: Promise<WorkflowOutcome<unknown>>;
  act(() => {
    pending = hook.result.current.invitation("invite").reject.run();
  });
  await waitFor(() => expect(f.writes).toHaveLength(1));
  hook.rerender({ enabled: false });
  hook.rerender({ enabled: true });
  await act(async () => {
    hold.resolve({ id: "invite" });
    expect(await pending).toEqual({ status: "ignored", reason: "obsolete" });
  });
  expect(callback).not.toHaveBeenCalled();
});

it("retires disconnected React effects without letting an old completion clear a new action", async () => {
  const f = fixture();
  f.invitations.push({ ...f.invitations[0]!, id: "other-invite" });
  const first = deferred<unknown>();
  const second = deferred<unknown>();
  f.handleWrite((_path, body) => (body.invitationId === "invite" ? first.promise : second.promise));
  const callback = vi.fn();
  let hidden = false;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <f.wrapper>
      <Activity mode={hidden ? "hidden" : "visible"}>{children}</Activity>
    </f.wrapper>
  );
  const hook = renderHook(() => f.authData.useReceivedInvitations({ onRejected: callback }), {
    wrapper,
  });
  await waitFor(() => expect(hook.result.current.data).toHaveLength(2));
  let previous!: Promise<WorkflowOutcome<unknown>>;
  act(() => {
    previous = hook.result.current.invitation("invite").reject.run();
  });
  await waitFor(() => expect(f.writes).toHaveLength(1));
  hidden = true;
  hook.rerender();
  hidden = false;
  hook.rerender();
  let next!: Promise<WorkflowOutcome<unknown>>;
  act(() => {
    next = hook.result.current.invitation("other-invite").reject.run();
  });
  await waitFor(() => expect(f.writes).toHaveLength(2));
  await act(async () => {
    first.resolve({ id: "invite" });
    expect(await previous).toEqual({ status: "ignored", reason: "obsolete" });
  });
  expect(callback).not.toHaveBeenCalled();
  expect(hook.result.current.diagnostics.pendingAction?.invitationId).toBe("other-invite");
  expect(hook.result.current.diagnostics.pendingAction !== null).toBe(true);
  await act(async () => {
    second.resolve({ id: "other-invite" });
    await next;
  });
  expect(callback).toHaveBeenCalledTimes(1);
});

it("submits transformed drafts while RHF owns dirty state and reset defaults", async () => {
  const f = fixture();
  const schema = z.object({
    email: z.string(),
    role: z.literal("member"),
    ticket: z
      .string()
      .regex(/^\d+$/)
      .transform(async (value) => Number(value)),
  });
  const hook = renderHook(
    () =>
      f.authData.useInvitationForm({
        schema,
        organizationId: "org",
        initialValues: { email: "recipient@example.com", role: "member", ticket: "" },
      }),
    { wrapper: f.wrapper },
  );
  await act(async () => {
    expect(await hook.result.current.actions.submit.run()).toMatchObject({
      status: "error",
      error: { phase: "validation" },
    });
  });
  expect(f.writes).toHaveLength(0);
  act(() => hook.result.current.field("ticket").onChange("42"));
  expect(hook.result.current.isDirty).toBe(true);
  await act(async () => {
    expect(await hook.result.current.actions.submit.run()).toMatchObject({ status: "success" });
  });
  expect(f.writes[0]?.body.ticket).toBe(42);
  expect(hook.result.current.values.ticket).toBe("");
  expect(hook.result.current.isDirty).toBe(false);
});

it("submits only schema output and omits optional undefined values before custom validation", async () => {
  const f = fixture();
  const validate = vi.fn(() => ({}));
  const schema = z
    .object({
      email: z.string(),
      role: z.literal("member"),
      note: z.string().optional(),
      draftOnly: z.string(),
    })
    .transform(({ draftOnly: _draftOnly, ...values }) => values);
  const hook = renderHook(
    () =>
      f.authData.useInvitationForm({
        schema,
        organizationId: "org",
        initialValues: {
          email: "recipient@example.com",
          role: "member",
          note: undefined,
          draftOnly: "discard",
        },
        validate,
      }),
    { wrapper: f.wrapper },
  );
  await act(async () => {
    expect(await hook.result.current.actions.submit.run()).toMatchObject({ status: "success" });
  });
  expect(validate).toHaveBeenCalledWith({ email: "recipient@example.com", role: "member" });
  expect(f.writes[0]?.body).not.toHaveProperty("draftOnly");
  expect(f.writes[0]?.body).not.toHaveProperty("note");
});

it("preserves literal field names and maps nested and root schema issues", async () => {
  const f = fixture();
  const onError = vi.fn();
  const schema = z
    .object({
      email: z.string(),
      role: z.literal("member"),
      "case.number": z.string().min(1),
      detail: z.object({ count: z.number().positive() }),
    })
    .superRefine((_value, context) => {
      context.addIssue({ code: "custom", message: "Form policy failed" });
    });
  const hook = renderHook(
    () =>
      f.authData.useInvitationForm({
        schema,
        organizationId: "org",
        onError,
        initialValues: {
          email: "recipient@example.com",
          role: "member",
          "case.number": "",
          detail: { count: -1 },
        },
      }),
    { wrapper: f.wrapper },
  );
  await act(async () => {
    await hook.result.current.actions.submit.run();
  });
  expect(hook.result.current.field("case.number").error?.code).toBe("too_small");
  expect(hook.result.current.field("detail").error?.code).toBe("too_small");
  expect(hook.result.current.validationError).toMatchObject({
    code: "custom",
    message: "Form policy failed",
  });
  expect(hook.result.current.feedback).toEqual([]);
  expect(onError).not.toHaveBeenCalled();
  expect(f.writes).toHaveLength(0);
});

it("revalidates dependent fields and ignores an older async validation result", async () => {
  const f = fixture();
  const old = deferred<void>();
  const hook = renderHook(
    () =>
      f.authData.useInvitationForm({
        organizationId: "org",
        initialValues: { email: "old@example.com", role: "member" },
        validate: async (values) => {
          if (values.email === "old@example.com") {
            await old.promise;
            return { role: { code: "old-rule" } };
          }
          return { role: { code: "new-rule" } };
        },
      }),
    { wrapper: f.wrapper },
  );
  act(() => hook.result.current.field("email").onBlur());
  await waitFor(() => expect(hook.result.current.isValidating).toBe(true));
  act(() => hook.result.current.field("email").onChange("new@example.com"));
  await waitFor(() => expect(hook.result.current.fieldErrors.role?.code).toBe("new-rule"));
  await act(async () => {
    old.resolve();
  });
  expect(hook.result.current.fieldErrors.role?.code).toBe("new-rule");
});

it("preserves the first Zod issue code and message for each top-level field", async () => {
  const f = fixture();
  const schema = z.object({
    email: z.string(),
    role: z.literal("member"),
    detail: z.object({}).superRefine((_value, context) => {
      context.addIssue({ code: "custom", message: "First issue", path: [2] });
      context.addIssue({ code: "custom", message: "Later issue", path: [0] });
    }),
    choice: z.union([z.string(), z.number()]),
  });
  const hook = renderHook(
    () =>
      f.authData.useInvitationForm({
        organizationId: "org",
        schema,
        initialValues: { email: "recipient@example.com", role: "member", detail: {}, choice: "" },
      }),
    { wrapper: f.wrapper },
  );
  // Exercise runtime validation of untrusted input, beyond the public typed binding.
  act(() => {
    Reflect.apply(hook.result.current.field("choice").onChange, undefined, [false]);
  });
  await act(async () => {
    await hook.result.current.actions.submit.run();
  });
  expect(hook.result.current.fieldErrors.detail).toEqual({
    code: "custom",
    message: "First issue",
  });
  expect(hook.result.current.fieldErrors.choice?.code).toBe("invalid_union");
  expect(f.writes).toHaveLength(0);
});

it("locks the validated resend recipient after a schema transforms its email", async () => {
  const f = fixture();
  const hold = deferred<unknown>();
  f.handleWrite(() => hold.promise);
  const outgoing = renderHook(
    () => f.authData.useOrganizationInvitations({ organizationId: "org" }),
    { wrapper: f.wrapper },
  );
  const schema = z.object({
    email: z.string().transform(() => "recipient@example.com"),
    role: z.literal("member"),
  });
  const form = renderHook(
    () =>
      f.authData.useInvitationForm({
        organizationId: "org",
        mode: "resend",
        schema,
        initialValues: { email: "draft-alias", role: "member" },
      }),
    { wrapper: f.wrapper },
  );
  await waitFor(() => expect(outgoing.result.current.data).toHaveLength(1));
  let cancelling!: Promise<WorkflowOutcome<unknown>>;
  act(() => {
    cancelling = outgoing.result.current.invitation("invite").cancel.run();
  });
  await waitFor(() => expect(f.writes).toHaveLength(1));
  let resending!: Promise<WorkflowOutcome<unknown>>;
  let settled = false;
  act(() => {
    resending = form.result.current.actions.submit.run().then((result) => {
      settled = true;
      return result;
    });
  });
  await waitFor(() => expect(settled || f.writes.length > 1).toBe(true));
  const writesBeforeCompletion = f.writes.length;
  let outcome: WorkflowOutcome<unknown> | undefined;
  await act(async () => {
    hold.resolve({ id: "invite" });
    outcome = await resending;
    await cancelling;
  });
  expect(writesBeforeCompletion).toBe(1);
  expect(outcome).toEqual({ status: "ignored", reason: "busy" });
  expect(form.result.current.diagnostics.pendingAction !== null).toBe(false);
  expect(form.result.current.diagnostics.error).toBeNull();
  expect(form.result.current.values.email).toBe("draft-alias");
  await act(async () => {
    expect(await form.result.current.actions.submit.run()).toMatchObject({ status: "success" });
  });
  expect(f.writes).toHaveLength(2);
  expect(f.writes[1]?.body.email).toBe("recipient@example.com");
});

it.each(["reset", "disable", "identity", "scope", "unmount", "dispose"] as const)(
  "retires asynchronous validation after %s",
  async (transition) => {
    const f = fixture();
    const hold = deferred<void>();
    const validate = vi.fn(async () => {
      await hold.promise;
      return { email: { code: "obsolete" } };
    });
    const hook = renderHook(
      ({ organizationId, enabled }) =>
        f.authData.useInvitationForm({
          organizationId,
          enabled,
          initialValues: { email: "recipient@example.com", role: "member" },
          validate,
        }),
      { wrapper: f.wrapper, initialProps: { organizationId: "org", enabled: true } },
    );
    act(() => hook.result.current.field("email").onBlur());
    await waitFor(() => expect(validate).toHaveBeenCalled());
    if (transition === "reset") act(() => hook.result.current.reset());
    if (transition === "identity") f.switchIdentity();
    if (transition === "dispose") act(() => f.authData.dispose());
    if (transition === "unmount") hook.unmount();
    else
      hook.rerender({
        organizationId: transition === "scope" ? "other" : "org",
        enabled: transition !== "disable",
      });
    await act(async () => {
      hold.resolve();
    });
    if (transition !== "unmount") expect(hook.result.current.fieldErrors.email).toBeUndefined();
    expect(f.writes).toHaveLength(0);
  },
);

it("locks before async submission validation and preserves validator failures", async () => {
  const f = fixture();
  const hold = deferred<void>();
  const cause = new Error("Validation service failed");
  const onError = vi.fn();
  const validate = vi.fn(async () => {
    await hold.promise;
    throw cause;
  });
  const hook = renderHook(
    () =>
      f.authData.useInvitationForm({
        organizationId: "org",
        initialValues: { email: "recipient@example.com", role: "member" },
        onError,
        validate,
      }),
    { wrapper: f.wrapper },
  );
  let pending!: Promise<WorkflowOutcome<unknown>>;
  act(() => {
    pending = hook.result.current.actions.submit.run();
  });
  await waitFor(() => expect(validate).toHaveBeenCalledTimes(1));
  await act(async () => {
    expect(await hook.result.current.actions.submit.run()).toEqual({
      status: "ignored",
      reason: "busy",
    });
  });
  act(() => hook.result.current.field("email").onChange("blocked@example.com"));
  expect(hook.result.current.values.email).toBe("recipient@example.com");
  await act(async () => {
    hold.resolve();
    expect(await pending).toMatchObject({
      status: "error",
      error: { phase: "validation", writeSucceeded: false },
    });
  });
  expect(hook.result.current.validationError).toMatchObject({ cause });
  expect(hook.result.current.feedback).toEqual([]);
  expect(onError).not.toHaveBeenCalled();
  expect(f.writes).toHaveLength(0);
});

it("recovers multiple accepted invitations independently without blocking unrelated responses", async () => {
  const f = fixture();
  f.invitations.splice(
    0,
    1,
    ...["first", "second", "unrelated"].map((id) => ({ ...f.invitations[0]!, id })),
  );
  const onAccepted = vi.fn();
  const hook = renderHook(() => f.authData.useReceivedInvitations({ onAccepted }), {
    wrapper: f.wrapper,
  });
  await waitFor(() => expect(hook.result.current.data).toHaveLength(3));
  f.failDirectory(true);
  await act(async () => {
    await hook.result.current.invitation("first").accept.run();
    await hook.result.current.invitation("second").accept.run();
    expect(await hook.result.current.invitation("unrelated").reject.run()).toMatchObject({
      status: "success",
    });
  });
  expect(hook.result.current.feedback.map((entry) => entry.target.invitationId)).toEqual([
    "first",
    "second",
  ]);
  act(() => hook.result.current.reset());
  expect(hook.result.current.feedback).toHaveLength(2);
  f.failDirectory(false);
  await act(async () => {
    expect(await hook.result.current.feedback[0]!.recovery!.run()).toMatchObject({
      status: "success",
    });
  });
  expect(hook.result.current.feedback.map((entry) => entry.target.invitationId)).toEqual([
    "second",
  ]);
  expect(f.writes).toHaveLength(3);
  await act(async () => {
    await hook.result.current.feedback[0]!.recovery!.run();
  });
  expect(onAccepted).toHaveBeenCalledTimes(2);
  expect(hook.result.current.feedback).toHaveLength(0);
  expect(f.writes).toHaveLength(3);
});
