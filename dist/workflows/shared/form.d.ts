import { type ZodType } from "zod";
import { type ActionExecution, type WorkflowActionController } from "./action.js";
import type { FormFieldErrors, FormFieldIssue } from "./types.js";
import type { WorkflowOperation } from "./types.js";
import type { WorkflowDisabledReason, WorkflowFeedbackOptions } from "./types.js";
type Values = Record<string, unknown>;
export type FormOptions = WorkflowFeedbackOptions & {
    initialValues: Values;
    schema?: ZodType<Values, Values>;
    enabled?: boolean;
    validate?: (values: Readonly<Values>) => FormFieldErrors<Values> | Promise<FormFieldErrors<Values>>;
};
type Execution = {
    operation: WorkflowOperation;
    organizationId?: string;
    minimum: ZodType<Values, Values>;
    write: (values: Values, transaction: ActionExecution) => Promise<unknown>;
    complete?: (result: unknown, transaction: ActionExecution) => Promise<unknown>;
    resetToDraft?: boolean;
    syncDefaults?: boolean;
    blocked?: boolean;
    disabledReason?: WorkflowDisabledReason | null;
    secretFields?: readonly string[];
};
/** RHF is the only owner of editable values and field feedback. */
export declare function useWorkflowForm(options: FormOptions, action: WorkflowActionController, execution: Execution): {
    actions: {
        submit: {
            run: () => Promise<import("./types.js").WorkflowOutcome<unknown>>;
            isDisabled: boolean;
            isPending: boolean;
            disabledReason: WorkflowDisabledReason | null;
        };
    };
    feedback: import("./types.js").WorkflowFeedback[];
    values: Values;
    hasServerChanges: boolean;
    touched: {
        [k: string]: boolean | undefined;
    };
    fieldErrors: Partial<Record<string, FormFieldIssue>>;
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
        error: FormFieldIssue | undefined;
        isDisabled: boolean;
        onChange(value: unknown): void;
        onBlur(): void;
    };
    reset: () => void;
    diagnostics: {
        pendingAction: import("./types.js").WorkflowPendingAction | null;
        error: import("./types.js").WorkflowError | null;
    };
};
export {};
//# sourceMappingURL=form.d.ts.map