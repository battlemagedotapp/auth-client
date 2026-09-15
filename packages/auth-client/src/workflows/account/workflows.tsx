import { useLayoutEffect, useState } from "react";
import { looseObject, string, type ZodType } from "zod";
import type { CacheRuntime } from "../../cache/query-cache.js";
import type { AccountClient } from "../../client/types.js";
import {
  asRecord,
  getActionState,
  requireAvailable,
  useWorkflowAction,
  type ActionExecution,
  type Values,
  type WorkflowActionController,
} from "../shared/action.js";
import { useWorkflowForm, type FormOptions } from "../shared/form.js";
import { useIdentityAction } from "../shared/identity-action.js";
import { resultIdentity, synchronizeAuthenticated, textValue } from "../shared/identity-sync.js";
import { defineWorkflow } from "../shared/root.js";
import type { WorkflowAction, WorkflowFeedback } from "../shared/types.js";
import type { CurrentUserBinding, CurrentUserState } from "./types.js";

type Write = (body: Values, options: { throw: true; retry: 0 }) => Promise<unknown>;
type Options = FormOptions & Record<string, unknown>;
const required = string().refine((value) => Boolean(value.trim()), "Required");
const emailMinimum: ZodType<Values, Values> = looseObject({ newEmail: required });
const passwordMinimum: ZodType<Values, Values> = looseObject({
  currentPassword: required,
  newPassword: required,
});
const reauthenticationMinimum: ZodType<Values, Values> = looseObject({ password: required });
const secretFields = ["password", "confirmPassword", "currentPassword", "newPassword"];
function preserveRecoveryReset<T extends { reset(): void }>(state: T, pending: boolean): T {
  return pending ? { ...state, reset() {} } : state;
}

function createUserObserver<U>() {
  let current: CurrentUserState<U> = {
    data: undefined,
    identity: undefined,
    isPending: true,
    error: null,
  };
  const listeners = new Set<() => void>();
  return {
    get current() {
      return current;
    },
    observe(next: CurrentUserState<U>) {
      current = next;
      for (const listener of listeners) listener();
    },
    waitFor(predicate: (user: U) => boolean, signal: AbortSignal, timeout = 10_000) {
      if (signal.aborted)
        return Promise.reject(
          new DOMException("Profile synchronization was cancelled", "AbortError"),
        );
      if (current.data && predicate(current.data)) return Promise.resolve(current.data);
      if (current.error) return Promise.reject(current.error);
      return new Promise<U>((resolve, reject) => {
        const finish = (error: unknown, user?: U) => {
          clearTimeout(timer);
          listeners.delete(check);
          signal.removeEventListener("abort", abort);
          if (error) reject(error);
          else resolve(user!);
        };
        const check = () => {
          if (current.error) finish(current.error);
          else if (current.data && predicate(current.data)) finish(null, current.data);
        };
        const abort = () =>
          finish(new DOMException("Profile synchronization was cancelled", "AbortError"));
        const timer = setTimeout(
          () => finish(new Error("Profile synchronization timed out")),
          timeout,
        );
        listeners.add(check);
        signal.addEventListener("abort", abort, { once: true });
      });
    },
  };
}

function matches(user: unknown, values: Values) {
  const row = asRecord(user);
  return (
    !!row &&
    Object.entries(values).every(
      ([key, value]) => value === undefined || Object.is(row[key], value),
    )
  );
}

type UserObserver<U> = {
  readonly current: CurrentUserState<U>;
  waitFor(predicate: (user: U) => boolean, signal: AbortSignal, timeout?: number): Promise<U>;
};
type ProfileTarget = "updateProfile" | "updateProfileImage";

function useProfileUpdates<U>(
  auth: AccountClient,
  users: UserObserver<U>,
  action: WorkflowActionController,
  onUpdated: ((value: unknown) => void | Promise<void>) | undefined,
) {
  const [receipt, setReceipt] = useState<{
    owner: symbol;
    target: ProfileTarget;
    values: Values;
  }>();
  const pending = receipt?.owner === action.owner ? receipt : undefined;
  const publish = (value: { target: ProfileTarget; values: Values } | undefined) =>
    setReceipt(value ? { owner: action.owner, ...value } : undefined);
  async function synchronize(values: Values, transaction: ActionExecution) {
    transaction.phase("synchronization");
    const canonical = await users.waitFor(
      (candidate) => matches(candidate, values),
      transaction.signal,
    );
    publish(undefined);
    return { outcome: "updated" as const, user: canonical };
  }
  async function write(target: ProfileTarget, values: Values, transaction: ActionExecution) {
    await transaction.write(() => (auth.updateUser as Write)(values, { throw: true, retry: 0 }));
    publish({ target, values });
    return synchronize(values, transaction);
  }
  async function complete(
    completion: { outcome: "updated"; user: U },
    transaction: ActionExecution,
  ) {
    await transaction.complete(() => onUpdated?.(completion));
    return completion;
  }
  const recoveryTarget = { operation: pending?.target ?? "updateProfile" } as const;
  const recovery: WorkflowAction = {
    ...action.control(recoveryTarget),
    run: () =>
      pending
        ? action.run(
            recoveryTarget,
            async (transaction) =>
              complete(await synchronize(pending.values, transaction), transaction),
            true,
          )
        : Promise.resolve({ status: "ignored" as const, reason: "unavailable" as const }),
  };
  const recoveries: WorkflowFeedback[] =
    pending && action.error?.writeSucceeded
      ? [
          {
            target: recoveryTarget,
            error: action.error.cause,
            diagnostics: action.error,
            recovery,
          },
        ]
      : [];
  return { pending, feedback: action.feedback(recoveries), write, complete };
}

