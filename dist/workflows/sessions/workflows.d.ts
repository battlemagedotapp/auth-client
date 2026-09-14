import type { ReactNode } from "react";
import type { CacheRuntime } from "../../cache/query-cache.js";
import type { Result } from "../../client/types.js";
type Operation = "revokeSession" | "revokeOtherSessions" | "revokeSessions";
export type SessionReads = {
    useListSessions(query?: undefined, options?: {
        enabled?: boolean;
    }): Result<unknown>;
} & Record<Operation, (body: {
    token?: string;
}, options: {
    throw: true;
    retry: 0;
}) => Promise<unknown>>;
type Options = {
    enabled?: boolean;
    onRevoked?: (result: {
        operation: Operation;
        sessionId?: string;
        result: unknown;
    }) => void | Promise<void>;
};
export declare function createSessionWorkflows(client: SessionReads, runtime: CacheRuntime): {
    useSessions: (options?: Options) => {
        currentSession: {
            id: string;
        } | undefined;
        currentSessionId: string | undefined;
        needsFreshSession: boolean;
        revokeSession: (sessionId: string) => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
        revokeOtherSessions: () => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
        revokeSessions: () => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
        isBusy: boolean;
        pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
        error: import("../shared/types.js").WorkflowError | null;
        reset: () => void;
        queryError: unknown;
        data: unknown;
        isPending: boolean;
        isFetching: boolean;
        refetch(): Promise<import("../../client/types.js").RefetchResult<unknown> | undefined>;
    };
    Sessions: ({ children, ...options }: Options & {
        children: (state: ReturnType<(options?: Options) => {
            currentSession: {
                id: string;
            } | undefined;
            currentSessionId: string | undefined;
            needsFreshSession: boolean;
            revokeSession: (sessionId: string) => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
            revokeOtherSessions: () => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
            revokeSessions: () => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
            isBusy: boolean;
            pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
            error: import("../shared/types.js").WorkflowError | null;
            reset: () => void;
            queryError: unknown;
            data: unknown;
            isPending: boolean;
            isFetching: boolean;
            refetch(): Promise<import("../../client/types.js").RefetchResult<unknown> | undefined>;
        }>) => ReactNode;
    }) => ReactNode;
};
export {};
//# sourceMappingURL=workflows.d.ts.map