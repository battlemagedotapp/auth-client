import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext } from "react";
/** Bind a context to one concrete workflow type, not to a provider's runtime props. */
export function defineWorkflow(useWorkflow) {
    const Context = createContext(null);
    function Root({ children, ...options }) {
        const state = useWorkflow(options);
        return _jsx(Context, { value: { state }, children: children });
    }
    function useWorkflowContext() {
        const context = useContext(Context);
        if (!context)
            throw new Error("Workflow controls must be rendered inside their matching root");
        return context.state;
    }
    return { Root, useWorkflow, useWorkflowContext };
}
/** Name a root contract once while retaining the conventional public surface. */
export function exposeWorkflow(name, workflow, define) {
    return {
        [name]: workflow.Root,
        [`use${name}`]: workflow.useWorkflow,
        [`use${name}Context`]: workflow.useWorkflowContext,
        ...(define === undefined ? {} : { [`define${name}`]: define }),
    };
}
export function defineSchemaWorkflow(useWorkflow, schema) {
    return defineWorkflow((options) => useWorkflow(Object.assign({}, options, { schema })));
}
//# sourceMappingURL=root.js.map