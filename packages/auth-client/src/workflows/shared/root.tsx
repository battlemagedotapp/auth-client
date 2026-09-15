import { createContext, useContext, type ReactNode } from "react";

export type WorkflowDefinition<Options, State> = {
  Root: (props: Options & { children?: ReactNode }) => ReactNode;
  useWorkflow: (options: Options) => State;
  useWorkflowContext: () => State;
};

/** Bind a context to one concrete workflow type, not to a provider's runtime props. */
export function defineWorkflow<Options, State>(
  useWorkflow: (options: Options) => State,
): WorkflowDefinition<Options, State> {
  const Context = createContext<{ state: State } | null>(null);
  function Root({ children, ...options }: Options & { children?: ReactNode }) {
    const state = useWorkflow(options as Options);
    return <Context value={{ state }}>{children}</Context>;
  }
  function useWorkflowContext() {
    const context = useContext(Context);
    if (!context) throw new Error("Workflow controls must be rendered inside their matching root");
    return context.state;
  }
  return { Root, useWorkflow, useWorkflowContext };
}

/** Name a root contract once while retaining the conventional public surface. */
export function exposeWorkflow<Options, State, Definition>(
  name: string,
  workflow: WorkflowDefinition<Options, State>,
  define?: Definition,
) {
  return {
    [name]: workflow.Root,
    [`use${name}`]: workflow.useWorkflow,
    [`use${name}Context`]: workflow.useWorkflowContext,
    ...(define === undefined ? {} : { [`define${name}`]: define }),
  };
}

export function defineSchemaWorkflow<Options, State, Schema>(
  useWorkflow: (options: Options) => State,
  schema: Schema,
) {
  return defineWorkflow((options: Options) =>
    useWorkflow(Object.assign({}, options, { schema }) as Options),
  );
}
