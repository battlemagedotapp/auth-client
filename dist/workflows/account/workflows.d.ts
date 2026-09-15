import { type ZodType } from "zod";
import type { CacheRuntime } from "../../cache/query-cache.js";
import type { AccountClient } from "../../client/types.js";
import { type Values } from "../shared/action.js";
import { type FormOptions } from "../shared/form.js";
import type { WorkflowAction, WorkflowFeedback } from "../shared/types.js";
import type { CurrentUserBinding } from "./types.js";
type Options = FormOptions & Record<string, unknown>;
export declare function createAccountWorkflows<U extends {
    email: string;
}>(auth: AccountClient, runtime: CacheRuntime, currentUser: CurrentUserBinding<U>): {
    useProfileSettings: (options: Options) => {
        user: U | undefined;
        isPending: boolean;
        queryError: unknown;
        form: {
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
        } | null;
        actions: {
            update: WorkflowAction<[Values], unknown>;
            updateImage: WorkflowAction<[string | null], unknown>;
        };
        feedback: WorkflowFeedback[];
        diagnostics: {
            pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
            error: import("../shared/types.js").WorkflowError | null;
        };
        reset: () => void;
    };
    ProfileSettings: (props: import("../shared/types.js").WorkflowFeedbackOptions & {
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
    useProfileSettingsContext: () => {
        user: U | undefined;
        isPending: boolean;
        queryError: unknown;
        form: {
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
        } | null;
        actions: {
            update: WorkflowAction<[Values], unknown>;
            updateImage: WorkflowAction<[string | null], unknown>;
        };
        feedback: WorkflowFeedback[];
        diagnostics: {
            pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
            error: import("../shared/types.js").WorkflowError | null;
        };
        reset: () => void;
    };
    defineProfileSettings: (schema: ZodType<Values, Values>) => import("../shared/root.js").WorkflowDefinition<Options, unknown>;
    useEmailChangeForm: (options: Options) => {
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
    EmailChangeForm: (props: import("../shared/types.js").WorkflowFeedbackOptions & {
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
    useEmailChangeFormContext: () => {
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
    defineEmailChangeForm: (schema: ZodType<Values, Values>) => import("../shared/root.js").WorkflowDefinition<Options, unknown>;
    usePasswordChangeForm: (options: Options) => {
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
    PasswordChangeForm: (props: import("../shared/types.js").WorkflowFeedbackOptions & {
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
    usePasswordChangeFormContext: () => {
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
    definePasswordChangeForm: (schema: ZodType<Values, Values>) => import("../shared/root.js").WorkflowDefinition<Options, unknown>;
    useReauthenticationForm: (options: Options | undefined) => {
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
    ReauthenticationForm: (props: import("../shared/types.js").WorkflowFeedbackOptions & {
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
    useReauthenticationFormContext: () => {
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
    defineReauthenticationForm: (schema: ZodType<Values, Values>) => import("../shared/root.js").WorkflowDefinition<Options, unknown>;
};
export {};
//# sourceMappingURL=workflows.d.ts.map