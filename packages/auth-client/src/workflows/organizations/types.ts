import type { ReactNode } from "react";
import type { z } from "zod";
import type { Data, OrganizationClient, Query, Result } from "../../client/types.js";
import type {
  WorkflowError,
  WorkflowOutcome,
  WorkflowActionState,
  WorkflowForm,
  PolicyDecision,
  FormFieldErrors,
} from "../shared/types.js";
export type OrganizationScope =
  | { organizationId: string; organizationSlug?: never }
  | { organizationSlug: string; organizationId?: never };
type Callback<T> = (value: T) => void | Promise<void>;
type Component<P, S> = (props: P & { children: (state: S) => ReactNode }) => ReactNode;
type Read<T> = Omit<Result<T>, "error"> & { queryError: unknown };
export type DirectoryOrganization<C extends OrganizationClient> =
  NonNullable<Data<C["organization"]["list"]>> extends readonly (infer O)[] ? O : never;
export type FullOrganization<C extends OrganizationClient> = NonNullable<
  Data<C["organization"]["getFullOrganization"]>
>;
export type OrganizationCompletion<
  C extends OrganizationClient,
  O extends "create" | "update" | "leave" | "delete" = "create" | "update" | "leave" | "delete",
> = {
  [K in O]: { operation: K; organizationId: string } & (K extends "create" | "update"
    ? { organization: DirectoryOrganization<C> }
    : {});
}[O];
export type OrganizationSync = Readonly<{
  operation: "create" | "update" | "leave" | "delete";
  organizationId: string;
  error: WorkflowError | null;
}>;
export type OrganizationCreateValues<C extends OrganizationClient> = Omit<
  NonNullable<Parameters<C["organization"]["create"]>[0]>,
  "fetchOptions" | "userId" | "keepCurrentActiveOrganization" | "teamId"
>;
export type OrganizationUpdateValues<C extends OrganizationClient> = NonNullable<
  NonNullable<Parameters<C["organization"]["update"]>[0]>["data"]
>;
type OptionalUndefined<T> = { [K in keyof T]: {} extends Pick<T, K> ? T[K] | undefined : T[K] };
type Schema<V> = z.ZodType<OptionalUndefined<V>, Record<string, unknown>>;
type Boundary<S extends z.ZodType> =
  Extract<
    keyof z.input<S> | keyof z.output<S>,
    "fetchOptions" | "organizationId" | "userId" | "teamId" | "keepCurrentActiveOrganization"
  > extends never
    ? unknown
    : never;
type FormOptions<V> = {
  enabled?: boolean;
  validate?: (values: Readonly<V>) => FormFieldErrors<V> | Promise<FormFieldErrors<V>>;
};
export type OrganizationCreateOptions<C extends OrganizationClient> = FormOptions<
  OrganizationCreateValues<C>
> & {
  schema?: never;
  initialValues: OrganizationCreateValues<C>;
  keepCurrentActiveOrganization?: boolean;
  onCreated?: Callback<OrganizationCompletion<C, "create">>;
};
export type OrganizationCreateState<
  C extends OrganizationClient,
  V = OrganizationCreateValues<C>,
> = WorkflowForm<V, OrganizationCompletion<C, "create">> & {
  pendingSync: OrganizationSync | null;
  retrySync(this: void): Promise<WorkflowOutcome<OrganizationCompletion<C, "create">>>;
  isPending: boolean;
  isFetching: boolean;
  queryError: unknown;
  refetch: Result<Data<C["organization"]["list"]>>["refetch"];
};
type CreateSchemaOptions<
  C extends OrganizationClient,
  S extends Schema<OrganizationCreateValues<C>>,
