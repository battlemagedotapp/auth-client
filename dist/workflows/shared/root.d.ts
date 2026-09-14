import { type ReactNode } from "react";
export type WorkflowDefinition<Options, State> = {
    Root: (props: Options & {
        children?: ReactNode;
    }) => ReactNode;
    useWorkflow: (options: Options) => State;
    useWorkflowContext: () => State;
};
/** Bind a context to one concrete workflow type, not to a provider's runtime props. */
export declare function defineWorkflow<Options, State>(useWorkflow: (options: Options) => State): WorkflowDefinition<Options, State>;
//# sourceMappingURL=root.d.ts.map