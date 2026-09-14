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
