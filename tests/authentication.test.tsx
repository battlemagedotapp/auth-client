// @vitest-environment jsdom
import { useSyncExternalStore, type ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import { AuthDataProvider, createAuthDataClient } from "../packages/auth-client/src/index.js";

let convexAuthenticated = false;
const convex = {
  watchQuery: vi.fn(() => ({ localQueryResult: () => undefined, onUpdate: () => () => {} })),
};
vi.mock("convex/react", () => ({
  useConvex: () => convex,
  useConvexAuth: () => ({
    isAuthenticated: convexAuthenticated,
    isLoading: false,
  }),
}));
const api = { signals: makeFunctionReference<"query">("authData:signals") as any };
const disposals: Array<() => void> = [];

afterEach(() => {
  cleanup();
  disposals.splice(0).forEach((dispose) => dispose());
  convexAuthenticated = false;
  vi.clearAllMocks();
});

type Session = {
  user: { id: string; email: string };
  session: { id: string; token: string };
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function sessionStore(initial: Session | null) {
  let session = initial;
  let next = initial;
  let revision = 0;
  let refreshFailure: unknown;
  let failAfterRefresh = false;
  const listeners = new Set<() => void>();
  convexAuthenticated = Boolean(initial);
  const emit = () => {
    revision++;
    for (const listener of listeners) listener();
  };
  return {
    useSession() {
      useSyncExternalStore(
        (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        () => revision,
        () => revision,
      );
      return {
        data: session,
        isPending: false,
        refetch: async () => {
          if (refreshFailure) {
            const failure = refreshFailure;
            refreshFailure = undefined;
            throw failure;
          }
          session = next;
          convexAuthenticated = Boolean(session);
          emit();
          if (failAfterRefresh) {
            failAfterRefresh = false;
            throw new Error("session read failed after transition");
          }
          return { data: session, error: null };
        },
      };
    },
    transition(value: Session | null) {
      next = value;
    },
    failNextRefresh(cause: unknown) {
      refreshFailure = cause;
    },
    failAfterNextRefresh() {
      failAfterRefresh = true;
    },
  };
}

function authenticationFixture(initial: Session | null = null) {
  const sessions = sessionStore(initial);
  const auth = {
    useSession: () => sessions.useSession(),
    signIn: {
      email: vi.fn<(input: Record<string, unknown>) => Promise<unknown>>(async () => ({
        status: true,
      })),
    },
    signUp: {
      email: vi.fn<(input: Record<string, unknown>) => Promise<unknown>>(async () => ({
        status: true,
      })),
    },
    requestPasswordReset: vi.fn(async (_input: Record<string, unknown>) => ({ status: true })),
    resetPassword: vi.fn(async (_input: Record<string, unknown>) => ({ status: true })),
    sendVerificationEmail: vi.fn(async (_input: Record<string, unknown>) => ({ status: true })),
    signOut: vi.fn(async (_input: Record<string, unknown>) => ({ status: true })),
  };
  const client = createAuthDataClient({
    authClient: auth,
    api,
    features: { authentication: true },
  });
  disposals.push(() => client.dispose());
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthDataProvider client={client}>{children}</AuthDataProvider>
  );
  return { auth, client, sessions, wrapper };
}

it("recovers sign-in synchronization without repeating credentials and clears secrets", async () => {
  const fixture = authenticationFixture();
  const completion = vi.fn();
  const next = {
    user: { id: "user", email: "user@example.com" },
    session: { id: "next-session", token: "private-next-token" },
  };
  fixture.auth.signIn.email.mockImplementation(async () => {
    fixture.sessions.transition(next);
    return { user: next.user, token: next.session.token };
  });
  fixture.sessions.failNextRefresh(new Error("session read unavailable"));
  const hook = renderHook(
    () =>
      fixture.client.useSignInForm({
        initialValues: { email: "", password: "" },
        onAuthenticated: completion,
      }),
    { wrapper: fixture.wrapper },
  );
  await waitFor(() => expect(hook.result.current.actions.submit.isDisabled).toBe(false));
  act(() => {
    hook.result.current.field("email").onChange("user@example.com");
    hook.result.current.field("password").onChange("secret");
  });
  await act(async () => {
    expect(await hook.result.current.actions.submit.run()).toMatchObject({
      status: "error",
      error: { phase: "synchronization", writeSucceeded: true },
    });
  });
  expect(fixture.auth.signIn.email).toHaveBeenCalledTimes(1);
  expect(hook.result.current.field("password").value).toBe("");
  expect(hook.result.current.feedback[0]?.recovery).not.toBeNull();
  act(() => hook.result.current.reset());
  expect(hook.result.current.feedback[0]?.recovery).not.toBeNull();
  await act(async () => {
    expect(await hook.result.current.feedback[0]!.recovery!.run()).toMatchObject({
      status: "success",
      data: { outcome: "authenticated", userId: "user", sessionId: "next-session" },
    });
  });
  expect(fixture.auth.signIn.email).toHaveBeenCalledTimes(1);
  expect(completion).toHaveBeenCalledOnce();
  expect(completion.mock.calls[0]?.[0]).not.toHaveProperty("token");
});

it("surfaces verification-required sign-in as a business outcome", async () => {
  const fixture = authenticationFixture();
  fixture.auth.signIn.email.mockRejectedValue({ code: "EMAIL_NOT_VERIFIED" });
  const verification = vi.fn();
  const hook = renderHook(
    () =>
      fixture.client.useSignInForm({
        initialValues: { email: "person@example.com", password: "secret" },
        onVerificationRequired: verification,
      }),
    { wrapper: fixture.wrapper },
  );
  await waitFor(() => expect(hook.result.current.actions.submit.isDisabled).toBe(false));
  await act(async () => {
    expect(await hook.result.current.actions.submit.run()).toEqual({
      status: "success",
      data: { outcome: "verificationRequired", email: "person@example.com" },
    });
  });
  expect(verification).toHaveBeenCalledOnce();
  expect(hook.result.current.feedback).toEqual([]);
  expect(hook.result.current.field("password").value).toBe("");
});

it("retires sign-in when synchronization observes an unrelated account", async () => {
  const fixture = authenticationFixture();
  const unrelated = {
    user: { id: "other-user", email: "other@example.com" },
    session: { id: "other-session", token: "private-other-token" },
  };
  fixture.auth.signIn.email.mockImplementation(async () => {
    fixture.sessions.transition(unrelated);
    return { user: { id: "expected-user" }, token: "private-expected-token" };
  });
  const completed = vi.fn();
  const hook = renderHook(
    () =>
      fixture.client.useSignInForm({
        initialValues: { email: "expected@example.com", password: "secret" },
        onAuthenticated: completed,
      }),
    { wrapper: fixture.wrapper },
  );
  await waitFor(() => expect(hook.result.current.actions.submit.isDisabled).toBe(false));
  await act(async () => {
    expect(await hook.result.current.actions.submit.run()).toEqual({
      status: "ignored",
      reason: "obsolete",
    });
  });
  expect(completed).not.toHaveBeenCalled();
  expect(hook.result.current.feedback).toEqual([]);
});

it("keeps identity action readiness aligned with duplicate-submit prevention", async () => {
  const fixture = authenticationFixture();
  const pending = deferred<unknown>();
  const next = {
    user: { id: "user", email: "user@example.com" },
    session: { id: "session", token: "private-token" },
  };
  fixture.auth.signIn.email.mockImplementation(async () => {
    const result = await pending.promise;
    fixture.sessions.transition(next);
    return result;
  });
  const hook = renderHook(
    () =>
      fixture.client.useSignInForm({
        initialValues: { email: "user@example.com", password: "secret" },
      }),
    { wrapper: fixture.wrapper },
  );
  await waitFor(() => expect(hook.result.current.actions.submit.isDisabled).toBe(false));
  let first!: Promise<unknown>;
  act(() => {
    first = hook.result.current.actions.submit.run();
  });
  await waitFor(() => {
    expect(hook.result.current.actions.submit.isPending).toBe(true);
    expect(hook.result.current.actions.submit.isDisabled).toBe(true);
  });
  await expect(hook.result.current.actions.submit.run()).resolves.toEqual({
    status: "ignored",
    reason: "busy",
  });
  pending.resolve({ user: next.user, token: next.session.token });
  await act(async () => {
    await first;
  });
  expect(fixture.auth.signIn.email).toHaveBeenCalledOnce();
});

it("keeps an expected identity operation alive across provider remount", async () => {
  const fixture = authenticationFixture();
  const pending = deferred<unknown>();
  const next = {
    user: { id: "user", email: "user@example.com" },
    session: { id: "session", token: "private-token" },
  };
  fixture.auth.signIn.email.mockImplementation(() => pending.promise);
  let providerKey = "guest";
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthDataProvider key={providerKey} client={fixture.client}>
      {children}
    </AuthDataProvider>
  );
  const completed = vi.fn();
  const hook = renderHook(
    () =>
      fixture.client.useSignInForm({
        initialValues: { email: "user@example.com", password: "secret" },
        onAuthenticated: completed,
      }),
    { wrapper },
  );
  await waitFor(() => expect(hook.result.current.actions.submit.isDisabled).toBe(false));
  let outcome!: Promise<unknown>;
  act(() => {
    outcome = hook.result.current.actions.submit.run();
  });
  await waitFor(() => expect(hook.result.current.actions.submit.isPending).toBe(true));
  providerKey = "authenticated";
  hook.rerender();
  fixture.sessions.transition(next);
  pending.resolve({ user: next.user, token: next.session.token });
  await act(async () => {
    await expect(outcome).resolves.toMatchObject({ status: "success" });
  });
  expect(completed).toHaveBeenCalledOnce();
});

it("does not offer synchronization recovery for a failed completion callback", async () => {
  const fixture = authenticationFixture();
  const next = {
    user: { id: "user", email: "user@example.com" },
    session: { id: "session", token: "private-token" },
  };
  fixture.auth.signIn.email.mockImplementation(async () => {
    fixture.sessions.transition(next);
    return { user: next.user, token: next.session.token };
  });
  const completion = vi.fn(async () => {
    throw new Error("navigation failed");
  });
  const hook = renderHook(
    () =>
      fixture.client.useSignInForm({
        initialValues: { email: "user@example.com", password: "secret" },
        onAuthenticated: completion,
      }),
    { wrapper: fixture.wrapper },
  );
  await waitFor(() => expect(hook.result.current.actions.submit.isDisabled).toBe(false));
  await act(async () => {
    expect(await hook.result.current.actions.submit.run()).toMatchObject({
      status: "error",
      error: { phase: "callback", writeSucceeded: true },
    });
  });
  expect(fixture.auth.signIn.email).toHaveBeenCalledOnce();
  expect(completion).toHaveBeenCalledOnce();
  expect(hook.result.current.feedback[0]?.recovery).toBeNull();
});

it("retires settled identity recovery on genuine workflow departure", async () => {
  const fixture = authenticationFixture();
  fixture.auth.signIn.email.mockResolvedValue({
    user: { id: "user", email: "user@example.com" },
    token: "private-token",
  });
  fixture.sessions.failNextRefresh(new Error("session read unavailable"));
  const first = renderHook(
    () =>
      fixture.client.useSignInForm({
        initialValues: { email: "user@example.com", password: "secret" },
      }),
    { wrapper: fixture.wrapper },
  );
  await waitFor(() => expect(first.result.current.actions.submit.isDisabled).toBe(false));
  await act(async () => {
    expect(await first.result.current.actions.submit.run()).toMatchObject({
      status: "error",
      error: { phase: "synchronization", writeSucceeded: true },
    });
  });
  first.unmount();
  await act(async () => Promise.resolve());

  const replacement = renderHook(
    () =>
      fixture.client.useSignInForm({
        initialValues: { email: "user@example.com", password: "secret" },
      }),
    { wrapper: fixture.wrapper },
  );
  await waitFor(() => expect(replacement.result.current.actions.submit.isDisabled).toBe(false));
  expect(replacement.result.current.feedback).toEqual([]);
});

it("recovers post-reset sign-out without consuming the token twice", async () => {
  const fixture = authenticationFixture();
  fixture.auth.signOut.mockRejectedValueOnce(new Error("sign-out unavailable"));
  const completed = vi.fn();
  const hook = renderHook(
    () =>
      fixture.client.usePasswordResetForm({
        initialValues: { newPassword: "" },
        token: "private-reset-token",
        onReset: completed,
      }),
    { wrapper: fixture.wrapper },
  );
  await waitFor(() => expect(hook.result.current.actions.submit.isDisabled).toBe(false));
  act(() => hook.result.current.field("newPassword").onChange("new-secret"));
  await act(async () => {
    expect(await hook.result.current.actions.submit.run()).toMatchObject({
      status: "error",
      error: { phase: "cleanup", writeSucceeded: true },
    });
  });
  expect(fixture.auth.resetPassword).toHaveBeenCalledOnce();
  expect(fixture.auth.signOut).toHaveBeenCalledOnce();
  expect(hook.result.current.field("newPassword").value).toBe("");
  await act(async () => {
    expect(await hook.result.current.feedback[0]!.recovery!.run()).toMatchObject({
      status: "success",
      data: { outcome: "reset" },
    });
  });
  expect(fixture.auth.resetPassword).toHaveBeenCalledOnce();
  expect(fixture.auth.signOut).toHaveBeenCalledTimes(2);
  expect(completed).toHaveBeenCalledOnce();
});

it("treats sign-up without a session as verification-required", async () => {
  const fixture = authenticationFixture();
  fixture.auth.signUp.email.mockResolvedValue({
    token: null,
    user: { id: "new-user", email: "new@example.com" },
  });
  const verification = vi.fn();
  const hook = renderHook(
    () =>
      fixture.client.useSignUpForm({
        initialValues: { email: "new@example.com", name: "New", password: "secret" },
        callbackURL: "https://example.com/verified",
        onVerificationRequired: verification,
      }),
    { wrapper: fixture.wrapper },
  );
  await waitFor(() => expect(hook.result.current.actions.submit.isDisabled).toBe(false));
  await act(async () => {
    expect(await hook.result.current.actions.submit.run()).toMatchObject({
      status: "success",
      data: { outcome: "verificationRequired", email: "new@example.com" },
    });
  });
  expect(fixture.auth.signUp.email).toHaveBeenCalledWith(
    expect.objectContaining({ callbackURL: "https://example.com/verified" }),
    expect.anything(),
  );
  expect(verification).toHaveBeenCalledOnce();
});

it("keeps sign-out synchronization recovery actionable after session absence", async () => {
  const current = {
    user: { id: "user", email: "user@example.com" },
    session: { id: "session", token: "private-token" },
  };
  const fixture = authenticationFixture(current);
  fixture.auth.signOut.mockImplementation(async () => {
    fixture.sessions.transition(null);
    return { status: true };
  });
  fixture.sessions.failAfterNextRefresh();
  const completed = vi.fn();
  const hook = renderHook(() => fixture.client.useSignOut({ onSignedOut: completed }), {
    wrapper: fixture.wrapper,
  });
  await waitFor(() => expect(hook.result.current.actions.signOut.isDisabled).toBe(false));
  await act(async () => {
    expect(await hook.result.current.actions.signOut.run()).toMatchObject({
      status: "error",
      error: { phase: "synchronization", writeSucceeded: true },
    });
  });
  expect(hook.result.current.feedback[0]?.recovery?.isDisabled).toBe(false);
  await act(async () => {
    expect(await hook.result.current.feedback[0]!.recovery!.run()).toEqual({
      status: "success",
      data: { outcome: "signedOut" },
    });
  });
  expect(fixture.auth.signOut).toHaveBeenCalledOnce();
  expect(completed).toHaveBeenCalledOnce();
});

it("keeps sign-out available while Convex authentication is temporarily unavailable", async () => {
  const current = {
    user: { id: "user", email: "user@example.com" },
    session: { id: "session", token: "private-token" },
  };
  const fixture = authenticationFixture(current);
  convexAuthenticated = false;
  fixture.auth.signOut.mockImplementation(async () => {
    fixture.sessions.transition(null);
    return { status: true };
  });
  const hook = renderHook(() => fixture.client.useSignOut(), { wrapper: fixture.wrapper });

  await waitFor(() => expect(hook.result.current.actions.signOut.isDisabled).toBe(false));
  await act(async () => {
    expect(await hook.result.current.actions.signOut.run()).toEqual({
      status: "success",
      data: { outcome: "signedOut" },
    });
  });
  expect(fixture.auth.signOut).toHaveBeenCalledOnce();
});

it("recovers displaced-session cleanup without repeating reauthentication", async () => {
  const current = {
    user: { id: "user", email: "user@example.com" },
    session: { id: "old-session", token: "private-old-token" },
  };
  const sessions = sessionStore(current);
  let user = { _id: "user", email: "user@example.com", name: "Original" };
  let userError: unknown = null;
  let failProfileSync = false;
  let userRevision = 0;
  const userListeners = new Set<() => void>();
  const emitUser = () => {
    userRevision++;
    for (const listener of userListeners) listener();
  };
  convexAuthenticated = true;
  const auth = {
    useSession: () => sessions.useSession(),
    signIn: {
      email: vi.fn(async () => {
        const next = {
          user: current.user,
          session: { id: "new-session", token: "private-new-token" },
        };
        sessions.transition(next);
        return { user: next.user, token: next.session.token };
      }),
    },
    signUp: { email: vi.fn() },
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
    sendVerificationEmail: vi.fn(),
    signOut: vi.fn(),
    updateUser: vi.fn(async (values: Record<string, unknown>) => {
      if (failProfileSync) {
        failProfileSync = false;
        userError = new Error("profile read unavailable");
      } else user = { ...user, ...values };
      emitUser();
      return { status: true };
    }),
    changeEmail: vi.fn(),
    changePassword: vi.fn(),
    listSessions: vi.fn(),
    revokeOtherSessions: vi.fn(),
    revokeSessions: vi.fn(),
    revokeSession: vi
      .fn()
      .mockRejectedValueOnce(new Error("cleanup unavailable"))
      .mockResolvedValue({ status: true }),
  };
  const client = createAuthDataClient({
    authClient: auth,
    api,
    features: { account: true },
    currentUser: {
      useCurrentUser() {
        useSyncExternalStore(
          (listener) => {
            userListeners.add(listener);
            return () => userListeners.delete(listener);
          },
          () => userRevision,
          () => userRevision,
        );
        return { data: user, identity: user._id, isPending: false, error: userError };
      },
    },
  });
  disposals.push(() => client.dispose());
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthDataProvider client={client}>{children}</AuthDataProvider>
  );
  const completed = vi.fn();
  const hook = renderHook(() => client.useReauthenticationForm({ onReauthenticated: completed }), {
    wrapper,
  });
  await waitFor(() => expect(hook.result.current.actions.submit.isDisabled).toBe(false));
  act(() => hook.result.current.field("password").onChange("secret"));
  await act(async () => {
    expect(await hook.result.current.actions.submit.run()).toMatchObject({
      status: "error",
      error: { phase: "cleanup", writeSucceeded: true },
    });
  });
  expect(auth.signIn.email).toHaveBeenCalledOnce();
  expect(auth.revokeSession).toHaveBeenCalledOnce();
  await act(async () => {
    expect(await hook.result.current.feedback[0]!.recovery!.run()).toMatchObject({
      status: "success",
      data: { outcome: "reauthenticated", userId: "user", sessionId: "new-session" },
    });
  });
  expect(auth.signIn.email).toHaveBeenCalledOnce();
  expect(auth.revokeSession).toHaveBeenCalledTimes(2);
  expect(completed).toHaveBeenCalledOnce();

  const profile = renderHook(
    () => client.useProfileSettings({ getInitialValues: (current) => ({ name: current.name }) }),
    { wrapper },
  );
  await waitFor(() => expect(profile.result.current.form).not.toBeNull());
  act(() => profile.result.current.form!.field("name").onChange("Local draft"));
  act(() => {
    user = { ...user, name: "Remote" };
    emitUser();
  });
  expect(profile.result.current.form!.field("name").value).toBe("Local draft");
  expect(profile.result.current.form!.hasServerChanges).toBe(true);
  await act(async () => {
    expect(await profile.result.current.form!.actions.submit.run()).toMatchObject({
      status: "success",
      data: { outcome: "updated", user: { name: "Local draft" } },
    });
  });
  expect(auth.updateUser).toHaveBeenCalledWith(
    { name: "Local draft" },
    expect.objectContaining({ throw: true }),
  );
  failProfileSync = true;
  const writesBeforeRecovery = auth.updateUser.mock.calls.length;
  await act(async () => {
    expect(
      await profile.result.current.actions.update.run({ name: "Recovered profile" }),
    ).toMatchObject({ status: "error", error: { phase: "synchronization", writeSucceeded: true } });
  });
  expect(profile.result.current.feedback[0]?.recovery).not.toBeNull();
  act(() => {
    userError = null;
    user = { ...user, name: "Recovered profile" };
    emitUser();
  });
  await act(async () => {
    expect(await profile.result.current.feedback[0]!.recovery!.run()).toMatchObject({
      status: "success",
      data: { user: { name: "Recovered profile" } },
    });
  });
  expect(auth.updateUser).toHaveBeenCalledTimes(writesBeforeRecovery + 1);

  await act(async () => {
    expect(
      await profile.result.current.actions.update.run({ name: "Preference update" }),
    ).toMatchObject({ status: "success", data: { user: { name: "Preference update" } } });
  });
  const email = renderHook(
    () =>
      client.useEmailChangeForm({
        initialValues: { newEmail: "" },
        callbackURL: "https://example.com/account",
      }),
    { wrapper },
  );
  act(() => email.result.current.field("newEmail").onChange("next@example.com"));
  await act(async () => {
    expect(await email.result.current.actions.submit.run()).toMatchObject({
      status: "success",
      data: { outcome: "confirmationRequired", email: "next@example.com" },
    });
  });
  expect(auth.changeEmail).toHaveBeenCalledWith(
    { newEmail: "next@example.com", callbackURL: "https://example.com/account" },
    expect.objectContaining({ throw: true }),
  );
  const password = renderHook(
    () =>
      client.usePasswordChangeForm({
        initialValues: { currentPassword: "", newPassword: "" },
        revokeOtherSessions: true,
      }),
    { wrapper },
  );
  act(() => {
    password.result.current.field("currentPassword").onChange("old-secret");
    password.result.current.field("newPassword").onChange("new-secret");
  });
  await act(async () => {
    expect(await password.result.current.actions.submit.run()).toMatchObject({
      status: "success",
      data: { outcome: "changed" },
    });
  });
  expect(auth.changePassword).toHaveBeenCalledWith(
    {
      currentPassword: "old-secret",
      newPassword: "new-secret",
      revokeOtherSessions: true,
    },
    expect.objectContaining({ throw: true }),
  );
  expect(password.result.current.field("currentPassword").value).toBe("");
  expect(password.result.current.field("newPassword").value).toBe("");
});
