import type { CacheRuntime, Identity } from "../cache/query-cache.js";
export declare const runtimeByClient: WeakMap<object, CacheRuntime>;
export declare const AuthDataContext: import("react").Context<{
    runtime: CacheRuntime;
    identity: Identity;
} | null>;
export declare function useClientBoundary(runtime: CacheRuntime): {
    identity: Identity;
    disposed: boolean;
};
//# sourceMappingURL=provider-context.d.ts.map