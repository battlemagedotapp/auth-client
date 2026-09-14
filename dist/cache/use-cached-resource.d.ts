import type { Endpoint } from "../client/types.js";
import type { CacheRuntime } from "./query-cache.js";
export declare function useCachedResource(runtime: CacheRuntime, endpoint: string, fn: Endpoint, query?: Record<string, unknown>, options?: {
    enabled?: boolean;
}): {
    data: unknown;
    error: unknown;
    isPending: boolean;
    isFetching: boolean;
    refetch: () => Promise<{
        data: unknown;
        error: null;
    } | undefined>;
};
//# sourceMappingURL=use-cached-resource.d.ts.map