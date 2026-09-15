import { looseObject, string, type ZodType } from "zod";
import type { CacheRuntime } from "../../cache/query-cache.js";
import type { AuthenticationClient } from "../../client/types.js";
import {
  asRecord,
  getActionState,
  requireAvailable,
  type ActionExecution,
  type Values,
  type WorkflowActionController,
} from "../shared/action.js";
import { useWorkflowForm, type FormOptions } from "../shared/form.js";
import { useIdentityAction } from "../shared/identity-action.js";
import {
  identityOperationObsolete,
  resultIdentity,
  synchronizeAuthenticated,
  textValue,
} from "../shared/identity-sync.js";
import { defineSchemaWorkflow, defineWorkflow, exposeWorkflow } from "../shared/root.js";
import type { WorkflowAction, WorkflowFeedback } from "../shared/types.js";

type Write = (body: Values, options: { throw: true; retry: 0 }) => Promise<unknown>;
type Options = FormOptions & Record<string, unknown>;
type AuthReceipt =
  | { kind: "signIn" | "signUp"; expected: { userId?: string; token?: string } }
  | {
      kind: "signOut";
      stage: "synchronization";
      original: { userId?: string; sessionId?: string };
    }
  | {
      kind: "passwordReset";
      stage: "signOut" | "synchronization";
      original: { userId?: string; sessionId?: string };
    };

const required = string().refine((value) => Boolean(value.trim()), "Required");
const signInMinimum: ZodType<Values, Values> = looseObject({ email: required, password: required });
const signUpMinimum: ZodType<Values, Values> = looseObject({
  email: required,
  name: required,
  password: required,
});
const emailMinimum: ZodType<Values, Values> = looseObject({ email: required });
const resetMinimum: ZodType<Values, Values> = looseObject({ newPassword: required });
const secretFields = ["password", "confirmPassword", "currentPassword", "newPassword"];
function codeOf(cause: unknown): string | undefined {
  const row = asRecord(cause);
  if (!row) return;
  if (typeof row.code === "string") return row.code;
  return codeOf(row.error) ?? codeOf(row.body);
}
async function synchronizeSignedOut(
  runtime: CacheRuntime,
  transaction: ActionExecution,
  original: { userId?: string; sessionId?: string },
) {
  transaction.phase("synchronization");
  await runtime.refreshSession();
  await runtime.waitForAuth(
    (state) =>
      !state.sessionPending && !state.userId && !state.convexLoading && !state.convexAuthenticated,
    transaction.signal,
    10_000,
    (state) =>
      state.userId && (state.userId !== original.userId || state.sessionId !== original.sessionId)
        ? identityOperationObsolete
        : undefined,
  );
}
function recoveryFeedback(
  action: WorkflowActionController,
  target: { operation: "signIn" | "signUp" | "signOut" | "resetPassword" },
  recovery: WorkflowAction,
  hasReceipt: boolean,
): WorkflowFeedback[] {
  const error = action.error;
  return hasReceipt && error?.writeSucceeded
    ? [{ target, error: error.cause, diagnostics: error, recovery }]
    : [];
}
function preserveRecoveryReset<T extends { reset(): void }>(state: T, pending: boolean): T {
  return pending ? { ...state, reset() {} } : state;
}

function withRecoveryFeedback<T extends { reset(): void }>(
  state: T,
  action: WorkflowActionController,
  target: { operation: "signIn" | "signUp" | "signOut" | "resetPassword" },
  recovery: WorkflowAction,
  hasReceipt: boolean,
) {
  return preserveRecoveryReset(
    {
      ...state,
      feedback: action.feedback(recoveryFeedback(action, target, recovery, hasReceipt)),
    },
    hasReceipt,
  );
}

function recoveryAction(
  action: WorkflowActionController,
  target: { operation: "signIn" | "signUp" | "signOut" | "resetPassword" },
  finish: (transaction: ActionExecution) => Promise<unknown>,
): WorkflowAction {
  return {
    ...action.control(target),
    run: () => action.run(target, finish, true),
  };
}

function observedIdentity(runtime: CacheRuntime) {
  return {
    userId: runtime.authObservation.userId,
    sessionId: runtime.authObservation.sessionId,
  };
}

