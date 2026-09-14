import { type ReactNode } from "react";
import { type FormOptions } from "./form.js";
import type { CacheRuntime } from "../../cache/query-cache.js";
import type { Result } from "../../client/types.js";
type Values = Record<string, unknown>;
export type InvitationReads = {
    useListOrganizations(query?: undefined, options?: Options): Result<unknown>;
    useListUserInvitations(query?: undefined, options?: Options): Result<unknown>;
    useInvitation(query: {
        id: string;
    }, options?: Options): Result<unknown>;
    useListInvitations(query: {
        organizationId: string;
    }, options?: Options): Result<unknown>;
    organization: {
        acceptInvitation: InvitationWrite;
        rejectInvitation: InvitationWrite;
        cancelInvitation: InvitationWrite;
        inviteMember(body: Values & {
            organizationId: string;
            resend: boolean;
        }, options: WriteOptions): Promise<unknown>;
    };
};
type WriteOptions = {
    throw: true;
    retry: 0;
};
type InvitationWrite = (body: {
    invitationId: string;
}, options: WriteOptions) => Promise<unknown>;
type Callback<T = unknown> = (data: T) => void | Promise<void>;
type Options = {
    enabled?: boolean;
};
type Accepted = {
    invitationId: string;
    organization: unknown;
};
type Responses = Options & {
    onAccepted?: Callback<Accepted>;
    onRejected?: Callback<{
        invitationId: string;
        result: unknown;
    }>;
};
type OutgoingOptions = Options & {
    organizationId: string;
    onCancelled?: Callback<{
        invitationId: string;
        result: unknown;
    }>;
    onResent?: Callback;
};
export declare function createInvitationWorkflows(client: InvitationReads, runtime: CacheRuntime): {
    useInvitationForm: (options: FormOptions) => {
        values: {
            [x: string]: unknown;
        };
        hasServerChanges: boolean;
        touched: {
            [k: string]: boolean | undefined;
        };
        fieldErrors: Partial<Record<string, import("../shared/types.js").FormFieldIssue>>;
        validationError: {
            cause?: unknown;
            code: string;
            message?: string;
        } | null;
        isDirty: boolean;
        isValidating: boolean;
        field: (name: string) => {
            value: unknown;
            error: import("../shared/types.js").FormFieldIssue | undefined;
            isDisabled: boolean;
            onChange(value: unknown): void;
            onBlur(): void;
        };
        submit: () => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
        reset: () => void;
        isBusy: boolean;
        pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
        error: import("../shared/types.js").WorkflowError | null;
    };
    useReceivedInvitations: (options?: Responses) => {
        isBusy: boolean;
        pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
        error: import("../shared/types.js").WorkflowError | null;
        reset: () => void;
        accept: (invitationId: string) => Promise<import("../shared/types.js").WorkflowOutcome<{
            invitationId: string;
            organization: Values;
        }>>;
        reject: (invitationId: string) => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
        retrySync: (invitationId: string) => Promise<import("../shared/types.js").WorkflowOutcome<{
            invitationId: string;
            organization: Values;
        }>>;
        pendingSync: Readonly<{
            invitationId: string;
            organizationId: string;
            error: import("./types.js").InvitationWorkflowError | null;
        }>[];
        queryError: unknown;
        data: unknown;
        isPending: boolean;
        isFetching: boolean;
        refetch(): Promise<import("../../client/types.js").RefetchResult<unknown> | undefined>;
    };
    useInvitationResponse: (options: Responses & {
        invitationId: string;
    }) => {
        accept: () => Promise<import("../shared/types.js").WorkflowOutcome<{
            invitationId: string;
            organization: Values;
        }>>;
        reject: () => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
        retrySync: () => Promise<import("../shared/types.js").WorkflowOutcome<{
            invitationId: string;
            organization: Values;
        }>>;
        pendingSync: Readonly<{
            invitationId: string;
            organizationId: string;
            error: import("./types.js").InvitationWorkflowError | null;
        }> | null;
        isBusy: boolean;
        pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
        error: import("../shared/types.js").WorkflowError | null;
        reset: () => void;
        invitation: unknown;
        queryError: unknown;
        isPending: boolean;
        isFetching: boolean;
        refetch(): Promise<import("../../client/types.js").RefetchResult<unknown> | undefined>;
    };
    useOrganizationInvitations: (options: OutgoingOptions) => {
        isBusy: boolean;
        pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
        error: import("../shared/types.js").WorkflowError | null;
        reset: () => void;
        cancel: (invitationId: string) => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
        resend: (values: Values) => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
        queryError: unknown;
        data: unknown;
        isPending: boolean;
        isFetching: boolean;
        refetch(): Promise<import("../../client/types.js").RefetchResult<unknown> | undefined>;
    };
    InvitationForm: ({ children, ...options }: FormOptions & {
        children: (state: ReturnType<(options: FormOptions) => {
            values: {
                [x: string]: unknown;
            };
            hasServerChanges: boolean;
            touched: {
                [k: string]: boolean | undefined;
            };
            fieldErrors: Partial<Record<string, import("../shared/types.js").FormFieldIssue>>;
            validationError: {
                cause?: unknown;
                code: string;
                message?: string;
            } | null;
            isDirty: boolean;
            isValidating: boolean;
            field: (name: string) => {
                value: unknown;
                error: import("../shared/types.js").FormFieldIssue | undefined;
                isDisabled: boolean;
                onChange(value: unknown): void;
                onBlur(): void;
            };
            submit: () => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
            reset: () => void;
            isBusy: boolean;
            pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
            error: import("../shared/types.js").WorkflowError | null;
        }>) => ReactNode;
    }) => ReactNode;
    ReceivedInvitations: ({ children, ...options }: Responses & {
        children: (state: ReturnType<(options?: Responses) => {
            isBusy: boolean;
            pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
            error: import("../shared/types.js").WorkflowError | null;
            reset: () => void;
            accept: (invitationId: string) => Promise<import("../shared/types.js").WorkflowOutcome<{
                invitationId: string;
                organization: Values;
            }>>;
            reject: (invitationId: string) => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
            retrySync: (invitationId: string) => Promise<import("../shared/types.js").WorkflowOutcome<{
                invitationId: string;
                organization: Values;
            }>>;
            pendingSync: Readonly<{
                invitationId: string;
                organizationId: string;
                error: import("./types.js").InvitationWorkflowError | null;
            }>[];
            queryError: unknown;
            data: unknown;
            isPending: boolean;
            isFetching: boolean;
            refetch(): Promise<import("../../client/types.js").RefetchResult<unknown> | undefined>;
        }>) => ReactNode;
    }) => ReactNode;
    InvitationResponse: ({ children, ...options }: Responses & {
        invitationId: string;
        children: (state: ReturnType<(options: Responses & {
            invitationId: string;
        }) => {
            accept: () => Promise<import("../shared/types.js").WorkflowOutcome<{
                invitationId: string;
                organization: Values;
            }>>;
            reject: () => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
            retrySync: () => Promise<import("../shared/types.js").WorkflowOutcome<{
                invitationId: string;
                organization: Values;
            }>>;
            pendingSync: Readonly<{
                invitationId: string;
                organizationId: string;
                error: import("./types.js").InvitationWorkflowError | null;
            }> | null;
            isBusy: boolean;
            pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
            error: import("../shared/types.js").WorkflowError | null;
            reset: () => void;
            invitation: unknown;
            queryError: unknown;
            isPending: boolean;
            isFetching: boolean;
            refetch(): Promise<import("../../client/types.js").RefetchResult<unknown> | undefined>;
        }>) => ReactNode;
    }) => ReactNode;
    OrganizationInvitations: ({ children, ...options }: OutgoingOptions & {
        children: (state: ReturnType<(options: OutgoingOptions) => {
            isBusy: boolean;
            pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
            error: import("../shared/types.js").WorkflowError | null;
            reset: () => void;
            cancel: (invitationId: string) => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
            resend: (values: Values) => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
            queryError: unknown;
            data: unknown;
            isPending: boolean;
            isFetching: boolean;
            refetch(): Promise<import("../../client/types.js").RefetchResult<unknown> | undefined>;
        }>) => ReactNode;
    }) => ReactNode;
};
export {};
//# sourceMappingURL=workflows.d.ts.map