import type { ResourceDependency } from "./types.js";
/** Inspect dependency metadata without widening or rebuilding HTTP payload types. */
export declare function dependencies(endpoint: string, query: Record<string, unknown>, data: unknown, userId: string): ResourceDependency[];
export declare function nextExpiry(data: unknown, now: number): number | undefined;
//# sourceMappingURL=dependencies.d.ts.map