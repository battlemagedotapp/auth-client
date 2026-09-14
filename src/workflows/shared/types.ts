export type WorkflowError = {
  phase: "validation" | "preparation" | "write" | "synchronization" | "callback";
  cause: unknown;
  writeSucceeded: boolean;
};
export type WorkflowOutcome<T> =
  | { status: "success"; data: T }
  | { status: "error"; error: WorkflowError }
  | { status: "ignored"; reason: "disabled" | "busy" | "obsolete" | "unavailable" };
export type WorkflowOperation =
  | "select"
  | "create"
  | "update"
  | "leave"
  | "delete"
  | "invite"
  | "resend"
  | "accept"
  | "reject"
  | "cancel"
  | "updateMemberRole"
  | "removeMember"
  | "revokeSession"
  | "revokeOtherSessions"
  | "revokeSessions";
export type WorkflowPendingAction = {
  operation: WorkflowOperation;
  organizationId?: string;
  invitationId?: string;
  memberId?: string;
  sessionId?: string;
};
export type WorkflowActionState = {
  isBusy: boolean;
  pendingAction: WorkflowPendingAction | null;
  error: WorkflowError | null;
  reset(this: void): void;
};
export type PolicyDecision = { allowed: true } | { allowed: false; code: string };
export type FormFieldIssue = { code: string; message?: string };
export type FormValidationIssue = FormFieldIssue & { cause?: unknown };
export type FormFieldErrors<V> = Partial<Record<keyof V, FormFieldIssue>>;
export type WorkflowForm<V, R> = WorkflowActionState & {
  values: Readonly<V>;
  touched: Readonly<Partial<Record<keyof V, boolean>>>;
  fieldErrors: Readonly<FormFieldErrors<V>>;
  validationError: FormValidationIssue | null;
  isDirty: boolean;
  isValidating: boolean;
  field<K extends keyof V>(
    this: void,
    name: K,
  ): {
    value: V[K];
    onChange(this: void, value: V[K]): void;
    onBlur(this: void): void;
    error: { code: string; message?: string } | undefined;
    isDisabled: boolean;
  };
  submit(this: void): Promise<WorkflowOutcome<R>>;
};
