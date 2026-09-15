import type { ReactNode } from "react";
import type { z } from "zod";
import type { FormFieldErrors, WorkflowFeedbackOptions } from "./types.js";

export type WorkflowCallback<T> = (value: T) => void | Promise<void>;
export type WorkflowRootComponent<P> = (props: P & { children?: ReactNode }) => ReactNode;
export type EndpointValues<T, Extra extends PropertyKey = never> = Omit<
  NonNullable<T>,
  "fetchOptions" | Extra
>;
export type OptionalUndefined<T> = {
  [K in keyof T]: {} extends Pick<T, K> ? T[K] | undefined : T[K];
};
export type WorkflowFormSchema<V> = z.ZodType<OptionalUndefined<V>, Record<string, unknown>>;
export type WorkflowFormOptions<V> = WorkflowFeedbackOptions & {
  enabled?: boolean;
  validate?: (values: Readonly<V>) => FormFieldErrors<V> | Promise<FormFieldErrors<V>>;
};
