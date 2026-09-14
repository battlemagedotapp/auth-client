import { createContext, useContext, useSyncExternalStore } from "react";
export const runtimeByClient = new WeakMap();
export const AuthDataContext = createContext(null);
export function useClientBoundary(runtime) {
    const context = useContext(AuthDataContext);
    if (!context || context.runtime !== runtime)
        throw new Error("Matching AuthDataProvider is required");
    const disposed = useSyncExternalStore(runtime.subscribe, runtime.getDisposed);
    return { identity: context.identity, disposed };
}
//# sourceMappingURL=provider-context.js.map