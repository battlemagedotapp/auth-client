import { looseObject, string } from "zod";
import { asRecord, getActionState, requireAvailable, } from "../shared/action.js";
import { useWorkflowForm } from "../shared/form.js";
import { useIdentityAction } from "../shared/identity-action.js";
import { identityOperationObsolete, resultIdentity, synchronizeAuthenticated, textValue, } from "../shared/identity-sync.js";
import { defineWorkflow } from "../shared/root.js";
const required = string().refine((value) => Boolean(value.trim()), "Required");
const signInMinimum = looseObject({ email: required, password: required });
const signUpMinimum = looseObject({
    email: required,
    name: required,
    password: required,
});
const emailMinimum = looseObject({ email: required });
const resetMinimum = looseObject({ newPassword: required });
const secretFields = ["password", "confirmPassword", "currentPassword", "newPassword"];
function codeOf(cause) {
    const row = asRecord(cause);
    if (!row)
        return;
    if (typeof row.code === "string")
        return row.code;
    return codeOf(row.error) ?? codeOf(row.body);
}
async function synchronizeSignedOut(runtime, transaction, original) {
    transaction.phase("synchronization");
    await runtime.refreshSession();
    await runtime.waitForAuth((state) => !state.sessionPending && !state.userId && !state.convexLoading && !state.convexAuthenticated, transaction.signal, 10_000, (state) => state.userId && (state.userId !== original.userId || state.sessionId !== original.sessionId)
        ? identityOperationObsolete
        : undefined);
}
function recoveryFeedback(action, target, recovery, hasReceipt) {
    const error = action.error;
    return hasReceipt && error?.writeSucceeded
        ? [{ target, error: error.cause, diagnostics: error, recovery }]
        : [];
}
function preserveRecoveryReset(state, pending) {
    return pending ? { ...state, reset() { } } : state;
}
export function createAuthenticationWorkflows(auth, runtime) {
    const receipts = new Map();
    const call = (endpoint, values) => endpoint(values, { throw: true, retry: 0 });
    async function finishAuthentication(scope, kind, options, transaction) {
        const receipt = receipts.get(scope);
        requireAvailable(receipt?.kind === kind);
        const identity = await synchronizeAuthenticated(runtime, transaction, receipt.expected);
        receipts.delete(scope);
        const completion = { outcome: "authenticated", ...identity };
        await transaction.complete(() => options.onAuthenticated?.(completion));
        return completion;
    }
    function useSignInForm(options) {
        const scope = "sign-in";
        const action = useIdentityAction(runtime, scope, "guest", options.enabled !== false, options, {
            onRetire: () => receipts.delete(scope),
        });
        const receipt = receipts.get(scope);
        const finish = (transaction) => finishAuthentication(scope, "signIn", options, transaction);
        const target = { operation: "signIn" };
        const recovery = {
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
                    const result = await transaction.write(() => call(auth.signIn.email, values));
                    receipts.set(scope, { kind: "signIn", expected: resultIdentity(result) });
                    return finish(transaction);
                }
                catch (cause) {
                    if (codeOf(cause) !== "EMAIL_NOT_VERIFIED")
                        throw cause;
                    const completion = {
                        outcome: "verificationRequired",
                        email: textValue(values.email),
                    };
                    await transaction.complete(() => options.onVerificationRequired?.(completion));
                    return completion;
                }
            },
        });
        return preserveRecoveryReset({
            ...form,
            feedback: action.feedback(recoveryFeedback(action, target, recovery, receipt !== undefined)),
        }, receipt !== undefined);
    }
    function useSignUpForm(options) {
        const scope = "sign-up";
        const action = useIdentityAction(runtime, scope, "guest", options.enabled !== false, options, {
            onRetire: () => receipts.delete(scope),
        });
        const receipt = receipts.get(scope);
        const finish = (transaction) => finishAuthentication(scope, "signUp", options, transaction);
        const target = { operation: "signUp" };
        const recovery = {
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
                const result = await transaction.write(() => call(auth.signUp.email, {
                    ...values,
                    ...(callbackURL ? { callbackURL } : {}),
                }));
                const expected = resultIdentity(result);
                if (expected.token) {
                    receipts.set(scope, { kind: "signUp", expected });
                    return finish(transaction);
                }
                const completion = {
                    outcome: "verificationRequired",
                    email: textValue(values.email),
                };
                await transaction.complete(() => options.onVerificationRequired?.(completion));
                return completion;
            },
        });
        return preserveRecoveryReset({
            ...form,
            feedback: action.feedback(recoveryFeedback(action, target, recovery, receipt !== undefined)),
        }, receipt !== undefined);
    }
    function usePasswordResetRequestForm(options) {
        const action = useIdentityAction(runtime, "password-reset-request", "settled", options.enabled !== false, options);
        return useWorkflowForm(options, action, {
            operation: "requestPasswordReset",
            minimum: emailMinimum,
            write: async (values, transaction) => {
                await transaction.write(() => call(auth.requestPasswordReset, {
                    ...values,
                    redirectTo: options.redirectTo,
                }));
                const completion = { outcome: "requested", email: textValue(values.email) };
                await transaction.complete(() => options.onRequested?.(completion));
                return completion;
            },
        });
    }
    function usePasswordResetForm(options) {
        const scope = "password-reset";
        const action = useIdentityAction(runtime, scope, "settled", options.enabled !== false, options, { onRetire: () => receipts.delete(scope) });
        const receipt = receipts.get(scope);
        const finish = async (transaction) => {
            const current = receipts.get(scope);
            requireAvailable(current?.kind === "passwordReset");
            if (options.signOutAfterReset !== false && current.stage === "signOut") {
                transaction.phase("cleanup");
                await call(auth.signOut, {});
                current.stage = "synchronization";
            }
            if (options.signOutAfterReset !== false)
                await synchronizeSignedOut(runtime, transaction, current.original);
            receipts.delete(scope);
            const completion = { outcome: "reset" };
            await transaction.complete(() => options.onReset?.(completion));
            return completion;
        };
        const target = { operation: "resetPassword" };
        const recovery = {
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
                await transaction.write(() => call(auth.resetPassword, { ...values, token: options.token }));
                receipts.set(scope, { kind: "passwordReset", stage: "signOut", original });
                return finish(transaction);
            },
        });
        return preserveRecoveryReset({
            ...form,
            feedback: action.feedback(recoveryFeedback(action, target, recovery, receipt !== undefined)),
        }, receipt !== undefined);
    }
    function useEmailVerification(options) {
        const action = useIdentityAction(runtime, "email-verification", "settled", options.enabled !== false, options);
        return useWorkflowForm(options, action, {
            operation: "sendVerificationEmail",
            minimum: emailMinimum,
            write: async (values, transaction) => {
                const callbackURL = textValue(options.callbackURL) || undefined;
                await transaction.write(() => call(auth.sendVerificationEmail, {
                    ...values,
                    ...(callbackURL ? { callbackURL } : {}),
                }));
                const completion = { outcome: "requested", email: textValue(values.email) };
                await transaction.complete(() => options.onRequested?.(completion));
                return completion;
            },
        });
    }
    function useSignOut(options = { initialValues: {} }) {
        const scope = "sign-out";
        const action = useIdentityAction(runtime, scope, "authenticated", options.enabled !== false, options, { onRetire: () => receipts.delete(scope) });
        const receipt = receipts.get(scope);
        const finish = async (transaction) => {
            const current = receipts.get(scope);
            requireAvailable(current?.kind === "signOut");
            await synchronizeSignedOut(runtime, transaction, current.original);
            receipts.delete(scope);
            const completion = { outcome: "signedOut" };
            await transaction.complete(() => options.onSignedOut?.(completion));
            return completion;
        };
        const target = { operation: "signOut" };
        const recovery = {
            ...action.control(target),
            run: () => action.run(target, finish, true),
        };
        const state = {
            ...getActionState(action),
            feedback: action.feedback(recoveryFeedback(action, target, recovery, receipt !== undefined)),
            actions: {
                signOut: {
                    ...action.control(target, receipt ? { code: "recovery" } : null),
                    run: () => action.run(target, async (transaction) => {
                        const original = {
                            userId: runtime.authObservation.userId,
                            sessionId: runtime.authObservation.sessionId,
                        };
                        await transaction.write(() => call(auth.signOut, {}));
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
    const define = (hook, schema) => defineWorkflow((options) => hook({ ...options, schema }));
    return {
        useSignInForm: signIn.useWorkflow,
        SignInForm: signIn.Root,
        useSignInFormContext: signIn.useWorkflowContext,
        defineSignInForm: (schema) => define(useSignInForm, schema),
        useSignUpForm: signUp.useWorkflow,
        SignUpForm: signUp.Root,
        useSignUpFormContext: signUp.useWorkflowContext,
        defineSignUpForm: (schema) => define(useSignUpForm, schema),
        usePasswordResetRequestForm: requestReset.useWorkflow,
        PasswordResetRequestForm: requestReset.Root,
        usePasswordResetRequestFormContext: requestReset.useWorkflowContext,
        definePasswordResetRequestForm: (schema) => define(usePasswordResetRequestForm, schema),
        usePasswordResetForm: reset.useWorkflow,
        PasswordResetForm: reset.Root,
        usePasswordResetFormContext: reset.useWorkflowContext,
        definePasswordResetForm: (schema) => define(usePasswordResetForm, schema),
        useEmailVerification: verification.useWorkflow,
        EmailVerification: verification.Root,
        useEmailVerificationContext: verification.useWorkflowContext,
        defineEmailVerification: (schema) => define(useEmailVerification, schema),
        useSignOut: signOut.useWorkflow,
        SignOut: signOut.Root,
        useSignOutContext: signOut.useWorkflowContext,
    };
}
//# sourceMappingURL=workflows.js.map