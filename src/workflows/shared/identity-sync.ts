import type { CacheRuntime } from "../../cache/query-cache.js";
import { asRecord, requireAvailable, type ActionExecution } from "./action.js";

export const identityOperationObsolete = Symbol("identity operation obsolete");
export type ExpectedIdentity = { userId?: string; token?: string };

const responseValue = (result: unknown) => {
  const row = asRecord(result);
  return row && "data" in row && row.data !== undefined ? row.data : result;
};

export function resultIdentity(result: unknown): ExpectedIdentity {
  const row = asRecord(responseValue(result));
  const user = asRecord(row?.user);
  return {
    userId: typeof user?.id === "string" ? user.id : undefined,
    token: typeof row?.token === "string" ? row.token : undefined,
  };
}

export const textValue = (value: unknown) => (typeof value === "string" ? value : "");

export async function synchronizeAuthenticated(
  runtime: CacheRuntime,
  transaction: ActionExecution,
  expected: ExpectedIdentity,
  previousToken?: string,
) {
  transaction.phase("synchronization");
  await runtime.refreshSession();
  await runtime.waitForAuth(
    (state) =>
      state.ready &&
      (!expected.userId || state.userId === expected.userId) &&
      (!expected.token || state.sessionToken === expected.token),
    transaction.signal,
    10_000,
    (state) =>
      state.userId &&
      ((expected.userId && state.userId !== expected.userId) ||
        (expected.token &&
          state.sessionToken &&
          state.sessionToken !== expected.token &&
          state.sessionToken !== previousToken))
        ? identityOperationObsolete
        : undefined,
  );
  const { userId, sessionId } = runtime.authObservation;
  requireAvailable(userId && sessionId);
  return { userId, sessionId };
}
