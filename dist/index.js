import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useLayoutEffect, useState, useMemo, useSyncExternalStore, } from "react";
import { useQuery, hashKey } from "@tanstack/react-query";
import { useConvex, useConvexAuth } from "convex/react";
import { dependencies, nextExpiry } from "./dependencies.js";
import { CacheRuntime } from "./cache-runtime.js";
const Context = createContext(null);
const runtimes = new WeakMap();
export function AuthDataProvider({ client, children, }) {
    const runtime = runtimes.get(client);
    if (!runtime)
        throw new Error("Invalid auth data client");
    const convex = useConvex();
    const auth = useConvexAuth();
    const session = runtime.auth.useSession();
    const userId = session.data?.user.id;
    const sessionId = session.data?.session.id;
    const ready = auth.isAuthenticated && !session.isPending && Boolean(session.data);
    const identity = useMemo(() => ({ userId, sessionId, ready }), [userId, sessionId, ready]);
    useLayoutEffect(() => runtime.attach(convex), [runtime, convex]);
    useLayoutEffect(() => runtime.setIdentity(identity), [runtime, identity]);
    return _jsx(Context.Provider, { value: { runtime, identity }, children: children });
}
function useResource(runtime, endpoint, fn, query = {}, options = {}) {
    const context = useContext(Context);
    if (!context || context.runtime !== runtime)
        throw new Error("Matching AuthDataProvider is required");
    const { identity } = context;
    const enabled = options.enabled !== false;
    if (enabled)
        validateScope(endpoint, query);
    const disposed = useSyncExternalStore(runtime.subscribe, runtime.getDisposed);
    const ready = enabled && identity.ready && !disposed;
    const keyString = hashKey(["auth", identity.userId, identity.sessionId, endpoint, query]);
    // Subscription effects use TanStack's value equality rather than the caller's
    // object identity. The original query object still goes to Better Auth.
    const key = useMemo(() => JSON.parse(keyString), [keyString]);
    const [sync, setSync] = useState({
        key: "",
        error: null,
        denied: false,
    });
    const result = useQuery({
        queryKey: key,
        enabled: ready,
        queryFn: async ({ signal }) => {
            if (runtime.disposed)
                throw new Error("Adapter is disposed");
            const generation = runtime.generation;
            const data = await fn({
                query,
                fetchOptions: { signal, throw: true, disableSignal: true },
            });
            if (signal.aborted || generation !== runtime.generation)
                throw new Error("Obsolete auth response");
            return data;
        },
    }, runtime.cache);
    const depKey = hashKey(dependencies(endpoint, query, result.data, identity.userId ?? ""));
    const deps = useMemo(() => JSON.parse(depKey), [depKey]);
    useEffect(() => {
        if (!ready)
            return;
        const stops = [];
        const states = new Map();
        let active = true;
        for (let i = 0; i < deps.length; i += 100)
            stops.push(runtime.watch(deps.slice(i, i + 100), (error, denied) => {
                if (!active)
                    return;
                states.set(i, { error, denied });
                const all = [...states.values()];
                setSync({
                    key: keyString,
                    error: all.find((state) => state.error != null)?.error ?? null,
                    denied: all.some((state) => state.denied),
                });
                if (error)
                    return;
                void runtime.invalidate([key]).catch(() => { });
            }));
        return () => {
            active = false;
            stops.forEach((stop) => stop());
        };
    }, [runtime, ready, keyString, key, deps]);
    useEffect(() => {
        const expiry = nextExpiry(result.data, Date.now());
        if (!ready || expiry === undefined)
            return;
        return runtime.observeExpiry(key, expiry);
    }, [runtime, ready, result.data, key]);
    const error = result.error ?? (sync.key === keyString ? sync.error : null);
    const denied = (sync.key === keyString && (sync.denied || sync.error != null)) ||
        isProtectedReadFailure(error);
    return {
        data: ready && !denied ? result.data : undefined,
        error,
        isPending: enabled && !disposed && (!identity.ready || result.isPending),
        isFetching: ready && result.isFetching,
        refetch: async () => {
            if (ready && !runtime.disposed) {
                const generation = runtime.generation;
                for (let i = 0; i < deps.length; i += 100)
                    runtime.watches.get(hashKey(deps.slice(i, i + 100)))?.read();
                const refreshed = await runtime.refreshResource(key);
                if (runtime.disposed || generation !== runtime.generation)
                    return;
                return { data: refreshed.data, error: refreshed.error };
            }
        },
    };
}
// Better Auth uses 400 for invalid/expired invitations and a removed inviter.
// These responses must not leave an earlier successful private result visible.
function isProtectedReadFailure(error) {
    const status = error?.status;
    return status !== undefined && status >= 400 && status < 500 && status !== 429;
}
function validateScope(endpoint, query) {
    const id = typeof query.organizationId === "string" && query.organizationId.length > 0;
    const slug = typeof query.organizationSlug === "string" && query.organizationSlug.length > 0;
    if ((endpoint === "listMembers" || endpoint === "listInvitations") && !id)
        throw new Error(`${endpoint} requires an explicit organizationId`);
    if ((endpoint === "getFullOrganization" || endpoint === "getActiveMemberRole") && !id && !slug)
        throw new Error(`${endpoint} requires an explicit organizationId or organizationSlug`);
    if (endpoint === "getInvitation" && (typeof query.id !== "string" || !query.id))
        throw new Error("getInvitation requires an explicit id");
}
export function createAuthDataClient(config) {
    const runtime = new CacheRuntime(config.authClient, config.api, Object.freeze({ ...config.features }));
    const client = {
        refresh: () => runtime.refresh(),
        dispose: () => runtime.dispose(),
    };
    const auth = config.authClient;
    function write(fn, endpoints) {
        return async (...args) => {
            if (runtime.disposed)
                throw new Error("Adapter is disposed");
            const generation = runtime.generation;
            const result = await fn(...args);
            if (!runtime.disposed && generation === runtime.generation && !hasMutationError(result))
                void runtime
                    .invalidate(runtime.cache
                    .getQueryCache()
                    .getAll()
                    .filter((query) => endpoints.includes(String(query.queryKey[3])))
                    .map((query) => query.queryKey))
                    .catch(() => { });
            return result;
        };
    }
    if (config.features.organization) {
        const hooks = {
            useListOrganizations: "list",
            useOrganization: "getFullOrganization",
            useListMembers: "listMembers",
            useMemberRole: "getActiveMemberRole",
            useListInvitations: "listInvitations",
            useListUserInvitations: "listUserInvitations",
            useInvitation: "getInvitation",
        };
        for (const [hook, method] of Object.entries(hooks))
            client[hook] = (query, options) => useResource(runtime, method, auth.organization[method], query, options);
        const mutations = {};
        client.organization = mutations;
        for (const method of [
            "create",
            "update",
            "delete",
            "leave",
            "inviteMember",
            "cancelInvitation",
            "acceptInvitation",
            "rejectInvitation",
            "removeMember",
            "updateMemberRole",
        ])
            mutations[method] = write(auth.organization[method], Object.values(hooks));
    }
    if (config.features.sessions) {
        client.useListSessions = (query, options) => useResource(runtime, "listSessions", auth.listSessions, query, options);
        for (const method of ["revokeSession", "revokeOtherSessions", "revokeSessions"])
            client[method] = write(auth[method], ["listSessions"]);
    }
    runtimes.set(client, runtime);
    // Only the explicitly selected capabilities are assembled above. TypeScript
    // cannot narrow generic F from runtime booleans; retain C's exact signatures.
    return client;
}
function hasMutationError(result) {
    return (typeof result === "object" && result !== null && "error" in result && Boolean(result.error));
}
//# sourceMappingURL=index.js.map