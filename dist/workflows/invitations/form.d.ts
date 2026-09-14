import { type FormOptions as BaseOptions } from "../shared/form.js";
import { type useWorkflowAction, type Values } from "../shared/action.js";
export type FormOptions = BaseOptions & {
    organizationId: string;
    mode?: "invite" | "resend";
    onInvited?: (result: unknown) => void | Promise<void>;
};
export declare function useInvitationFormState(options: FormOptions, action: ReturnType<typeof useWorkflowAction>, write: (values: Values) => Promise<unknown>, invitationId: (values: Values) => string | undefined): {
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
        value: unknown;
        error: import("../shared/types.js").FormFieldIssue | undefined;
        isDisabled: boolean;
        onChange(value: unknown): void;
        onBlur(): void;
    };
    submit: () => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
    reset: () => void;
    isBusy: boolean;
    pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
    error: import("../shared/types.js").WorkflowError | null;
};
//# sourceMappingURL=form.d.ts.map