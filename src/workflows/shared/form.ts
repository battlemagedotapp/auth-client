import { useEffectEvent, useLayoutEffect, useRef } from "react";
import { useForm, useWatch, type FieldErrors, type ResolverResult } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { NEVER, record, string, unknown, type ZodType } from "zod";
import { useCommittedRef, type ActionExecution, type WorkflowActionController } from "./action.js";
import { hashKey } from "@tanstack/react-query";
import type { FormFieldErrors, FormFieldIssue } from "./types.js";
import type { WorkflowOperation } from "./types.js";
import type { WorkflowDisabledReason, WorkflowFeedbackOptions } from "./types.js";

type Values = Record<string, unknown>;
type Resolution = ResolverResult<Values, Values>;
export type FormOptions = WorkflowFeedbackOptions & {
  initialValues: Values;
  schema?: ZodType<Values, Values>;
  enabled?: boolean;
  validate?: (
    values: Readonly<Values>,
  ) => FormFieldErrors<Values> | Promise<FormFieldErrors<Values>>;
};
type Execution = {
  operation: WorkflowOperation;
  organizationId?: string;
  minimum: ZodType<Values, Values>;
  write: (values: Values, transaction: ActionExecution) => Promise<unknown>;
  complete?: (result: unknown, transaction: ActionExecution) => Promise<unknown>;
  resetToDraft?: boolean;
  syncDefaults?: boolean;
  blocked?: boolean;
  disabledReason?: WorkflowDisabledReason | null;
  secretFields?: readonly string[];
};
// RHF treats dots/brackets as paths. Encode literal Better Auth field names.
const encode = (name: string) =>
  "f" +
  Array.from(name)
    .map((character) => character.codePointAt(0)!.toString(16))
    .join("_");
const decode = (name: string) =>
  name
    .slice(1)
    .split("_")
    .filter(Boolean)
    .map((part) => String.fromCodePoint(parseInt(part, 16)))
    .join("");
const encodeValues = (values: Values): Values =>
  Object.fromEntries(Object.entries(values).map(([name, value]) => [encode(name), value]));
const decodeValues = (values: Values): Values =>
  Object.fromEntries(
    Object.entries(values)
      .filter(([name]) => name.startsWith("f"))
      .map(([name, value]) => [decode(name), value]),
  );
function issue(error: unknown): FormFieldIssue | undefined {
  if (!error || typeof error !== "object") return;
  const row = error as Record<string, unknown>;
  if (typeof row.type === "string")
    return { code: row.type, ...(typeof row.message === "string" ? { message: row.message } : {}) };
  for (const child of Object.values(row)) {
    const found = issue(child);
    if (found) return found;
  }
}
function formIssue(error: unknown) {
  const found = issue(error);
  return found
    ? {
        ...found,
        ...(error && typeof error === "object" && "cause" in error ? { cause: error.cause } : {}),
      }
    : null;
}
function publicFields(errors: FieldErrors<Values>): FormFieldErrors<Values> {
  return Object.fromEntries(
    Object.entries(errors)
      .filter(([name]) => name.startsWith("f"))
      .flatMap(([name, error]) => {
        const found = issue(error);
        return found ? [[decode(name), found]] : [];
      }),
  );
}
const emptyResolution = (): Resolution => ({ values: {}, errors: {} });

