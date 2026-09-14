import type { FormFieldIssue, FormValidationIssue, FormFieldErrors } from "../shared/types.js";
import type { ReactNode } from "react";
import type { z } from "zod";
import type { Data, OrganizationClient, Result } from "../../client/types.js";
export type InvitationOperation = "invite" | "resend" | "accept" | "reject" | "cancel";
export type PendingInvitationAction = {
    operation: InvitationOperation;
    invitationId?: string;
};
export type InvitationWorkflowError = {
    phase: "validation" | "write" | "synchronization" | "callback";
    cause: unknown;
    writeSucceeded: boolean;
};
export type InvitationOutcome<T> = {
    status: "success";
    data: T;
} | {
    status: "error";
    error: InvitationWorkflowError;
} | {
    status: "ignored";
    reason: "disabled" | "busy" | "obsolete" | "unavailable";
};
export type InvitationValues<C extends OrganizationClient> = Omit<NonNullable<Parameters<C["organization"]["inviteMember"]>[0]>, "fetchOptions" | "organizationId" | "resend" | "teamId">;
export type InvitationFieldIssue = FormFieldIssue;
export type InvitationFormIssue = FormValidationIssue;
export type InvitationFieldErrors<V> = FormFieldErrors<V>;
export type InvitationActionState = {
    isBusy: boolean;
    pendingAction: PendingInvitationAction | null;
    error: InvitationWorkflowError | null;
    reset: () => void;
};
type Callback<T> = (result: T) => void | Promise<void>;
type Organization<C extends OrganizationClient> = NonNullable<Data<C["organization"]["list"]>> extends readonly (infer O)[] ? O : never;
export type AcceptedInvitation<C extends OrganizationClient> = {
    invitationId: string;
    organization: Organization<C>;
};
export type InvitationSync = Readonly<{
    invitationId: string;
    organizationId: string;
    error: InvitationWorkflowError | null;
}>;
export type InvitationResponseOptions<C extends OrganizationClient> = {
    enabled?: boolean;
    onAccepted?: Callback<AcceptedInvitation<C>>;
    onRejected?: Callback<{
        invitationId: string;
        result: Data<C["organization"]["rejectInvitation"]>;
    }>;
};
type ReadState<T> = Omit<Result<T>, "error"> & {
    queryError: unknown;
};
type RecipientActions<C extends OrganizationClient> = InvitationActionState & {
    accept: (invitationId: string) => Promise<InvitationOutcome<AcceptedInvitation<C>>>;
    reject: (invitationId: string) => Promise<InvitationOutcome<Data<C["organization"]["rejectInvitation"]>>>;
    pendingSync: readonly InvitationSync[];
    retrySync: (invitationId: string) => Promise<InvitationOutcome<AcceptedInvitation<C>>>;
};
export type ReceivedInvitationsState<C extends OrganizationClient> = ReadState<Data<C["organization"]["listUserInvitations"]>> & RecipientActions<C>;
export type InvitationResponseState<C extends OrganizationClient> = Omit<ReadState<Data<C["organization"]["getInvitation"]>>, "data"> & Omit<RecipientActions<C>, "accept" | "reject" | "retrySync" | "pendingSync"> & {
    pendingSync: InvitationSync | null;
    retrySync: () => Promise<InvitationOutcome<AcceptedInvitation<C>>>;
    invitation: Data<C["organization"]["getInvitation"]> | undefined;
    accept: () => ReturnType<RecipientActions<C>["accept"]>;
    reject: () => ReturnType<RecipientActions<C>["reject"]>;
};
export type InvitationFormOptions<C extends OrganizationClient> = {
    schema?: never;
    organizationId: string;
    initialValues: Omit<InvitationValues<C>, "email"> & {
        email?: string;
    };
    mode?: "invite" | "resend";
    enabled?: boolean;
    validate?: (values: Readonly<InvitationValues<C>>) => InvitationFieldErrors<InvitationValues<C>> | Promise<InvitationFieldErrors<InvitationValues<C>>>;
    onInvited?: Callback<Data<C["organization"]["inviteMember"]>>;
};
export type InvitationFormState<C extends OrganizationClient, V = InvitationValues<C>> = InvitationActionState & {
    values: Readonly<V>;
    touched: Readonly<Partial<Record<keyof V, boolean>>>;
    fieldErrors: Readonly<InvitationFieldErrors<V>>;
    validationError: InvitationFormIssue | null;
    isDirty: boolean;
    isValidating: boolean;
    field: <K extends keyof V>(name: K) => {
        value: V[K];
        onChange: (value: V[K]) => void;
        onBlur: () => void;
        error: InvitationFieldIssue | undefined;
        isDisabled: boolean;
    };
    submit: () => Promise<InvitationOutcome<Data<C["organization"]["inviteMember"]>>>;
};
type OptionalUndefined<T> = {
    [K in keyof T]: {} extends Pick<T, K> ? T[K] | undefined : T[K];
};
type InvitationSchema<C extends OrganizationClient> = z.ZodType<OptionalUndefined<InvitationValues<C>>, Record<string, unknown>>;
type SchemaBoundary<S extends z.ZodType> = Extract<keyof z.input<S> | keyof z.output<S>, "organizationId" | "fetchOptions" | "resend" | "teamId"> extends never ? unknown : never;
export type SchemaInvitationFormOptions<C extends OrganizationClient, S extends InvitationSchema<C>> = Omit<InvitationFormOptions<C>, "schema" | "initialValues"> & {
    schema: S & SchemaBoundary<S>;
    initialValues: z.input<S>;
};
export interface InvitationFormHook<C extends OrganizationClient> {
    (options: InvitationFormOptions<C>): InvitationFormState<C>;
    <S extends InvitationSchema<C>>(options: SchemaInvitationFormOptions<C, S>): InvitationFormState<C, z.input<S>>;
}
export interface InvitationFormComponent<C extends OrganizationClient> {
    (props: InvitationFormOptions<C> & {
        children: (state: InvitationFormState<C>) => ReactNode;
    }): ReactNode;
    <S extends InvitationSchema<C>>(props: SchemaInvitationFormOptions<C, S> & {
        children: (state: InvitationFormState<C, z.input<S>>) => ReactNode;
    }): ReactNode;
}
export type OrganizationInvitationsOptions<C extends OrganizationClient> = {
    organizationId: string;
    enabled?: boolean;
    onCancelled?: Callback<{
        invitationId: string;
        result: Data<C["organization"]["cancelInvitation"]>;
    }>;
    onResent?: Callback<Data<C["organization"]["inviteMember"]>>;
};
export type OrganizationInvitationsState<C extends OrganizationClient> = ReadState<Data<C["organization"]["listInvitations"]>> & InvitationActionState & {
    cancel: (invitationId: string) => Promise<InvitationOutcome<Data<C["organization"]["cancelInvitation"]>>>;
    resend: (values: InvitationValues<C>) => Promise<InvitationOutcome<Data<C["organization"]["inviteMember"]>>>;
};
type Component<P, S> = (props: P & {
    children: (state: S) => ReactNode;
}) => ReactNode;
export type InvitationSurface<C extends OrganizationClient> = {
    useInvitationForm: InvitationFormHook<C>;
    InvitationForm: InvitationFormComponent<C>;
    useReceivedInvitations: (options?: InvitationResponseOptions<C>) => ReceivedInvitationsState<C>;
    ReceivedInvitations: Component<InvitationResponseOptions<C>, ReceivedInvitationsState<C>>;
    useInvitationResponse: (options: InvitationResponseOptions<C> & {
        invitationId: string;
    }) => InvitationResponseState<C>;
    InvitationResponse: Component<InvitationResponseOptions<C> & {
        invitationId: string;
    }, InvitationResponseState<C>>;
    useOrganizationInvitations: (options: OrganizationInvitationsOptions<C>) => OrganizationInvitationsState<C>;
    OrganizationInvitations: Component<OrganizationInvitationsOptions<C>, OrganizationInvitationsState<C>>;
};
export {};
//# sourceMappingURL=types.d.ts.map