> = Omit<OrganizationCreateOptions<C>, "initialValues" | "schema"> & {
  initialValues: z.input<S>;
  schema: S & Boundary<S>;
};
export interface OrganizationCreateHook<C extends OrganizationClient> {
  (options: OrganizationCreateOptions<C>): OrganizationCreateState<C>;
  <S extends Schema<OrganizationCreateValues<C>>>(
    options: CreateSchemaOptions<C, S>,
  ): OrganizationCreateState<C, z.input<S>>;
}
export interface OrganizationCreateComponent<C extends OrganizationClient> {
  (
    props: OrganizationCreateOptions<C> & {
      children: (state: OrganizationCreateState<C>) => ReactNode;
    },
  ): ReactNode;
  <S extends Schema<OrganizationCreateValues<C>>>(
    props: CreateSchemaOptions<C, S> & {
      children: (state: OrganizationCreateState<C, z.input<S>>) => ReactNode;
    },
  ): ReactNode;
}
export type OrganizationPolicyContext<C extends OrganizationClient> = {
  organization: FullOrganization<C>;
  actorId: string;
  role: Data<C["organization"]["getActiveMemberRole"]> extends { role: infer R } ? R : string;
};
export type OrganizationSettingsOptions<C extends OrganizationClient> = OrganizationScope &
  FormOptions<OrganizationUpdateValues<C>> & {
    schema?: never;
    getInitialValues(organization: FullOrganization<C>): OrganizationUpdateValues<C>;
    policy?: Partial<
      Record<
        "update" | "leave" | "delete",
        (context: OrganizationPolicyContext<C>) => PolicyDecision
      >
    >;
    beforeDelete?: (context: { organizationId: string; signal: AbortSignal }) => Promise<void>;
    onUpdated?: Callback<OrganizationCompletion<C, "update">>;
    onLeft?: Callback<{ operation: "leave"; organizationId: string }>;
    onDeleted?: Callback<{ operation: "delete"; organizationId: string }>;
  };
export type OrganizationSettingsState<
  C extends OrganizationClient,
  V = OrganizationUpdateValues<C>,
> = WorkflowActionState & {
  organization: FullOrganization<C> | undefined;
  role: string | undefined;
  isPending: boolean;
  isFetching: boolean;
  queryError: unknown;
  form: WorkflowForm<V, OrganizationCompletion<C, "update">> | null;
  hasServerChanges: boolean;
  availability: Record<"update" | "leave" | "delete", PolicyDecision>;
  update(
    this: void,
    data: OrganizationUpdateValues<C>,
  ): Promise<WorkflowOutcome<OrganizationCompletion<C, "update">>>;
  leave(this: void): Promise<WorkflowOutcome<OrganizationCompletion<C, "leave">>>;
  delete(this: void): Promise<WorkflowOutcome<OrganizationCompletion<C, "delete">>>;
  pendingSync: OrganizationSync | null;
  retrySync(this: void): Promise<WorkflowOutcome<OrganizationCompletion<C>>>;
  refetch(this: void): Promise<void>;
};
type SettingsSchemaOptions<
  C extends OrganizationClient,
  S extends Schema<OrganizationUpdateValues<C>>,
> = Omit<OrganizationSettingsOptions<C>, "schema" | "getInitialValues"> & {
  schema: S & Boundary<S>;
  getInitialValues(organization: FullOrganization<C>): z.input<S>;
};
export interface OrganizationSettingsHook<C extends OrganizationClient> {
  (options: OrganizationSettingsOptions<C>): OrganizationSettingsState<C>;
  <S extends Schema<OrganizationUpdateValues<C>>>(
    options: SettingsSchemaOptions<C, S>,
  ): OrganizationSettingsState<C, z.input<S>>;
}
export interface OrganizationSettingsComponent<C extends OrganizationClient> {
  (
    props: OrganizationSettingsOptions<C> & {
      children: (state: OrganizationSettingsState<C>) => ReactNode;
    },
  ): ReactNode;
  <S extends Schema<OrganizationUpdateValues<C>>>(
    props: SettingsSchemaOptions<C, S> & {
      children: (state: OrganizationSettingsState<C, z.input<S>>) => ReactNode;
    },
  ): ReactNode;
}
export type OrganizationDirectoryOptions<C extends OrganizationClient> = {
  enabled?: boolean;
  selection?: OrganizationScope;
  fallback?: "none" | "first";
  onSelect?: Callback<DirectoryOrganization<C>>;
};
export type OrganizationDirectoryState<C extends OrganizationClient> = Read<
  Data<C["organization"]["list"]>
