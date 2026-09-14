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
//# sourceMappingURL=root.js.map