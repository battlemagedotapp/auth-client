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
/** Name a root contract once while retaining the conventional public surface. */
export declare function exposeWorkflow<Options, State, Definition>(name: string, workflow: WorkflowDefinition<Options, State>, define?: Definition): {
    [x: string]: ((props: Options & {
        children?: ReactNode;
    }) => ReactNode) | ((options: Options) => State) | (Definition & ({} | null));
};
export declare function defineSchemaWorkflow<Options, State, Schema>(useWorkflow: (options: Options) => State, schema: Schema): WorkflowDefinition<Options, State>;
//# sourceMappingURL=root.d.ts.map