export function createAuthenticationWorkflows(auth: AuthenticationClient, runtime: CacheRuntime) {
  const receipts = new Map<string, AuthReceipt>();
  const call = (endpoint: Write, values: Values) => endpoint(values, { throw: true, retry: 0 });
  function useReceiptAction(
    scope: string,
    availability: "guest" | "authenticated" | "settled",
    options: Options,
  ) {
    const action = useIdentityAction(
      runtime,
      scope,
      availability,
      options.enabled !== false,
      options,
      { onRetire: () => receipts.delete(scope) },
    );
    return { action, receipt: receipts.get(scope) };
  }
  async function finishAuthentication(
    scope: string,
    kind: "signIn" | "signUp",
    options: Options,
    transaction: ActionExecution,
  ) {
    const receipt = receipts.get(scope);
    requireAvailable(receipt?.kind === kind);
    const identity = await synchronizeAuthenticated(runtime, transaction, receipt.expected);
    receipts.delete(scope);
    const completion = { outcome: "authenticated" as const, ...identity };
    await transaction.complete(() =>
      (options.onAuthenticated as ((value: unknown) => void | Promise<void>) | undefined)?.(
        completion,
      ),
    );
    return completion;
  }

  function useAuthenticationEntry(
    scope: "sign-in" | "sign-up",
    kind: "signIn" | "signUp",
    operation: "signIn" | "signUp",
    options: Options,
  ) {
    const { action, receipt } = useReceiptAction(scope, "guest", options);
    const finish = (transaction: ActionExecution) =>
      finishAuthentication(scope, kind, options, transaction);
    const target = { operation };
    const recovery = recoveryAction(action, target, finish);
    return { action, finish, hasReceipt: receipt !== undefined, recovery, target };
  }

  function useSignInForm(options: Options) {
    const entry = useAuthenticationEntry("sign-in", "signIn", "signIn", options);
    const { action, finish, hasReceipt, recovery, target } = entry;
    const form = useWorkflowForm(options, action, {
      operation: "signIn",
      minimum: signInMinimum,
      secretFields,
      blocked: hasReceipt,
      disabledReason: hasReceipt ? { code: "recovery" } : null,
      write: async (values, transaction) => {
        try {
          const result = await transaction.write(() => call(auth.signIn.email as Write, values));
          receipts.set("sign-in", { kind: "signIn", expected: resultIdentity(result) });
          return finish(transaction);
        } catch (cause) {
          if (codeOf(cause) !== "EMAIL_NOT_VERIFIED") throw cause;
          const completion = {
            outcome: "verificationRequired" as const,
            email: textValue(values.email),
          };
          await transaction.complete(() =>
            (
              options.onVerificationRequired as
                | ((value: unknown) => void | Promise<void>)
                | undefined
            )?.(completion),
          );
          return completion;
        }
      },
    });
    return withRecoveryFeedback(form, action, target, recovery, hasReceipt);
  }

  function useSignUpForm(options: Options) {
    const entry = useAuthenticationEntry("sign-up", "signUp", "signUp", options);
    const { action, finish, hasReceipt, recovery, target } = entry;
    const form = useWorkflowForm(options, action, {
      operation: "signUp",
      minimum: signUpMinimum,
      secretFields,
      blocked: hasReceipt,
      disabledReason: hasReceipt ? { code: "recovery" } : null,
      write: async (values, transaction) => {
        const callbackURL = textValue(options.callbackURL) || undefined;
        const result = await transaction.write(() =>
          call(auth.signUp.email as Write, {
            ...values,
            ...(callbackURL ? { callbackURL } : {}),
          }),
        );
        const expected = resultIdentity(result);
        if (expected.token) {
          receipts.set("sign-up", { kind: "signUp", expected });
          return finish(transaction);
        }
        const completion = {
          outcome: "verificationRequired" as const,
          email: textValue(values.email),
        };
        await transaction.complete(() =>
          (
            options.onVerificationRequired as ((value: unknown) => void | Promise<void>) | undefined
          )?.(completion),
        );
        return completion;
      },
    });
    return withRecoveryFeedback(form, action, target, recovery, hasReceipt);
  }

  function usePasswordResetRequestForm(options: Options) {
    return useEmailRequest(
      "password-reset-request",
      "requestPasswordReset",
      auth.requestPasswordReset as Write,
      "redirectTo",
      options,
    );
  }

  function useEmailRequest(
    scope: string,
    operation: "requestPasswordReset" | "sendVerificationEmail",
    endpoint: Write,
    callbackKey: "redirectTo" | "callbackURL",
    options: Options,
  ) {
    const action = useIdentityAction(runtime, scope, "settled", options.enabled !== false, options);
    return useWorkflowForm(options, action, {
      operation,
      minimum: emailMinimum,
      write: async (values, transaction) => {
        const callback = textValue(options[callbackKey]) || undefined;
        await transaction.write(() =>
          call(endpoint, {
            ...values,
            ...(callback ? { [callbackKey]: callback } : {}),
          }),
        );
        const completion = { outcome: "requested" as const, email: textValue(values.email) };
        await transaction.complete(() =>
          (options.onRequested as ((value: unknown) => void | Promise<void>) | undefined)?.(
            completion,
          ),
        );
        return completion;
      },
    });
  }

  function usePasswordResetForm(options: Options) {
    const scope = "password-reset";
    const { action, receipt } = useReceiptAction(scope, "settled", options);
    const finish = async (transaction: ActionExecution) => {
      const current = receipts.get(scope);
      requireAvailable(current?.kind === "passwordReset");
      if (options.signOutAfterReset !== false && current.stage === "signOut") {
        transaction.phase("cleanup");
        await call(auth.signOut as Write, {});
        current.stage = "synchronization";
      }
      if (options.signOutAfterReset !== false)
        await synchronizeSignedOut(runtime, transaction, current.original);
      receipts.delete(scope);
      const completion = { outcome: "reset" as const };
      await transaction.complete(() =>
        (options.onReset as ((value: unknown) => void | Promise<void>) | undefined)?.(completion),
      );
      return completion;
    };
    const target = { operation: "resetPassword" as const };
    const recovery = recoveryAction(action, target, finish);
    const form = useWorkflowForm(options, action, {
      operation: "resetPassword",
      minimum: resetMinimum,
      secretFields,
      blocked: receipt !== undefined,
      disabledReason: receipt ? { code: "recovery" } : null,
      write: async (values, transaction) => {
        const original = observedIdentity(runtime);
        await transaction.write(() =>
          call(auth.resetPassword as Write, { ...values, token: options.token }),
        );
        receipts.set(scope, { kind: "passwordReset", stage: "signOut", original });
        return finish(transaction);
      },
    });
    return withRecoveryFeedback(form, action, target, recovery, receipt !== undefined);
  }

  function useEmailVerification(options: Options) {
    return useEmailRequest(
      "email-verification",
      "sendVerificationEmail",
      auth.sendVerificationEmail as Write,
      "callbackURL",
      options,
    );
  }

  function useSignOut(options: Options = { initialValues: {} }) {
    const scope = "sign-out";
    const { action, receipt } = useReceiptAction(scope, "authenticated", options);
    const finish = async (transaction: ActionExecution) => {
      const current = receipts.get(scope);
      requireAvailable(current?.kind === "signOut");
      await synchronizeSignedOut(runtime, transaction, current.original);
      receipts.delete(scope);
      const completion = { outcome: "signedOut" as const };
      await transaction.complete(() =>
        (options.onSignedOut as ((value: unknown) => void | Promise<void>) | undefined)?.(
          completion,
        ),
      );
      return completion;
    };
    const target = { operation: "signOut" as const };
    const recovery = recoveryAction(action, target, finish);
    const state = {
      ...getActionState(action),
      actions: {
        signOut: {
          ...action.control(target, receipt ? { code: "recovery" } : null),
          run: () =>
            action.run(target, async (transaction) => {
              const original = observedIdentity(runtime);
              await transaction.write(() => call(auth.signOut as Write, {}));
              receipts.set(scope, { kind: "signOut", stage: "synchronization", original });
              return finish(transaction);
            }),
        },
      },
    };
    return withRecoveryFeedback(state, action, target, recovery, receipt !== undefined);
  }

  const signIn = defineWorkflow(useSignInForm);
  const signUp = defineWorkflow(useSignUpForm);
  const requestReset = defineWorkflow(usePasswordResetRequestForm);
  const reset = defineWorkflow(usePasswordResetForm);
  const verification = defineWorkflow(useEmailVerification);
  const signOut = defineWorkflow(useSignOut);
  return {
    ...exposeWorkflow("SignInForm", signIn, (schema: ZodType<Values, Values>) =>
      defineSchemaWorkflow(useSignInForm, schema),
    ),
    ...exposeWorkflow("SignUpForm", signUp, (schema: ZodType<Values, Values>) =>
      defineSchemaWorkflow(useSignUpForm, schema),
    ),
    ...exposeWorkflow("PasswordResetRequestForm", requestReset, (schema: ZodType<Values, Values>) =>
      defineSchemaWorkflow(usePasswordResetRequestForm, schema),
    ),
    ...exposeWorkflow("PasswordResetForm", reset, (schema: ZodType<Values, Values>) =>
      defineSchemaWorkflow(usePasswordResetForm, schema),
    ),
    ...exposeWorkflow("EmailVerification", verification, (schema: ZodType<Values, Values>) =>
      defineSchemaWorkflow(useEmailVerification, schema),
    ),
    ...exposeWorkflow("SignOut", signOut),
  };
}
