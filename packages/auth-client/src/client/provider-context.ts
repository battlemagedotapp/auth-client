import { createContext, useContext, useSyncExternalStore } from "react";
import type { CacheRuntime, Identity } from "../cache/query-cache.js";

export const runtimeByClient = new WeakMap<object, CacheRuntime>();
export const AuthDataContext = createContext<{ runtime: CacheRuntime; identity: Identity } | null>(
  null,
);
export function useClientBoundary(runtime: CacheRuntime) {
  const context = useContext(AuthDataContext);
  if (!context || context.runtime !== runtime)
    throw new Error("Matching AuthDataProvider is required");
  const disposed = useSyncExternalStore(runtime.subscribe, runtime.getDisposed);
  return { identity: context.identity, disposed };
}
