import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useQuery, hashKey, type QueryKey } from "@tanstack/react-query";
import { useConvex, useConvexAuth } from "convex/react";
import type {
  Features,
  SessionClient,
  OrganizationClient,
  SessionsClient,
  AuthDataClient,
  AuthDataLifecycle,
  InvalidationApi,
  Endpoint,
  ResourceDependency,
} from "./types.js";
import { dependencies, nextExpiry } from "./dependencies.js";
export type * from "./types.js";
import { CacheRuntime, type Identity } from "./cache-runtime.js";
const Context = createContext<{ runtime: CacheRuntime; identity: Identity } | null>(null);
const runtimes = new WeakMap<object, CacheRuntime>();
export function AuthDataProvider({
  client,
  children,
}: {
  client: AuthDataLifecycle;
  children: ReactNode;
}) {
  const runtime = runtimes.get(client);
  if (!runtime) throw new Error("Invalid auth data client");
  const convex = useConvex();
  const auth = useConvexAuth();
  const session = runtime.auth.useSession();
  const userId = session.data?.user.id;
  const sessionId = session.data?.session.id;
  const ready = auth.isAuthenticated && !session.isPending && Boolean(session.data);
  const identity = useMemo(() => ({ userId, sessionId, ready }), [userId, sessionId, ready]);
  useLayoutEffect(() => runtime.attach(convex), [runtime, convex]);
  useLayoutEffect(() => runtime.setIdentity(identity), [runtime, identity]);
  return <Context.Provider value={{ runtime, identity }}>{children}</Context.Provider>;
}
function useResource(
  runtime: CacheRuntime,
  endpoint: string,
  fn: Endpoint,
  query: Record<string, unknown> = {},
  options: { enabled?: boolean } = {},
) {
  const context = useContext(Context);
  if (!context || context.runtime !== runtime)
    throw new Error("Matching AuthDataProvider is required");
  const { identity } = context;
  const enabled = options.enabled !== false;
  if (enabled) validateScope(endpoint, query);
  const disposed = useSyncExternalStore(runtime.subscribe, runtime.getDisposed);
  const ready = enabled && identity.ready && !disposed;
  const keyString = hashKey(["auth", identity.userId, identity.sessionId, endpoint, query]);
  // Subscription effects use TanStack's value equality rather than the caller's
  // object identity. The original query object still goes to Better Auth.
  const key = useMemo<QueryKey>(() => JSON.parse(keyString), [keyString]);
  const [sync, setSync] = useState<{ key: string; error: unknown; denied: boolean }>({
    key: "",
    error: null,
    denied: false,
  });
  const result = useQuery(
    {
      queryKey: key,
      enabled: ready,
      queryFn: async ({ signal }) => {
        if (runtime.disposed) throw new Error("Adapter is disposed");
        const generation = runtime.generation;
        const data = await fn({
          query,
          fetchOptions: { signal, throw: true, disableSignal: true },
        });
        if (signal.aborted || generation !== runtime.generation)
          throw new Error("Obsolete auth response");
        return data;
      },
    },
    runtime.cache,
  );
  const depKey = hashKey(dependencies(endpoint, query, result.data, identity.userId ?? ""));
  const deps = useMemo<ResourceDependency[]>(() => JSON.parse(depKey), [depKey]);
  useEffect(() => {
    if (!ready) return;
    const stops: Array<() => void> = [];
    const states = new Map<number, { error: unknown; denied: boolean }>();
    let active = true;
    for (let i = 0; i < deps.length; i += 100)
      stops.push(
        runtime.watch(deps.slice(i, i + 100), (error, denied) => {
          if (!active) return;
          states.set(i, { error, denied });
          const all = [...states.values()];
          setSync({
            key: keyString,
            error: all.find((state) => state.error != null)?.error ?? null,
            denied: all.some((state) => state.denied),
          });
          if (error) return;
          void runtime.invalidate([key]).catch(() => {});
        }),
      );
    return () => {
      active = false;
      stops.forEach((stop) => stop());
    };
  }, [runtime, ready, keyString, key, deps]);
  useEffect(() => {
    const expiry = nextExpiry(result.data, Date.now());
    if (!ready || expiry === undefined) return;
    return runtime.observeExpiry(key, expiry);
  }, [runtime, ready, result.data, key]);
  const error = result.error ?? (sync.key === keyString ? sync.error : null);
  const denied =
    (sync.key === keyString && (sync.denied || sync.error != null)) ||
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
        if (runtime.disposed || generation !== runtime.generation) return;
        return { data: refreshed.data, error: refreshed.error };
      }
    },
  };
}
// Better Auth uses 400 for invalid/expired invitations and a removed inviter.
// These responses must not leave an earlier successful private result visible.
function isProtectedReadFailure(error: unknown) {
  const status = (error as { status?: number } | null)?.status;
  return status !== undefined && status >= 400 && status < 500 && status !== 429;
}
function validateScope(endpoint: string, query: Record<string, unknown>) {
  const id = typeof query.organizationId === "string" && query.organizationId.length > 0;
  const slug = typeof query.organizationSlug === "string" && query.organizationSlug.length > 0;
  if ((endpoint === "listMembers" || endpoint === "listInvitations") && !id)
    throw new Error(`${endpoint} requires an explicit organizationId`);
  if ((endpoint === "getFullOrganization" || endpoint === "getActiveMemberRole") && !id && !slug)
    throw new Error(`${endpoint} requires an explicit organizationId or organizationSlug`);
  if (endpoint === "getInvitation" && (typeof query.id !== "string" || !query.id))
    throw new Error("getInvitation requires an explicit id");
}
export function createAuthDataClient<C extends SessionClient, F extends Features>(config: {
  authClient: C &
    (F extends { organization: true } ? OrganizationClient : unknown) &
    (F extends { sessions: true } ? SessionsClient : unknown);
  api: InvalidationApi;
  features: F;
}): AuthDataClient<C, F> {
  const runtime = new CacheRuntime(
    config.authClient,
    config.api,
    Object.freeze({ ...config.features }),
  );
  const client: Record<string, unknown> = {
    refresh: () => runtime.refresh(),
    dispose: () => runtime.dispose(),
  };
  const auth = config.authClient as C & OrganizationClient & SessionsClient;
  function write(fn: Endpoint, endpoints: readonly string[]) {
    return async (...args: unknown[]) => {
      if (runtime.disposed) throw new Error("Adapter is disposed");
      const generation = runtime.generation;
      const result = await fn(...args);
      if (!runtime.disposed && generation === runtime.generation && !hasMutationError(result))
        void runtime
          .invalidate(
            runtime.cache
              .getQueryCache()
              .getAll()
              .filter((query) => endpoints.includes(String(query.queryKey[3])))
              .map((query) => query.queryKey),
          )
          .catch(() => {});
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
    } as const;
    for (const [hook, method] of Object.entries(hooks))
      client[hook] = (query?: Record<string, unknown>, options?: { enabled?: boolean }) =>
        useResource(runtime, method, auth.organization[method], query, options);
    const mutations: Record<string, unknown> = {};
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
    ] as const)
      mutations[method] = write(auth.organization[method], Object.values(hooks));
  }
  if (config.features.sessions) {
    client.useListSessions = (query?: Record<string, unknown>, options?: { enabled?: boolean }) =>
      useResource(runtime, "listSessions", auth.listSessions, query, options);
    for (const method of ["revokeSession", "revokeOtherSessions", "revokeSessions"] as const)
      client[method] = write(auth[method], ["listSessions"]);
  }
  runtimes.set(client, runtime);
  // Only the explicitly selected capabilities are assembled above. TypeScript
  // cannot narrow generic F from runtime booleans; retain C's exact signatures.
  return client as unknown as AuthDataClient<C, F>;
}

function hasMutationError(result: unknown) {
  return (
    typeof result === "object" && result !== null && "error" in result && Boolean(result.error)
  );
}
