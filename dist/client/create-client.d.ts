import type { Features, SessionClient, AuthDataClient, AuthDataClientConfig } from "./types.js";
export declare function createAuthDataClient<C extends SessionClient, F extends Features, U extends {
    email: string;
} = never>(config: AuthDataClientConfig<C, F, U>): AuthDataClient<C, F, U>;
//# sourceMappingURL=create-client.d.ts.map