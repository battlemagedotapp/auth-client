import { array, looseObject, string, union, type ZodType } from "zod";
import { useWorkflowForm, type FormOptions as BaseOptions } from "../shared/form.js";
import { useCommittedRef, type useWorkflowAction, type Values } from "../shared/action.js";

export type FormOptions = BaseOptions & {
  organizationId: string;
  mode?: "invite" | "resend";
  onInvited?: (result: unknown) => void | Promise<void>;
};
const nonempty = string().refine((value) => Boolean(value.trim()), "Required");
const minimum: ZodType<Values, Values> = looseObject({
  email: nonempty,
  role: union([nonempty, array(nonempty).min(1)]),
});
export function useInvitationFormState(
  options: FormOptions,
  action: ReturnType<typeof useWorkflowAction>,
  write: (values: Values) => Promise<unknown>,
  invitationId: (values: Values) => string | undefined,
) {
  const latestTarget = useCommittedRef(invitationId);
  return useWorkflowForm(
    {
      ...options,
      initialValues: options.schema
        ? options.initialValues
        : { ...options.initialValues, email: options.initialValues.email ?? "" },
    },
    action,
    {
      operation: options.mode ?? "invite",
      organizationId: options.organizationId,
      minimum,
      write: (values, transaction) =>
        transaction.write(() => write(values), latestTarget.current(values)),
      complete: async (result, transaction) => {
        transaction.phase("callback");
        await options.onInvited?.(result);
        return result;
      },
    },
  );
}
