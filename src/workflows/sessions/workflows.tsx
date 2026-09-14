import type { ReactNode } from "react";
import type { CacheRuntime } from "../../cache/query-cache.js";
import type { Result } from "../../client/types.js";
import {
  getActionState,
  asRecord,
  asRecords,
  requireAvailable,
  useWorkflowAction,
  useCommittedRef,
} from "../shared/action.js";
type Operation = "revokeSession" | "revokeOtherSessions" | "revokeSessions";
export type SessionReads = {
  useListSessions(query?: undefined, options?: { enabled?: boolean }): Result<unknown>;
} & Record<
  Operation,
  (body: { token?: string }, options: { throw: true; retry: 0 }) => Promise<unknown>
>;
type Options = {
  enabled?: boolean;
  onRevoked?: (result: {
    operation: Operation;
    sessionId?: string;
    result: unknown;
  }) => void | Promise<void>;
};
function errorCode(error: unknown): unknown {
  const row = asRecord(error);
  return row?.code ?? asRecord(row?.error)?.code;
}
export function createSessionWorkflows(client: SessionReads, runtime: CacheRuntime) {
  function useSessions(options: Options = {}) {
    const query = client.useListSessions(undefined, { enabled: options.enabled });
    const session = runtime.auth.useSession();
    const action = useWorkflowAction(runtime, "sessions", options.enabled);
    const latest = useCommittedRef({ query, options });
    function perform(operation: Operation, sessionId?: string) {
      return action.run({ operation, ...(sessionId ? { sessionId } : {}) }, async (transaction) => {
        const row = asRecords(latest.current.query.data).find((value) => value.id === sessionId);
        if (operation === "revokeSession") requireAvailable(row && typeof row.token === "string");
        const result = await transaction.write(() =>
          client[operation](operation === "revokeSession" ? { token: row!.token as string } : {}, {
            throw: true,
            retry: 0,
          }),
        );
        if (!transaction.current()) throw new Error("Obsolete session action");
        transaction.phase("callback");
        await latest.current.options.onRevoked?.({
          operation,
          ...(sessionId ? { sessionId } : {}),
          result,
        });
        return result;
      });
    }
    const { error: queryError, ...read } = query;
    return {
      ...read,
      queryError,
      ...getActionState(action),
      currentSession: action.available ? session.data?.session : undefined,
      currentSessionId: action.available ? session.data?.session.id : undefined,
      needsFreshSession:
        errorCode(queryError) === "SESSION_NOT_FRESH" ||
        errorCode(action.error?.cause) === "SESSION_NOT_FRESH",
      revokeSession: (sessionId: string) => perform("revokeSession", sessionId),
      revokeOtherSessions: () => perform("revokeOtherSessions"),
      revokeSessions: () => perform("revokeSessions"),
    };
  }
  return {
    useSessions,
    Sessions: ({
      children,
      ...options
    }: Options & { children: (state: ReturnType<typeof useSessions>) => ReactNode }) =>
      children(useSessions(options)),
  };
}
