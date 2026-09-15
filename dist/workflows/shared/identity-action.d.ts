import type { CacheRuntime } from "../../cache/query-cache.js";
import { type WorkflowActionController } from "./action.js";
import type { WorkflowFeedbackOptions } from "./types.js";
type Availability = "guest" | "authenticated" | "settled";
/** Coordinates operations whose successful result intentionally changes session identity. */
export declare function useIdentityAction(runtime: CacheRuntime, scope: string, availability: Availability, enabled?: boolean, options?: WorkflowFeedbackOptions, lifecycleOptions?: {
    onRetire?: () => void;
}): WorkflowActionController;
export {};
//# sourceMappingURL=identity-action.d.ts.map