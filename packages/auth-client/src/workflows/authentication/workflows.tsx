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
import { defineWorkflow } from "../shared/root.js";
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

export function createAuthenticationWorkflows(auth: AuthenticationClient, runtime: CacheRuntime) {
  const receipts = new Map<string, AuthReceipt>();
  const call = (endpoint: Write, values: Values) => endpoint(values, { throw: true, retry: 0 });
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

  function useSignInForm(options: Options) {
    const scope = "sign-in";
    const action = useIdentityAction(runtime, scope, "guest", options.enabled !== false, options, {
      onRetire: () => receipts.delete(scope),
    });
    const receipt = receipts.get(scope);
    const finish = (transaction: ActionExecution) =>
      finishAuthentication(scope, "signIn", options, transaction);
    const target = { operation: "signIn" as const };
    const recovery: WorkflowAction = {
      ...action.control(target),
      run: () => action.run(target, finish, true),
    };
    const form = useWorkflowForm(options, action, {
      operation: "signIn",
      minimum: signInMinimum,
      secretFields,
      blocked: receipt !== undefined,
      disabledReason: receipt ? { code: "recovery" } : null,
      write: async (values, transaction) => {
        try {
          const result = await transaction.write(() => call(auth.signIn.email as Write, values));
          receipts.set(scope, { kind: "signIn", expected: resultIdentity(result) });
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
    return preserveRecoveryReset(
      {
        ...form,
        feedback: action.feedback(
          recoveryFeedback(action, target, recovery, receipt !== undefined),
        ),
      },
      receipt !== undefined,
    );
  }

  function useSignUpForm(options: Options) {
    const scope = "sign-up";
    const action = useIdentityAction(runtime, scope, "guest", options.enabled !== false, options, {
      onRetire: () => receipts.delete(scope),
    });
    const receipt = receipts.get(scope);
    const finish = (transaction: ActionExecution) =>
      finishAuthentication(scope, "signUp", options, transaction);
    const target = { operation: "signUp" as const };
    const recovery: WorkflowAction = {
      ...action.control(target),
      run: () => action.run(target, finish, true),
    };
    const form = useWorkflowForm(options, action, {
      operation: "signUp",
      minimum: signUpMinimum,
      secretFields,
      blocked: receipt !== undefined,
      disabledReason: receipt ? { code: "recovery" } : null,
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
          receipts.set(scope, { kind: "signUp", expected });
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
    return preserveRecoveryReset(
      {
        ...form,
        feedback: action.feedback(
          recoveryFeedback(action, target, recovery, receipt !== undefined),
        ),
      },
      receipt !== undefined,
    );
  }

  function usePasswordResetRequestForm(options: Options) {
    const action = useIdentityAction(
      runtime,
      "password-reset-request",
      "settled",
      options.enabled !== false,
      options,
    );
    return useWorkflowForm(options, action, {
      operation: "requestPasswordReset",
      minimum: emailMinimum,
      write: async (values, transaction) => {
        await transaction.write(() =>
          call(auth.requestPasswordReset as Write, {
            ...values,
            redirectTo: options.redirectTo,
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
    const action = useIdentityAction(
      runtime,
      scope,
      "settled",
      options.enabled !== false,
      options,
      { onRetire: () => receipts.delete(scope) },
    );
    const receipt = receipts.get(scope);
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
    const recovery: WorkflowAction = {
      ...action.control(target),
      run: () => action.run(target, finish, true),
    };
    const form = useWorkflowForm(options, action, {
      operation: "resetPassword",
      minimum: resetMinimum,
      secretFields,
      blocked: receipt !== undefined,
      disabledReason: receipt ? { code: "recovery" } : null,
      write: async (values, transaction) => {
        const original = {
          userId: runtime.authObservation.userId,
          sessionId: runtime.authObservation.sessionId,
        };
        await transaction.write(() =>
          call(auth.resetPassword as Write, { ...values, token: options.token }),
        );
        receipts.set(scope, { kind: "passwordReset", stage: "signOut", original });
        return finish(transaction);
      },
    });
    return preserveRecoveryReset(
      {
        ...form,
        feedback: action.feedback(
          recoveryFeedback(action, target, recovery, receipt !== undefined),
        ),
      },
      receipt !== undefined,
    );
  }

  function useEmailVerification(options: Options) {
    const action = useIdentityAction(
      runtime,
      "email-verification",
      "settled",
      options.enabled !== false,
      options,
    );
    return useWorkflowForm(options, action, {
      operation: "sendVerificationEmail",
      minimum: emailMinimum,
      write: async (values, transaction) => {
        const callbackURL = textValue(options.callbackURL) || undefined;
        await transaction.write(() =>
          call(auth.sendVerificationEmail as Write, {
            ...values,
            ...(callbackURL ? { callbackURL } : {}),
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

  function useSignOut(options: Options = { initialValues: {} }) {
    const scope = "sign-out";
    const action = useIdentityAction(
      runtime,
      scope,
      "authenticated",
      options.enabled !== false,
      options,
      { onRetire: () => receipts.delete(scope) },
    );
    const receipt = receipts.get(scope);
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
    const recovery: WorkflowAction = {
      ...action.control(target),
      run: () => action.run(target, finish, true),
    };
    const state = {
      ...getActionState(action),
      feedback: action.feedback(recoveryFeedback(action, target, recovery, receipt !== undefined)),
      actions: {
        signOut: {
          ...action.control(target, receipt ? { code: "recovery" } : null),
          run: () =>
            action.run(target, async (transaction) => {
              const original = {
                userId: runtime.authObservation.userId,
                sessionId: runtime.authObservation.sessionId,
              };
              await transaction.write(() => call(auth.signOut as Write, {}));
              receipts.set(scope, { kind: "signOut", stage: "synchronization", original });
              return finish(transaction);
            }),
        },
      },
    };
    return preserveRecoveryReset(state, receipt !== undefined);
  }

  const signIn = defineWorkflow(useSignInForm);
  const signUp = defineWorkflow(useSignUpForm);
  const requestReset = defineWorkflow(usePasswordResetRequestForm);
  const reset = defineWorkflow(usePasswordResetForm);
  const verification = defineWorkflow(useEmailVerification);
  const signOut = defineWorkflow(useSignOut);
  const define = (hook: (options: Options) => unknown, schema: ZodType<Values, Values>) =>
    defineWorkflow((options: Options) => hook({ ...options, schema }));
  return {
    useSignInForm: signIn.useWorkflow,
    SignInForm: signIn.Root,
    useSignInFormContext: signIn.useWorkflowContext,
    defineSignInForm: (schema: ZodType<Values, Values>) => define(useSignInForm, schema),
    useSignUpForm: signUp.useWorkflow,
    SignUpForm: signUp.Root,
    useSignUpFormContext: signUp.useWorkflowContext,
    defineSignUpForm: (schema: ZodType<Values, Values>) => define(useSignUpForm, schema),
    usePasswordResetRequestForm: requestReset.useWorkflow,
    PasswordResetRequestForm: requestReset.Root,
    usePasswordResetRequestFormContext: requestReset.useWorkflowContext,
    definePasswordResetRequestForm: (schema: ZodType<Values, Values>) =>
      define(usePasswordResetRequestForm, schema),
    usePasswordResetForm: reset.useWorkflow,
    PasswordResetForm: reset.Root,
    usePasswordResetFormContext: reset.useWorkflowContext,
    definePasswordResetForm: (schema: ZodType<Values, Values>) =>
      define(usePasswordResetForm, schema),
    useEmailVerification: verification.useWorkflow,
    EmailVerification: verification.Root,
    useEmailVerificationContext: verification.useWorkflowContext,
    defineEmailVerification: (schema: ZodType<Values, Values>) =>
      define(useEmailVerification, schema),
    useSignOut: signOut.useWorkflow,
    SignOut: signOut.Root,
    useSignOutContext: signOut.useWorkflowContext,
  };
}
