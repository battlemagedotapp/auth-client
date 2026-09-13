import { type ReactNode } from "react";
import type { Features, SessionClient, OrganizationClient, SessionsClient, AuthDataClient, AuthDataLifecycle, InvalidationApi } from "./types.js";
export type * from "./types.js";
export declare function AuthDataProvider({ client, children, }: {
    client: AuthDataLifecycle;
    children: ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare function createAuthDataClient<C extends SessionClient, F extends Features>(config: {
    authClient: C & (F extends {
        organization: true;
    } ? OrganizationClient : unknown) & (F extends {
        sessions: true;
    } ? SessionsClient : unknown);
    api: InvalidationApi;
    features: F;
}): AuthDataClient<C, F>;
//# sourceMappingURL=index.d.ts.map