import type { CacheRuntime } from "../../cache/query-cache.js";
import { type ActionExecution } from "./action.js";
export declare const identityOperationObsolete: unique symbol;
export type ExpectedIdentity = {
    userId?: string;
    token?: string;
};
export declare function resultIdentity(result: unknown): ExpectedIdentity;
export declare const textValue: (value: unknown) => string;
export declare function synchronizeAuthenticated(runtime: CacheRuntime, transaction: ActionExecution, expected: ExpectedIdentity, previousToken?: string): Promise<{
    userId: string;
    sessionId: string;
}>;
//# sourceMappingURL=identity-sync.d.ts.map