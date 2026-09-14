import type { CacheRuntime } from "../../cache/query-cache.js";
import type { WorkflowPendingAction } from "./types.js";
export declare function workflowLocks(runtime: CacheRuntime): {
    subscribe(this: void, listener: () => void): () => void;
    getSnapshot: () => number;
    conflicts: (action: WorkflowPendingAction, generation: number) => boolean;
    acquire(action: WorkflowPendingAction, generation: number): {
        extend(next: WorkflowPendingAction): boolean;
        release(): void;
    } | null;
};
//# sourceMappingURL=locks.d.ts.map