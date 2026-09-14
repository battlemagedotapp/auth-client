import type { Features, SessionClient, OrganizationClient, SessionsClient, AuthDataClient, InvalidationApi } from "./types.js";
export declare function createAuthDataClient<C extends SessionClient, F extends Features>(config: {
    authClient: C & (F extends {
        organization: true;
    } ? OrganizationClient : unknown) & (F extends {
        sessions: true;
    } ? SessionsClient : unknown);
    api: InvalidationApi;
    features: F;
}): AuthDataClient<C, F>;
//# sourceMappingURL=create-client.d.ts.map