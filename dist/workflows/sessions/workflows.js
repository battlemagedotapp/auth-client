import { getActionState, asRecord, asRecords, requireAvailable, useWorkflowAction, useCommittedRef, } from "../shared/action.js";
function errorCode(error) {
    const row = asRecord(error);
    return row?.code ?? asRecord(row?.error)?.code;
}
export function createSessionWorkflows(client, runtime) {
    function useSessions(options = {}) {
        const query = client.useListSessions(undefined, { enabled: options.enabled });
        const session = runtime.auth.useSession();
        const action = useWorkflowAction(runtime, "sessions", options.enabled);
        const latest = useCommittedRef({ query, options });
        function perform(operation, sessionId) {
            return action.run({ operation, ...(sessionId ? { sessionId } : {}) }, async (transaction) => {
                const row = asRecords(latest.current.query.data).find((value) => value.id === sessionId);
                if (operation === "revokeSession")
                    requireAvailable(row && typeof row.token === "string");
                const result = await transaction.write(() => client[operation](operation === "revokeSession" ? { token: row.token } : {}, {
                    throw: true,
                    retry: 0,
                }));
                if (!transaction.current())
                    throw new Error("Obsolete session action");
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
            needsFreshSession: errorCode(queryError) === "SESSION_NOT_FRESH" ||
                errorCode(action.error?.cause) === "SESSION_NOT_FRESH",
            revokeSession: (sessionId) => perform("revokeSession", sessionId),
            revokeOtherSessions: () => perform("revokeOtherSessions"),
            revokeSessions: () => perform("revokeSessions"),
        };
    }
    return {
        useSessions,
        Sessions: ({ children, ...options }) => children(useSessions(options)),
    };
}
//# sourceMappingURL=workflows.js.map