export function createAccountWorkflows<U extends { email: string }>(
  auth: AccountClient,
  runtime: CacheRuntime,
  currentUser: CurrentUserBinding<U>,
) {
  const users = createUserObserver<U>();
  const reauthenticationReceipts = new Map<
    string,
    {
      displacedToken?: string;
      expected: { userId?: string; token?: string };
      originalUserId: string;
      stage: "synchronization" | "cleanup";
      userId?: string;
      sessionId?: string;
    }
  >();

  function useUser() {
    const state = currentUser.useCurrentUser();
    useLayoutEffect(() => users.observe(state), [state]);
    return state;
  }

  function useProfileSettings(options: Options) {
    const source = useUser();
    const user = source.data ?? undefined;
    const enabled =
      options.enabled !== false &&
      !!user &&
      source.identity !== undefined &&
      source.identity === runtime.authObservation.userId;
    const action = useWorkflowAction(runtime, "profile-settings", enabled, options);
    const updates = useProfileUpdates(
      auth,
      users,
      action,
      options.onUpdated as ((value: unknown) => void | Promise<void>) | undefined,
    );
    const initialValues = user
      ? (options.getInitialValues as (value: U) => Values)(user)
      : ({} as Values);
    const workflowForm = useWorkflowForm({ ...options, initialValues }, action, {
      operation: "updateProfile",
      minimum: looseObject({}),
      syncDefaults: true,
      blocked: !user || updates.pending !== undefined,
      disabledReason: updates.pending ? { code: "recovery" } : null,
      write: (values, transaction) => updates.write("updateProfile", values, transaction),
      complete: (completion, transaction) =>
        updates.complete(completion as { outcome: "updated"; user: U }, transaction),
    });
    const updateTarget = { operation: "updateProfile" as const };
    const updateImageTarget = { operation: "updateProfileImage" as const };
    const updateFields: WorkflowAction<[Values], unknown> = {
      ...action.control(updateTarget, updates.pending ? { code: "recovery" } : null),
      run: (values) =>
        action.run(updateTarget, async (transaction) =>
          updates.complete(await updates.write("updateProfile", values, transaction), transaction),
        ),
    };
    const updateImage: WorkflowAction<[string | null], unknown> = {
      ...action.control(updateImageTarget, updates.pending ? { code: "recovery" } : null),
      run: (image) =>
        action.run(updateImageTarget, async (transaction) =>
          updates.complete(
            await updates.write("updateProfileImage", { image }, transaction),
            transaction,
          ),
        ),
    };
    const form = preserveRecoveryReset(
      { ...workflowForm, feedback: updates.feedback },
      updates.pending !== undefined,
    );
    const state = preserveRecoveryReset(
      { ...getActionState(action), feedback: updates.feedback },
      updates.pending !== undefined,
    );
    return {
      ...state,
      user,
      isPending: source.isPending,
      queryError: source.error,
      form: user ? form : null,
      actions: { update: updateFields, updateImage },
    };
  }

  function useEmailChangeForm(options: Options) {
    const action = useWorkflowAction(runtime, "email-change", options.enabled !== false, options);
    return useWorkflowForm(options, action, {
      operation: "changeEmail",
      minimum: emailMinimum,
      syncDefaults: true,
      write: async (values, transaction) => {
        await transaction.write(() =>
          (auth.changeEmail as Write)(
            { ...values, callbackURL: options.callbackURL },
            { throw: true, retry: 0 },
          ),
        );
        return { outcome: "confirmationRequired", email: textValue(values.newEmail) };
      },
      complete: async (completion, transaction) => {
        await transaction.complete(() =>
          (options.onRequested as ((value: unknown) => void | Promise<void>) | undefined)?.(
            completion,
          ),
        );
        return completion;
      },
    });
  }

  function usePasswordChangeForm(options: Options) {
    const action = useWorkflowAction(
      runtime,
      "password-change",
      options.enabled !== false,
      options,
    );
    return useWorkflowForm(options, action, {
      operation: "changePassword",
      minimum: passwordMinimum,
      secretFields,
      write: async (values, transaction) => {
        await transaction.write(() =>
          (auth.changePassword as Write)(
            { ...values, revokeOtherSessions: options.revokeOtherSessions },
            { throw: true, retry: 0 },
          ),
        );
        return { outcome: "changed" };
      },
      complete: async (completion, transaction) => {
        await transaction.complete(() =>
          (options.onChanged as ((value: unknown) => void | Promise<void>) | undefined)?.(
            completion,
          ),
        );
        return completion;
      },
    });
  }

  function useReauthenticationForm(options: Options = { initialValues: { password: "" } }) {
    const source = useUser();
    const scope = "reauthentication";
    const action = useIdentityAction(
      runtime,
      scope,
      "authenticated",
      options.enabled !== false && !!source.data,
      options,
      { onRetire: () => reauthenticationReceipts.delete(scope) },
    );
    const receipt = reauthenticationReceipts.get(scope);
    const finish = async (transaction: ActionExecution) => {
      const current = reauthenticationReceipts.get(scope);
      requireAvailable(current);
      if (current.stage === "synchronization") {
        await synchronizeAuthenticated(
          runtime,
          transaction,
          current.expected,
          current.displacedToken,
        );
        if (runtime.authObservation.userId !== current.originalUserId)
          throw new Error("Reauthentication changed the authenticated user");
        const { userId, sessionId } = runtime.authObservation;
        requireAvailable(userId && sessionId);
        current.userId = userId;
        current.sessionId = sessionId;
        current.stage = "cleanup";
      }
      if (
        current.displacedToken &&
        current.displacedToken !== runtime.authObservation.sessionToken
      ) {
        transaction.phase("cleanup");
        await (auth.revokeSession as Write)(
          { token: current.displacedToken },
          { throw: true, retry: 0 },
        );
      }
      requireAvailable(current.userId && current.sessionId);
      const completion = {
        outcome: "reauthenticated" as const,
        userId: current.userId,
        sessionId: current.sessionId,
      };
      reauthenticationReceipts.delete(scope);
      await transaction.complete(() =>
        (options.onReauthenticated as ((value: unknown) => void | Promise<void>) | undefined)?.(
          completion,
        ),
      );
      return completion;
    };
    const recovery: WorkflowAction = {
      ...action.control({ operation: "reauthenticate" }),
      run: () => action.run({ operation: "reauthenticate" }, finish, true),
    };
    const form = useWorkflowForm(
      {
        ...options,
        initialValues: (options.initialValues as Values | undefined) ?? { password: "" },
      },
      action,
      {
        operation: "reauthenticate",
        minimum: reauthenticationMinimum,
        secretFields,
        blocked: receipt !== undefined,
        disabledReason: receipt !== undefined ? { code: "recovery" } : null,
        write: async (values, transaction) => {
          const user = users.current.data;
          requireAvailable(user);
          const originalUserId = users.current.identity;
          const displacedToken = runtime.authObservation.sessionToken;
          const result = await transaction.write(() =>
            (auth.signIn.email as Write)(
              { email: user.email, password: values.password },
              { throw: true, retry: 0 },
            ),
          );
          requireAvailable(originalUserId);
          const expected = resultIdentity(result);
          reauthenticationReceipts.set(scope, {
            displacedToken,
            expected: { userId: originalUserId, token: expected.token },
            originalUserId,
            stage: "synchronization",
          });
          return finish(transaction);
        },
      },
    );
    const error = action.error;
    const recoveries: WorkflowFeedback[] =
      receipt !== undefined && error?.writeSucceeded
        ? [
            {
              target: { operation: "reauthenticate" },
              error: error.cause,
              diagnostics: error,
              recovery,
            },
          ]
        : [];
    return preserveRecoveryReset(
      { ...form, feedback: action.feedback(recoveries) },
      receipt !== undefined,
    );
  }

  const profile = defineWorkflow(useProfileSettings);
  const email = defineWorkflow(useEmailChangeForm);
  const password = defineWorkflow(usePasswordChangeForm);
  const reauthentication = defineWorkflow(useReauthenticationForm);
  const define = (hook: (options: Options) => unknown, schema: ZodType<Values, Values>) =>
    defineWorkflow((options: Options) => hook({ ...options, schema }));
  return {
    useProfileSettings: profile.useWorkflow,
    ProfileSettings: profile.Root,
    useProfileSettingsContext: profile.useWorkflowContext,
    defineProfileSettings: (schema: ZodType<Values, Values>) => define(useProfileSettings, schema),
    useEmailChangeForm: email.useWorkflow,
    EmailChangeForm: email.Root,
    useEmailChangeFormContext: email.useWorkflowContext,
    defineEmailChangeForm: (schema: ZodType<Values, Values>) => define(useEmailChangeForm, schema),
    usePasswordChangeForm: password.useWorkflow,
    PasswordChangeForm: password.Root,
    usePasswordChangeFormContext: password.useWorkflowContext,
    definePasswordChangeForm: (schema: ZodType<Values, Values>) =>
      define(usePasswordChangeForm, schema),
    useReauthenticationForm: reauthentication.useWorkflow,
    ReauthenticationForm: reauthentication.Root,
    useReauthenticationFormContext: reauthentication.useWorkflowContext,
    defineReauthenticationForm: (schema: ZodType<Values, Values>) =>
      define(useReauthenticationForm, schema),
  };
}
