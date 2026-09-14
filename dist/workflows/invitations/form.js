import { array, looseObject, string, union } from "zod";
import { useWorkflowForm } from "../shared/form.js";
import { useCommittedRef } from "../shared/action.js";
const nonempty = string().refine((value) => Boolean(value.trim()), "Required");
const minimum = looseObject({
    email: nonempty,
    role: union([nonempty, array(nonempty).min(1)]),
});
export function useInvitationFormState(options, action, write, invitationId) {
    const latestTarget = useCommittedRef(invitationId);
    return useWorkflowForm({
        ...options,
        initialValues: options.schema
            ? options.initialValues
            : { ...options.initialValues, email: options.initialValues.email ?? "" },
    }, action, {
        operation: options.mode ?? "invite",
        organizationId: options.organizationId,
        minimum,
        write: (values, transaction) => transaction.write(() => write(values), latestTarget.current(values)),
        complete: async (result, transaction) => {
            await transaction.complete(() => options.onInvited?.(result));
            return result;
        },
    });
}
//# sourceMappingURL=form.js.map