/** RHF is the only owner of editable values and field feedback. */
export function useWorkflowForm(
  options: FormOptions,
  action: WorkflowActionController,
  execution: Execution,
) {
  const defaults = () => ({
    ...encodeValues(options.initialValues),
    owner: action.owner,
  });
  const configuration = useRef(options);
  const latestExecution = useCommittedRef(execution);
  const validation = useRef<{
    revision: number;
    owner: symbol;
    latest: Promise<Resolution> | null;
  }>({ revision: 0, owner: action.owner, latest: null });
  const form = useForm<Values, undefined, Values>({
    defaultValues: defaults(),
    shouldFocusError: false,
    shouldUnregister: false,
    resolver: (encoded) => {
      const state = validation.current;
      const revision = ++state.revision;
      const config = configuration.current;
      const values = decodeValues(encoded);
      const resolve = async (): Promise<Resolution> => {
        try {
          const settings = {
            fields: {},
            shouldUseNativeValidation: false,
            criteriaMode: "firstError" as const,
          };
          const issues = new Map<string, FormFieldIssue>();
          const schema = record(string(), unknown()).transform(async (input, context) => {
            const parsed = await (config.schema ?? execution.minimum).safeParseAsync(input);
            const checked =
              parsed.success && config.schema
                ? await execution.minimum.safeParseAsync(parsed.data)
                : parsed;
            if (!checked.success) {
              for (const failure of checked.error.issues) {
                const name = failure.path.length ? encode(String(failure.path[0])) : "_form";
                // Preserve Zod's issue order before the resolver nests paths or
                // selects a union branch. Public bindings have one top-level issue.
                if (!issues.has(name))
                  issues.set(name, {
                    code: !config.schema || parsed.success ? "required" : failure.code,
                    message: failure.message,
                  });
                context.addIssue({ ...failure, path: [name] });
              }
              return NEVER;
            }
            return parsed.success ? parsed.data : NEVER;
          });
          const parsed = await zodResolver(schema)(values, undefined, settings);
          if (Object.keys(parsed.errors).length)
            return {
              values: {},
              errors: Object.fromEntries(
                [...issues].map(([name, value]) => [
                  name,
                  { type: value.code, message: value.message },
                ]),
              ),
            };
          const submitted = Object.fromEntries(
            Object.entries(parsed.values).filter(([, value]) => value !== undefined),
          );
          const custom = (await config.validate?.(submitted)) ?? {};
          const errors = Object.fromEntries(
            Object.entries(custom).flatMap(([name, value]) =>
              value ? [[encode(name), { type: value.code, message: value.message }]] : [],
            ),
          );
          return Object.keys(errors).length
            ? { values: {}, errors }
            : { values: submitted, errors: {} };
        } catch (cause) {
          const failure = {
            type: "validation",
            message: cause instanceof Error ? cause.message : "Validation failed",
            cause,
          };
          return { values: {}, errors: { _form: failure } };
        }
      };
      const pending = resolve().then(async (result) => {
        // Older RHF trigger/submit continuations must observe the latest validation,
        // never reinstall errors belonging to a retired draft or identity.
        if (validation.current !== state || revision !== state.revision)
          return validation.current.latest ?? emptyResolution();
        return result;
      });
      state.latest = pending;
      return pending;
    },
  });
  const {
    control,
    reset: resetForm,
    getValues,
    setValue,
    trigger,
    handleSubmit,
    formState,
    register,
  } = form;
  const watched = useWatch({ control });
  const { errors, touchedFields, isDirty, isValidating, submitCount, defaultValues } = formState;
  const signature = hashKey([options.initialValues]);
  const lastServerDefaults = useRef<string | undefined>(undefined);
  const baseline = hashKey([decodeValues(defaultValues ?? {})]);
  const hasServerChanges = execution.syncDefaults === true && signature !== baseline;
  useLayoutEffect(() => {
    configuration.current = options;
  }, [options]);
  const adoptServerDefaults = useEffectEvent(() => {
    if (!execution.syncDefaults || signature === lastServerDefaults.current || action.busy())
      return;
    lastServerDefaults.current = signature;
    if (!isDirty) replaceDefaults();
  });
  useLayoutEffect(() => {
    adoptServerDefaults();
  }, [signature, action.owner, action.isBusy]);
  useLayoutEffect(() => {
    validation.current = { revision: 0, owner: action.owner, latest: null };
    const config = configuration.current;
    resetForm({
      ...encodeValues(config.initialValues),
      owner: action.owner,
    });
    for (const name of Object.keys(getValues())) if (name.startsWith("f")) register(name);
    return () => {
      validation.current = { revision: 0, owner: action.owner, latest: null };
    };
  }, [action.owner, resetForm, register, getValues]);
  useLayoutEffect(() => {
    validation.current = { revision: 0, owner: action.owner, latest: null };
  }, [action.owner, options.enabled]);
  const matches = watched.owner === action.owner;
  // A newly available server projection is usable before RHF's layout reset.
  // Never expose an empty, falsely typed draft during that first render.
  const adoptingDefaults =
    execution.syncDefaults === true && !isDirty && signature !== baseline && !action.isBusy;
  const values = adoptingDefaults
    ? options.initialValues
    : decodeValues(matches ? watched : defaults());
  const fieldErrors = publicFields(matches ? errors : {});
  function clearValidation() {
    validation.current = { revision: 0, owner: action.owner, latest: null };
  }
  function replaceDefaults() {
    clearValidation();
    const config = configuration.current;
    resetForm({
      ...encodeValues(config.initialValues),
      owner: action.owner,
    });
  }
  function reset() {
    if (!action.current() || action.busy()) return;
    action.reset();
    replaceDefaults();
  }
  function field(name: string) {
    const key = encode(name);
    register(key);
    return {
      name,
      value: values[name],
      error: fieldErrors[name],
      isDisabled: !action.available || action.isBusy || execution.blocked === true,
      onChange(value: unknown) {
        if (!action.canEdit() || latestExecution.current.blocked) return;
        clearValidation();
        setValue(key, value, { shouldDirty: true });
        action.reset();
        if (Object.keys(touchedFields).length || submitCount > 0) void trigger();
      },
      onBlur() {
        if (!action.canEdit() || latestExecution.current.blocked) return;
        setValue(key, getValues(key), { shouldTouch: true });
        void trigger();
      },
    };
  }
  async function submit() {
    if (latestExecution.current.blocked)
      return { status: "ignored" as const, reason: "unavailable" as const };
    const draft = decodeValues(getValues());
    try {
      return await action.run(
        {
          operation: execution.operation,
          ...(execution.organizationId ? { organizationId: execution.organizationId } : {}),
        },
        async (transaction) => {
          transaction.phase("validation");
          let result: unknown;
          let invalid: FieldErrors<Values> | undefined;
          await handleSubmit(
            async (submitted) => {
              if (!transaction.current()) throw new Error("Obsolete form validation");
              transaction.phase("write");
              result = await latestExecution.current.write(submitted, transaction);
              if (!transaction.current()) throw new Error("Obsolete form submission");
            },
            (failures) => {
              invalid = failures;
            },
          )();
          if (invalid) throw { fields: publicFields(invalid), form: formIssue(invalid._form) };
          if (!transaction.current()) throw new Error("Obsolete form submission");
          if (execution.resetToDraft) {
            clearValidation();
            resetForm({ ...encodeValues(draft), owner: action.owner });
          } else replaceDefaults();
          return execution.complete ? execution.complete(result, transaction) : result;
        },
      );
    } finally {
      for (const name of execution.secretFields ?? []) {
        const key = encode(name);
        if (key in getValues()) setValue(key, "", { shouldDirty: false });
      }
    }
  }
  return {
    actions: {
      submit: {
        ...action.control(
          {
            operation: execution.operation,
            ...(execution.organizationId ? { organizationId: execution.organizationId } : {}),
          },
          execution.disabledReason ?? (execution.blocked ? { code: "unavailable" } : null),
        ),
        run: submit,
      },
    },
    feedback: action.feedback(),
    values,
    hasServerChanges,
    touched: Object.fromEntries(
      Object.entries(matches ? touchedFields : {})
        .filter(([name]) => name.startsWith("f"))
        .map(([name, value]) => [decode(name), value]),
    ),
    fieldErrors,
    validationError: matches ? formIssue(errors._form) : null,
    isDirty: matches && isDirty,
    isValidating: matches && isValidating,
    field,
    reset,
    diagnostics: { pendingAction: action.pendingAction, error: action.error },
  };
}
