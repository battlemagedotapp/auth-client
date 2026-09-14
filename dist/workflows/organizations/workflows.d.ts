import { type ReactNode } from "react";
import type { CacheRuntime } from "../../cache/query-cache.js";
import type { Result } from "../../client/types.js";
import { type FormOptions } from "../shared/form.js";
import { type Values } from "../shared/action.js";
import type { OrganizationScope } from "./types.js";
import type { PolicyDecision } from "../shared/types.js";
type Write = (body: Values, options: {
    throw: true;
    retry: 0;
}) => Promise<unknown>;
export type OrganizationReads = {
    useListOrganizations(query?: undefined, options?: {
        enabled?: boolean;
    }): Result<unknown>;
    useOrganization(query: Values, options?: {
        enabled?: boolean;
    }): Result<unknown>;
    useMemberRole(query: Values, options?: {
        enabled?: boolean;
    }): Result<unknown>;
    useListMembers(query: Values, options?: {
        enabled?: boolean;
    }): Result<unknown>;
    organization: Record<"create" | "update" | "leave" | "delete" | "updateMemberRole" | "removeMember", Write>;
};
type Completion = {
    operation: "create" | "update" | "leave" | "delete";
    organizationId: string;
    organization?: Values;
};
type Callback = (value: Completion) => void | Promise<void>;
type ScopeOptions = OrganizationScope & {
    enabled?: boolean;
};
type AuthDataContext = {
    organization: Values;
    actorId: string;
    role: string;
};
type SettingsOptions = ScopeOptions & Omit<FormOptions, "initialValues"> & {
    getInitialValues(organization: Values): Values;
    policy?: Partial<Record<"update" | "leave" | "delete", (context: AuthDataContext) => PolicyDecision>>;
    beforeDelete?: (context: {
        organizationId: string;
        signal: AbortSignal;
    }) => Promise<void>;
    onUpdated?: Callback;
    onLeft?: Callback;
    onDeleted?: Callback;
};
type MemberContext = AuthDataContext & {
    member: Values;
};
type MembersOptions = ScopeOptions & {
    pageSize: number;
    query?: Values;
    policy?: {
        updateMemberRole?: (context: MemberContext & {
            nextRole: unknown;
        }) => PolicyDecision;
        removeMember?: (context: MemberContext) => PolicyDecision;
        assignableRoles?: (context: MemberContext) => readonly unknown[];
    };
    onRoleUpdated?: (value: {
        memberId: string;
        result: unknown;
    }) => void | Promise<void>;
    onRemoved?: (value: {
        memberId: string;
        result: unknown;
    }) => void | Promise<void>;
};
export declare function createOrganizationWorkflows(client: OrganizationReads, runtime: CacheRuntime): {
    useOrganizationDirectory: (options?: {
        enabled?: boolean;
        selection?: OrganizationScope;
        fallback?: "none" | "first";
        onSelect?: (organization: Values) => void | Promise<void>;
    }) => {
        organization: Values | null;
        status: string;
        selectOrganization: (id: string) => Promise<import("../shared/types.js").WorkflowOutcome<Values>>;
        isBusy: boolean;
        pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
        error: import("../shared/types.js").WorkflowError | null;
        reset: () => void;
        queryError: unknown;
        data: unknown;
        isPending: boolean;
        isFetching: boolean;
        refetch(): Promise<import("../../client/types.js").RefetchResult<unknown> | undefined>;
    };
    useOrganizationCreateForm: (options: FormOptions & {
        keepCurrentActiveOrganization?: boolean;
        onCreated?: Callback;
    }) => {
        pendingSync: Readonly<{
            operation: "create" | "update" | "leave" | "delete";
            organizationId: string;
            error: import("../shared/types.js").WorkflowError | null;
        }> | null;
        retrySync: () => Promise<import("../shared/types.js").WorkflowOutcome<Completion>>;
        isPending: boolean;
        isFetching: boolean;
        queryError: unknown;
        refetch: () => Promise<import("../../client/types.js").RefetchResult<unknown> | undefined>;
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
    useOrganizationSettings: (options: SettingsOptions) => {
        organization: Values | undefined;
        role: string | undefined;
        form: {
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
        } | null;
        hasServerChanges: boolean;
        availability: {
            update: PolicyDecision;
            leave: PolicyDecision;
            delete: PolicyDecision;
        };
        isPending: boolean;
        isFetching: boolean;
        queryError: unknown;
        pendingSync: Readonly<{
            operation: "create" | "update" | "leave" | "delete";
            organizationId: string;
            error: import("../shared/types.js").WorkflowError | null;
        }> | null;
        retrySync: () => Promise<import("../shared/types.js").WorkflowOutcome<Completion>>;
        update: (data: Values) => Promise<import("../shared/types.js").WorkflowOutcome<Completion>>;
        leave: () => Promise<import("../shared/types.js").WorkflowOutcome<Completion>>;
        delete: () => Promise<import("../shared/types.js").WorkflowOutcome<Completion>>;
        refetch: () => Promise<void>;
        isBusy: boolean;
        pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
        error: import("../shared/types.js").WorkflowError | null;
        reset: () => void;
    };
    useOrganizationMembers: (options: MembersOptions) => {
        data: unknown;
        organization: Values | undefined;
        role: string | undefined;
        members: Values[];
        total: number;
        page: number;
        pageSize: number;
        isPending: boolean;
        isFetching: boolean;
        queryError: unknown;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        setPage: (next: number) => void;
        nextPage: () => void;
        previousPage: () => void;
        availability: (memberId: string, nextRole?: unknown) => {
            remove: PolicyDecision;
            updateRole: PolicyDecision;
            assignableRoles: readonly unknown[] | undefined;
        };
        updateMemberRole: ({ memberId, role }: {
            memberId: string;
            role: unknown;
        }) => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
        removeMember: ({ memberId }: {
            memberId: string;
        }) => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
        isBusy: boolean;
        pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
        error: import("../shared/types.js").WorkflowError | null;
        reset: () => void;
        refetch(): Promise<import("../../client/types.js").RefetchResult<unknown> | undefined>;
    };
    OrganizationDirectory: ({ children, ...options }: Parameters<(options?: {
        enabled?: boolean;
        selection?: OrganizationScope;
        fallback?: "none" | "first";
        onSelect?: (organization: Values) => void | Promise<void>;
    }) => {
        organization: Values | null;
        status: string;
        selectOrganization: (id: string) => Promise<import("../shared/types.js").WorkflowOutcome<Values>>;
        isBusy: boolean;
        pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
        error: import("../shared/types.js").WorkflowError | null;
        reset: () => void;
        queryError: unknown;
        data: unknown;
        isPending: boolean;
        isFetching: boolean;
        refetch(): Promise<import("../../client/types.js").RefetchResult<unknown> | undefined>;
    }>[0] & {
        children: (state: ReturnType<(options?: {
            enabled?: boolean;
            selection?: OrganizationScope;
            fallback?: "none" | "first";
            onSelect?: (organization: Values) => void | Promise<void>;
        }) => {
            organization: Values | null;
            status: string;
            selectOrganization: (id: string) => Promise<import("../shared/types.js").WorkflowOutcome<Values>>;
            isBusy: boolean;
            pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
            error: import("../shared/types.js").WorkflowError | null;
            reset: () => void;
            queryError: unknown;
            data: unknown;
            isPending: boolean;
            isFetching: boolean;
            refetch(): Promise<import("../../client/types.js").RefetchResult<unknown> | undefined>;
        }>) => ReactNode;
    }) => ReactNode;
    OrganizationCreateForm: ({ children, ...options }: Parameters<(options: FormOptions & {
        keepCurrentActiveOrganization?: boolean;
        onCreated?: Callback;
    }) => {
        pendingSync: Readonly<{
            operation: "create" | "update" | "leave" | "delete";
            organizationId: string;
            error: import("../shared/types.js").WorkflowError | null;
        }> | null;
        retrySync: () => Promise<import("../shared/types.js").WorkflowOutcome<Completion>>;
        isPending: boolean;
        isFetching: boolean;
        queryError: unknown;
        refetch: () => Promise<import("../../client/types.js").RefetchResult<unknown> | undefined>;
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
    }>[0] & {
        children: (state: ReturnType<(options: FormOptions & {
            keepCurrentActiveOrganization?: boolean;
            onCreated?: Callback;
        }) => {
            pendingSync: Readonly<{
                operation: "create" | "update" | "leave" | "delete";
                organizationId: string;
                error: import("../shared/types.js").WorkflowError | null;
            }> | null;
            retrySync: () => Promise<import("../shared/types.js").WorkflowOutcome<Completion>>;
            isPending: boolean;
            isFetching: boolean;
            queryError: unknown;
            refetch: () => Promise<import("../../client/types.js").RefetchResult<unknown> | undefined>;
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
    OrganizationSettings: ({ children, ...options }: SettingsOptions & {
        children: (state: ReturnType<(options: SettingsOptions) => {
            organization: Values | undefined;
            role: string | undefined;
            form: {
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
            } | null;
            hasServerChanges: boolean;
            availability: {
                update: PolicyDecision;
                leave: PolicyDecision;
                delete: PolicyDecision;
            };
            isPending: boolean;
            isFetching: boolean;
            queryError: unknown;
            pendingSync: Readonly<{
                operation: "create" | "update" | "leave" | "delete";
                organizationId: string;
                error: import("../shared/types.js").WorkflowError | null;
            }> | null;
            retrySync: () => Promise<import("../shared/types.js").WorkflowOutcome<Completion>>;
            update: (data: Values) => Promise<import("../shared/types.js").WorkflowOutcome<Completion>>;
            leave: () => Promise<import("../shared/types.js").WorkflowOutcome<Completion>>;
            delete: () => Promise<import("../shared/types.js").WorkflowOutcome<Completion>>;
            refetch: () => Promise<void>;
            isBusy: boolean;
            pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
            error: import("../shared/types.js").WorkflowError | null;
            reset: () => void;
        }>) => ReactNode;
    }) => ReactNode;
    OrganizationMembers: ({ children, ...options }: MembersOptions & {
        children: (state: ReturnType<(options: MembersOptions) => {
            data: unknown;
            organization: Values | undefined;
            role: string | undefined;
            members: Values[];
            total: number;
            page: number;
            pageSize: number;
            isPending: boolean;
            isFetching: boolean;
            queryError: unknown;
            hasNextPage: boolean;
            hasPreviousPage: boolean;
            setPage: (next: number) => void;
            nextPage: () => void;
            previousPage: () => void;
            availability: (memberId: string, nextRole?: unknown) => {
                remove: PolicyDecision;
                updateRole: PolicyDecision;
                assignableRoles: readonly unknown[] | undefined;
            };
            updateMemberRole: ({ memberId, role }: {
                memberId: string;
                role: unknown;
            }) => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
            removeMember: ({ memberId }: {
                memberId: string;
            }) => Promise<import("../shared/types.js").WorkflowOutcome<unknown>>;
            isBusy: boolean;
            pendingAction: import("../shared/types.js").WorkflowPendingAction | null;
            error: import("../shared/types.js").WorkflowError | null;
            reset: () => void;
            refetch(): Promise<import("../../client/types.js").RefetchResult<unknown> | undefined>;
        }>) => ReactNode;
    }) => ReactNode;
};
export {};
//# sourceMappingURL=workflows.d.ts.map