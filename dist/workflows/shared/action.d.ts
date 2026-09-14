import type { CacheRuntime } from "../../cache/query-cache.js";
import type { WorkflowError, WorkflowOutcome, WorkflowPendingAction, PolicyDecision } from "./types.js";
export type Values = Record<string, unknown>;
export declare const asRecord: (value: unknown) => Values | undefined;
export declare const asRecords: (value: unknown) => Values[];
export declare const ignored: (reason: "disabled" | "busy" | "obsolete" | "unavailable") => WorkflowOutcome<never>;
export declare function requireAvailable(condition: unknown): asserts condition;
export declare function enforcePolicy(decision: PolicyDecision): void;
export declare const allowed: PolicyDecision;
export declare const denied: (code: string) => PolicyDecision;
export declare function useCommittedRef<T>(value: T): import("react").RefObject<T>;
export declare function getActionState(action: ReturnType<typeof useWorkflowAction>): {
    isBusy: boolean;
    pendingAction: WorkflowPendingAction | null;
    error: WorkflowError | null;
    reset: () => void;
};
export type ActionExecution = {
    write(fn: () => Promise<unknown>, target?: string | Partial<WorkflowPendingAction>): Promise<unknown>;
    current(): boolean;
    phase(phase: WorkflowError["phase"]): void;
    signal: AbortSignal;
};
/** TanStack observes writes; this coordinator owns only locks and guarded continuations. */
export declare function useWorkflowAction(runtime: CacheRuntime, scope: string, enabled?: boolean): {
    owner: symbol;
    actorId: string | undefined;
    available: boolean;
    current: () => boolean;
    busy: () => boolean;
    canEdit: () => boolean;
    run: <T>(pending: WorkflowPendingAction, work: (transaction: ActionExecution) => Promise<T>, alreadyWritten?: boolean) => Promise<WorkflowOutcome<T>>;
    reset: () => void;
    isBusy: boolean;
    pendingAction: WorkflowPendingAction | null;
    error: WorkflowError | null;
};
//# sourceMappingURL=action.d.ts.map