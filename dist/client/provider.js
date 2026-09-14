import { jsx as _jsx } from "react/jsx-runtime";
import { useLayoutEffect, useMemo } from "react";
import { useConvex, useConvexAuth } from "convex/react";
import { AuthDataContext, runtimeByClient } from "./provider-context.js";
export function AuthDataProvider({ client, children, }) {
    const runtime = runtimeByClient.get(client);
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
    return (_jsx(AuthDataContext.Provider, { value: { runtime, identity }, children: children }));
}
//# sourceMappingURL=provider.js.map