> &
  WorkflowActionState & {
    organization: DirectoryOrganization<C> | null;
    status: "loading" | "error" | "empty" | "unselected" | "unavailable" | "ready";
    selectOrganization(this: void, id: string): Promise<WorkflowOutcome<DirectoryOrganization<C>>>;
  };
export type OrganizationMember<C extends OrganizationClient> =
  NonNullable<Data<C["organization"]["listMembers"]>> extends { members: (infer M)[] } ? M : never;
export type MemberRoleInput<C extends OrganizationClient> = NonNullable<
  Parameters<C["organization"]["updateMemberRole"]>[0]
>["role"];
export type MemberPolicyContext<C extends OrganizationClient> = OrganizationPolicyContext<C> & {
  member: OrganizationMember<C>;
};
export type OrganizationMembersOptions<C extends OrganizationClient> = OrganizationScope & {
  enabled?: boolean;
  pageSize: number;
  query?: Omit<
    Query<C["organization"]["listMembers"]>,
    "organizationId" | "organizationSlug" | "limit" | "offset"
  >;
  policy?: {
    updateMemberRole?: (
      context: MemberPolicyContext<C> & { nextRole: MemberRoleInput<C> },
    ) => PolicyDecision;
    removeMember?: (context: MemberPolicyContext<C>) => PolicyDecision;
    assignableRoles?: (context: MemberPolicyContext<C>) => readonly MemberRoleInput<C>[];
  };
  onRoleUpdated?: Callback<{
    memberId: string;
    result: Data<C["organization"]["updateMemberRole"]>;
  }>;
  onRemoved?: Callback<{ memberId: string; result: Data<C["organization"]["removeMember"]> }>;
};
export type OrganizationMembersState<C extends OrganizationClient> = Read<
  Data<C["organization"]["listMembers"]>
> &
  WorkflowActionState & {
    organization: FullOrganization<C> | undefined;
    role: string | undefined;
    members: readonly OrganizationMember<C>[];
    total: number;
    page: number;
    pageSize: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    setPage(this: void, page: number): void;
    nextPage(this: void): void;
    previousPage(this: void): void;
    availability(
      this: void,
      memberId: string,
      nextRole?: MemberRoleInput<C>,
    ): {
      remove: PolicyDecision;
      updateRole: PolicyDecision;
      assignableRoles: readonly MemberRoleInput<C>[] | undefined;
    };
    updateMemberRole(
      this: void,
      input: {
        memberId: string;
        role: MemberRoleInput<C>;
      },
    ): Promise<WorkflowOutcome<Data<C["organization"]["updateMemberRole"]>>>;
    removeMember(
      this: void,
      input: {
        memberId: string;
      },
    ): Promise<WorkflowOutcome<Data<C["organization"]["removeMember"]>>>;
  };
export type OrganizationWorkflows<C extends OrganizationClient> = {
  useOrganizationDirectory(
    this: void,
    options?: OrganizationDirectoryOptions<C>,
  ): OrganizationDirectoryState<C>;
  OrganizationDirectory: Component<OrganizationDirectoryOptions<C>, OrganizationDirectoryState<C>>;
  useOrganizationCreateForm: OrganizationCreateHook<C>;
  OrganizationCreateForm: OrganizationCreateComponent<C>;
  useOrganizationSettings: OrganizationSettingsHook<C>;
  OrganizationSettings: OrganizationSettingsComponent<C>;
  useOrganizationMembers(
    this: void,
    options: OrganizationMembersOptions<C>,
  ): OrganizationMembersState<C>;
  OrganizationMembers: Component<OrganizationMembersOptions<C>, OrganizationMembersState<C>>;
};
