import { type ZodType } from "zod";
import type { CacheRuntime } from "../../cache/query-cache.js";
import type { AuthenticationClient } from "../../client/types.js";
import { type Values } from "../shared/action.js";
import { type FormOptions } from "../shared/form.js";
import type { WorkflowFeedback } from "../shared/types.js";
type Options = FormOptions & Record<string, unknown>;
export declare function createAuthenticationWorkflows(auth: AuthenticationClient, runtime: CacheRuntime): {
    useSignInForm: (options: Options) => {
        feedback: WorkflowFeedback[];
        actions: {
            submit: {
                run: () => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
                isDisabled: boolean;
                isPending: boolean;
                disabledReason: import("../shared/types.js").WorkflowDisabledReason | null;
            };
        };
        values: {
            [x: string]: unknown;
        };
        hasServerChanges: boolean;
        touched: {
            [k: string]: boolean | undefined;
        };
        fieldErrors: Partial<Record<string, import("../shared/types.js").FormFieldIssue>>;
        validationError: {
            cause?: unknown;
            code: string;
            message?: string;
        } | null;
        isDirty: boolean;
        isValidating: boolean;
        field: (name: string) => {
            name: string;
            value: unknown;
            error: import("../shared/types.js").FormFieldIssue | undefined;
            isDisabled: boolean;
            onChange(value: unknown): void;
            onBlur(): void;
        };
        reset: () => void;
        diagnostics: {
            pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
            error: import("../shared/types.js").WorkflowError | null;
        };
    };
    SignInForm: (props: import("../shared/types.js").WorkflowFeedbackOptions & {
        initialValues: {
            [x: string]: unknown;
        };
        schema?: ZodType<{
            [x: string]: unknown;
        }, {
            [x: string]: unknown;
        }>;
        enabled?: boolean;
        validate?: (values: Readonly<{
            [x: string]: unknown;
        }>) => import("../shared/types.js").FormFieldErrors<{
            [x: string]: unknown;
        }> | Promise<import("../shared/types.js").FormFieldErrors<{
            [x: string]: unknown;
        }>>;
    } & Record<string, unknown> & {
        children?: import("react").ReactNode;
    }) => import("react").ReactNode;
    useSignInFormContext: () => {
        feedback: WorkflowFeedback[];
        actions: {
            submit: {
                run: () => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
                isDisabled: boolean;
                isPending: boolean;
                disabledReason: import("../shared/types.js").WorkflowDisabledReason | null;
            };
        };
        values: {
            [x: string]: unknown;
        };
        hasServerChanges: boolean;
        touched: {
            [k: string]: boolean | undefined;
        };
        fieldErrors: Partial<Record<string, import("../shared/types.js").FormFieldIssue>>;
        validationError: {
            cause?: unknown;
            code: string;
            message?: string;
        } | null;
        isDirty: boolean;
        isValidating: boolean;
        field: (name: string) => {
            name: string;
            value: unknown;
            error: import("../shared/types.js").FormFieldIssue | undefined;
            isDisabled: boolean;
            onChange(value: unknown): void;
            onBlur(): void;
        };
        reset: () => void;
        diagnostics: {
            pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
            error: import("../shared/types.js").WorkflowError | null;
        };
    };
    defineSignInForm: (schema: ZodType<Values, Values>) => import("../shared/root.js").WorkflowDefinition<Options, unknown>;
    useSignUpForm: (options: Options) => {
        feedback: WorkflowFeedback[];
        actions: {
            submit: {
                run: () => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
                isDisabled: boolean;
                isPending: boolean;
                disabledReason: import("../shared/types.js").WorkflowDisabledReason | null;
            };
        };
        values: {
            [x: string]: unknown;
        };
        hasServerChanges: boolean;
        touched: {
            [k: string]: boolean | undefined;
        };
        fieldErrors: Partial<Record<string, import("../shared/types.js").FormFieldIssue>>;
        validationError: {
            cause?: unknown;
            code: string;
            message?: string;
        } | null;
        isDirty: boolean;
        isValidating: boolean;
        field: (name: string) => {
            name: string;
            value: unknown;
            error: import("../shared/types.js").FormFieldIssue | undefined;
            isDisabled: boolean;
            onChange(value: unknown): void;
            onBlur(): void;
        };
        reset: () => void;
        diagnostics: {
            pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
            error: import("../shared/types.js").WorkflowError | null;
        };
    };
    SignUpForm: (props: import("../shared/types.js").WorkflowFeedbackOptions & {
        initialValues: {
            [x: string]: unknown;
        };
        schema?: ZodType<{
            [x: string]: unknown;
        }, {
            [x: string]: unknown;
        }>;
        enabled?: boolean;
        validate?: (values: Readonly<{
            [x: string]: unknown;
        }>) => import("../shared/types.js").FormFieldErrors<{
            [x: string]: unknown;
        }> | Promise<import("../shared/types.js").FormFieldErrors<{
            [x: string]: unknown;
        }>>;
    } & Record<string, unknown> & {
        children?: import("react").ReactNode;
    }) => import("react").ReactNode;
    useSignUpFormContext: () => {
        feedback: WorkflowFeedback[];
        actions: {
            submit: {
                run: () => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
                isDisabled: boolean;
                isPending: boolean;
                disabledReason: import("../shared/types.js").WorkflowDisabledReason | null;
            };
        };
        values: {
            [x: string]: unknown;
        };
        hasServerChanges: boolean;
        touched: {
            [k: string]: boolean | undefined;
        };
        fieldErrors: Partial<Record<string, import("../shared/types.js").FormFieldIssue>>;
        validationError: {
            cause?: unknown;
            code: string;
            message?: string;
        } | null;
        isDirty: boolean;
        isValidating: boolean;
        field: (name: string) => {
            name: string;
            value: unknown;
            error: import("../shared/types.js").FormFieldIssue | undefined;
            isDisabled: boolean;
            onChange(value: unknown): void;
            onBlur(): void;
        };
        reset: () => void;
        diagnostics: {
            pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
            error: import("../shared/types.js").WorkflowError | null;
        };
    };
    defineSignUpForm: (schema: ZodType<Values, Values>) => import("../shared/root.js").WorkflowDefinition<Options, unknown>;
    usePasswordResetRequestForm: (options: Options) => {
        actions: {
            submit: {
                run: () => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
                isDisabled: boolean;
                isPending: boolean;
                disabledReason: import("../shared/types.js").WorkflowDisabledReason | null;
            };
        };
        feedback: WorkflowFeedback[];
        values: {
            [x: string]: unknown;
        };
        hasServerChanges: boolean;
        touched: {
            [k: string]: boolean | undefined;
        };
        fieldErrors: Partial<Record<string, import("../shared/types.js").FormFieldIssue>>;
        validationError: {
            cause?: unknown;
            code: string;
            message?: string;
        } | null;
        isDirty: boolean;
        isValidating: boolean;
        field: (name: string) => {
            name: string;
            value: unknown;
            error: import("../shared/types.js").FormFieldIssue | undefined;
            isDisabled: boolean;
            onChange(value: unknown): void;
            onBlur(): void;
        };
        reset: () => void;
        diagnostics: {
            pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
            error: import("../shared/types.js").WorkflowError | null;
        };
    };
    PasswordResetRequestForm: (props: import("../shared/types.js").WorkflowFeedbackOptions & {
        initialValues: {
            [x: string]: unknown;
        };
        schema?: ZodType<{
            [x: string]: unknown;
        }, {
            [x: string]: unknown;
        }>;
        enabled?: boolean;
        validate?: (values: Readonly<{
            [x: string]: unknown;
        }>) => import("../shared/types.js").FormFieldErrors<{
            [x: string]: unknown;
        }> | Promise<import("../shared/types.js").FormFieldErrors<{
            [x: string]: unknown;
        }>>;
    } & Record<string, unknown> & {
        children?: import("react").ReactNode;
    }) => import("react").ReactNode;
    usePasswordResetRequestFormContext: () => {
        actions: {
            submit: {
                run: () => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
                isDisabled: boolean;
                isPending: boolean;
                disabledReason: import("../shared/types.js").WorkflowDisabledReason | null;
            };
        };
        feedback: WorkflowFeedback[];
        values: {
            [x: string]: unknown;
        };
        hasServerChanges: boolean;
        touched: {
            [k: string]: boolean | undefined;
        };
        fieldErrors: Partial<Record<string, import("../shared/types.js").FormFieldIssue>>;
        validationError: {
            cause?: unknown;
            code: string;
            message?: string;
        } | null;
        isDirty: boolean;
        isValidating: boolean;
        field: (name: string) => {
            name: string;
            value: unknown;
            error: import("../shared/types.js").FormFieldIssue | undefined;
            isDisabled: boolean;
            onChange(value: unknown): void;
            onBlur(): void;
        };
        reset: () => void;
        diagnostics: {
            pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
            error: import("../shared/types.js").WorkflowError | null;
        };
    };
    definePasswordResetRequestForm: (schema: ZodType<Values, Values>) => import("../shared/root.js").WorkflowDefinition<Options, unknown>;
    usePasswordResetForm: (options: Options) => {
        feedback: WorkflowFeedback[];
        actions: {
            submit: {
                run: () => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
                isDisabled: boolean;
                isPending: boolean;
                disabledReason: import("../shared/types.js").WorkflowDisabledReason | null;
            };
        };
        values: {
            [x: string]: unknown;
        };
        hasServerChanges: boolean;
        touched: {
            [k: string]: boolean | undefined;
        };
        fieldErrors: Partial<Record<string, import("../shared/types.js").FormFieldIssue>>;
        validationError: {
            cause?: unknown;
            code: string;
            message?: string;
        } | null;
        isDirty: boolean;
        isValidating: boolean;
        field: (name: string) => {
            name: string;
            value: unknown;
            error: import("../shared/types.js").FormFieldIssue | undefined;
            isDisabled: boolean;
            onChange(value: unknown): void;
            onBlur(): void;
        };
        reset: () => void;
        diagnostics: {
            pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
            error: import("../shared/types.js").WorkflowError | null;
        };
    };
    PasswordResetForm: (props: import("../shared/types.js").WorkflowFeedbackOptions & {
        initialValues: {
            [x: string]: unknown;
        };
        schema?: ZodType<{
            [x: string]: unknown;
        }, {
            [x: string]: unknown;
        }>;
        enabled?: boolean;
        validate?: (values: Readonly<{
            [x: string]: unknown;
        }>) => import("../shared/types.js").FormFieldErrors<{
            [x: string]: unknown;
        }> | Promise<import("../shared/types.js").FormFieldErrors<{
            [x: string]: unknown;
        }>>;
    } & Record<string, unknown> & {
        children?: import("react").ReactNode;
    }) => import("react").ReactNode;
    usePasswordResetFormContext: () => {
        feedback: WorkflowFeedback[];
        actions: {
            submit: {
                run: () => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
                isDisabled: boolean;
                isPending: boolean;
                disabledReason: import("../shared/types.js").WorkflowDisabledReason | null;
            };
        };
        values: {
            [x: string]: unknown;
        };
        hasServerChanges: boolean;
        touched: {
            [k: string]: boolean | undefined;
        };
        fieldErrors: Partial<Record<string, import("../shared/types.js").FormFieldIssue>>;
        validationError: {
            cause?: unknown;
            code: string;
            message?: string;
        } | null;
        isDirty: boolean;
        isValidating: boolean;
        field: (name: string) => {
            name: string;
            value: unknown;
            error: import("../shared/types.js").FormFieldIssue | undefined;
            isDisabled: boolean;
            onChange(value: unknown): void;
            onBlur(): void;
        };
        reset: () => void;
        diagnostics: {
            pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
            error: import("../shared/types.js").WorkflowError | null;
        };
    };
    definePasswordResetForm: (schema: ZodType<Values, Values>) => import("../shared/root.js").WorkflowDefinition<Options, unknown>;
    useEmailVerification: (options: Options) => {
        actions: {
            submit: {
                run: () => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
                isDisabled: boolean;
                isPending: boolean;
                disabledReason: import("../shared/types.js").WorkflowDisabledReason | null;
            };
        };
        feedback: WorkflowFeedback[];
        values: {
            [x: string]: unknown;
        };
        hasServerChanges: boolean;
        touched: {
            [k: string]: boolean | undefined;
        };
        fieldErrors: Partial<Record<string, import("../shared/types.js").FormFieldIssue>>;
        validationError: {
            cause?: unknown;
            code: string;
            message?: string;
        } | null;
        isDirty: boolean;
        isValidating: boolean;
        field: (name: string) => {
            name: string;
            value: unknown;
            error: import("../shared/types.js").FormFieldIssue | undefined;
            isDisabled: boolean;
            onChange(value: unknown): void;
            onBlur(): void;
        };
        reset: () => void;
        diagnostics: {
            pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
            error: import("../shared/types.js").WorkflowError | null;
        };
    };
    EmailVerification: (props: import("../shared/types.js").WorkflowFeedbackOptions & {
        initialValues: {
            [x: string]: unknown;
        };
        schema?: ZodType<{
            [x: string]: unknown;
        }, {
            [x: string]: unknown;
        }>;
        enabled?: boolean;
        validate?: (values: Readonly<{
            [x: string]: unknown;
        }>) => import("../shared/types.js").FormFieldErrors<{
            [x: string]: unknown;
        }> | Promise<import("../shared/types.js").FormFieldErrors<{
            [x: string]: unknown;
        }>>;
    } & Record<string, unknown> & {
        children?: import("react").ReactNode;
    }) => import("react").ReactNode;
    useEmailVerificationContext: () => {
        actions: {
            submit: {
                run: () => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
                isDisabled: boolean;
                isPending: boolean;
                disabledReason: import("../shared/types.js").WorkflowDisabledReason | null;
            };
        };
        feedback: WorkflowFeedback[];
        values: {
            [x: string]: unknown;
        };
        hasServerChanges: boolean;
        touched: {
            [k: string]: boolean | undefined;
        };
        fieldErrors: Partial<Record<string, import("../shared/types.js").FormFieldIssue>>;
        validationError: {
            cause?: unknown;
            code: string;
            message?: string;
        } | null;
        isDirty: boolean;
        isValidating: boolean;
        field: (name: string) => {
            name: string;
            value: unknown;
            error: import("../shared/types.js").FormFieldIssue | undefined;
            isDisabled: boolean;
            onChange(value: unknown): void;
            onBlur(): void;
        };
        reset: () => void;
        diagnostics: {
            pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
            error: import("../shared/types.js").WorkflowError | null;
        };
    };
    defineEmailVerification: (schema: ZodType<Values, Values>) => import("../shared/root.js").WorkflowDefinition<Options, unknown>;
    useSignOut: (options: Options | undefined) => {
        feedback: WorkflowFeedback[];
        actions: {
            signOut: {
                run: () => Promise<import("../shared/types.js").WorkflowOutcome<{
                    outcome: "signedOut";
                }>>;
                isDisabled: boolean;
                isPending: boolean;
                disabledReason: import("../shared/types.js").WorkflowDisabledReason | null;
            };
        };
        diagnostics: {
            pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
            error: import("../shared/types.js").WorkflowError | null;
        };
        reset: () => void;
    };
    SignOut: (props: import("../shared/types.js").WorkflowFeedbackOptions & {
        initialValues: {
            [x: string]: unknown;
        };
        schema?: ZodType<{
            [x: string]: unknown;
        }, {
            [x: string]: unknown;
        }>;
        enabled?: boolean;
        validate?: (values: Readonly<{
            [x: string]: unknown;
        }>) => import("../shared/types.js").FormFieldErrors<{
            [x: string]: unknown;
        }> | Promise<import("../shared/types.js").FormFieldErrors<{
            [x: string]: unknown;
        }>>;
    } & Record<string, unknown> & {
        children?: import("react").ReactNode;
    }) => import("react").ReactNode;
    useSignOutContext: () => {
        feedback: WorkflowFeedback[];
        actions: {
            signOut: {
                run: () => Promise<import("../shared/types.js").WorkflowOutcome<{
                    outcome: "signedOut";
                }>>;
                isDisabled: boolean;
                isPending: boolean;
                disabledReason: import("../shared/types.js").WorkflowDisabledReason | null;
            };
        };
        diagnostics: {
            pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
            error: import("../shared/types.js").WorkflowError | null;
        };
        reset: () => void;
    };
};
export {};
//# sourceMappingURL=workflows.d.ts.map