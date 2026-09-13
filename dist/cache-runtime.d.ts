import { QueryClient, type QueryKey } from "@tanstack/react-query";
import type { ConvexReactClient } from "convex/react";
import type { SessionClient, InvalidationApi, Features, ResourceDependency } from "./types.js";
export type Identity = {
    userId?: string;
    sessionId?: string;
    ready: boolean;
};
export declare class CacheRuntime {
    readonly auth: SessionClient;
    readonly api: InvalidationApi;
    readonly features: Features;
    readonly cache: QueryClient;
    convex?: ConvexReactClient;
    disposed: boolean;
    private listeners;
    subscribe: (listener: () => void) => () => void;
    getDisposed: () => boolean;
    identity: string;
    generation: number;
    attached: number;
    timers: Set<number>;
    private deadlines;
    observeExpiry(key: QueryKey, expiry: number): () => void;
    userId?: string;
    signalErrors: Map<string, unknown>;
    pending: Map<string, readonly unknown[]>;
    scheduled?: Promise<void>;
    private scheduledKeys?;
    inFlight: Map<Promise<void>, Set<string>>;
    invalidate(keys: readonly QueryKey[]): Promise<void>;
    refreshResource(key: QueryKey): Promise<{
        data: unknown;
        error: null;
    }>;
    watches: Map<string, {
        stop: () => void;
        listeners: Set<(error: unknown, denied: boolean) => void>;
        read: (listener?: (error: unknown, denied: boolean) => void) => void;
    }>;
    constructor(auth: SessionClient, api: InvalidationApi, features: Features);
    attach(convex: ConvexReactClient): () => void;
    setIdentity(identity: Identity): void;
    watch(deps: ResourceDependency[], listener: (error: unknown, denied: boolean) => void): () => void;
    refresh(): Promise<void>;
    dispose(): void;
}
//# sourceMappingURL=cache-runtime.d.ts.map