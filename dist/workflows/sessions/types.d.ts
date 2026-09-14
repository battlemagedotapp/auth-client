import type { ReactNode } from "react";
import type { Data, Result, SessionClient, SessionsClient } from "../../client/types.js";
import type { WorkflowActionState, WorkflowOutcome } from "../shared/types.js";
type Callback<T> = (value: T) => void | Promise<void>;
type Component<P, S> = (props: P & {
    children: (state: S) => ReactNode;
}) => ReactNode;
type Read<T> = Omit<Result<T>, "error"> & {
    queryError: unknown;
};
export type SessionsOptions<C extends SessionsClient> = {
    enabled?: boolean;
    onRevoked?: Callback<{
        operation: "revokeSession" | "revokeOtherSessions" | "revokeSessions";
        sessionId?: string;
        result: Data<C["revokeSession"]> | Data<C["revokeSessions"]> | Data<C["revokeOtherSessions"]>;
    }>;
};
export type SessionsState<C extends SessionsClient & SessionClient> = Read<Data<C["listSessions"]>> & WorkflowActionState & {
    currentSession: NonNullable<ReturnType<C["useSession"]>["data"]>["session"] | undefined;
    currentSessionId: string | undefined;
    needsFreshSession: boolean;
    revokeSession(this: void, sessionId: string): Promise<WorkflowOutcome<Data<C["revokeSession"]>>>;
    revokeOtherSessions(this: void): Promise<WorkflowOutcome<Data<C["revokeOtherSessions"]>>>;
    revokeSessions(this: void): Promise<WorkflowOutcome<Data<C["revokeSessions"]>>>;
};
export type SessionWorkflows<C extends SessionsClient & SessionClient> = {
    useSessions(this: void, options?: SessionsOptions<C>): SessionsState<C>;
    Sessions: Component<SessionsOptions<C>, SessionsState<C>>;
};
export {};
//# sourceMappingURL=types.d.ts.map