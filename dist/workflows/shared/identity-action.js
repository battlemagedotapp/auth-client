import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import { useClientBoundary } from "../../client/provider-context.js";
import { workflowLocks } from "./locks.js";
import { actionControl, ignored, operationFeedback, useCommittedRef, } from "./action.js";
import { identityOperationObsolete } from "./identity-sync.js";
function createIdentityOperations() {
    const listeners = new Set();
    const visible = new Map();
    const active = new Map();
    const retireCallbacks = new Map();
    let revision = 0;
    const changed = () => {
        revision++;
        for (const listener of listeners)
            listener();
    };
    return {
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        getSnapshot: () => revision,
        configure(scope, owner, onRetire) {
            retireCallbacks.set(scope, { owner, callback: onRetire });
        },
        view(scope) {
            return visible.get(scope);
        },
        begin(scope, owner, target) {
            if (active.has(scope))
                return null;
            const lease = {
                owner,
                scope,
                controller: new AbortController(),
                active: true,
                callbackAllowed: true,
            };
            active.set(scope, lease);
            visible.set(scope, { owner, pending: target, error: null });
            changed();
            return lease;
        },
        adopt(scope, owner) {
            const lease = active.get(scope);
            if (!lease)
                return;
            lease.owner = owner;
            const state = visible.get(scope);
            if (state)
                visible.set(scope, { ...state, owner });
            changed();
        },
        pending(lease, target) {
            if (active.get(lease.scope) !== lease)
                return;
            const state = visible.get(lease.scope);
            visible.set(lease.scope, {
                owner: lease.owner,
                pending: target,
                error: state?.error ?? null,
                target: state?.target,
            });
            changed();
        },
        fail(lease, target, error) {
            if (active.get(lease.scope) !== lease)
                return;
            visible.set(lease.scope, { owner: lease.owner, pending: null, error, target });
            changed();
        },
        finish(lease) {
            if (active.get(lease.scope) !== lease)
                return;
            lease.active = false;
            active.delete(lease.scope);
            const state = visible.get(lease.scope);
            if (state?.pending)
                visible.set(lease.scope, { ...state, pending: null });
            changed();
        },
        reset(scope) {
            if (active.has(scope))
                return;
            if (visible.delete(scope))
                changed();
        },
        retire(scope, owner) {
            const lease = active.get(scope);
            const state = visible.get(scope);
            if (lease?.owner !== owner && state?.owner !== owner)
                return;
            const retirement = retireCallbacks.get(scope);
            if (retirement?.owner === owner) {
                retirement.callback?.();
                retireCallbacks.delete(scope);
            }
            if (lease?.owner === owner) {
                lease.callbackAllowed = false;
                lease.controller.abort();
            }
            if (state?.owner === owner)
                visible.delete(scope);
            changed();
        },
        clearReceipt(scope, owner) {
            const retirement = retireCallbacks.get(scope);
            if (retirement?.owner !== owner)
                return;
            retirement.callback?.();
            retireCallbacks.delete(scope);
        },
    };
}
const stores = new WeakMap();
const conflict = Symbol("identity workflow conflict");
function identityOperations(runtime) {
    let store = stores.get(runtime);
    if (!store) {
        store = createIdentityOperations();
        stores.set(runtime, store);
    }
    return store;
}
/** Coordinates operations whose successful result intentionally changes session identity. */
export function useIdentityAction(runtime, scope, availability, enabled = true, options = {}, lifecycleOptions = {}) {
    const callbacks = useCommittedRef(options);
    const { identity, disposed } = useClientBoundary(runtime);
    const locks = workflowLocks(runtime);
    const store = identityOperations(runtime);
    const [owner] = useState(() => Symbol());
    store.configure(scope, owner, lifecycleOptions.onRetire);
    useSyncExternalStore(locks.subscribe, locks.getSnapshot, locks.getSnapshot);
    useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    useSyncExternalStore(runtime.subscribeAuth, runtime.getAuthRevision, runtime.getAuthRevision);
    const observation = runtime.authObservation;
    const view = store.view(scope);
    const providerRevision = runtime.attachmentRevision;
    useLayoutEffect(() => {
        store.adopt(scope, owner);
        return () => {
            queueMicrotask(() => {
                if (runtime.attachmentRevision === providerRevision || runtime.attached === 0)
                    store.retire(scope, owner);
            });
        };
    }, [runtime, scope, owner, providerRevision, store]);
    const sessionSettled = !observation.sessionPending;
    const nominallyAvailable = enabled &&
        !disposed &&
        sessionSettled &&
        (availability === "settled" ||
            (availability === "guest" ? !observation.userId : observation.ready));
    const available = nominallyAvailable ||
        (enabled && !disposed && (view?.pending != null || view?.error?.writeSucceeded === true));
    const current = () => !runtime.disposed;
    const busy = () => store.view(scope)?.pending != null;
    function reset() {
        store.reset(scope);
    }
    async function run(initialTarget, work, alreadyWritten = false) {
        if (!current())
            return ignored("obsolete");
        if (!available)
            return ignored("disabled");
        if (busy())
            return ignored("busy");
        const lock = locks.acquire(initialTarget, runtime.generation);
        if (!lock)
            return ignored("busy");
        const lease = store.begin(scope, owner, initialTarget);
        if (!lease) {
            lock.release();
            return ignored("busy");
        }
        let target = initialTarget;
        let phase = "write";
        let writeSucceeded = alreadyWritten;
        let completionDelivered = false;
        const valid = () => current() && lease.active && lease.callbackAllowed;
        try {
            const data = await work({
                current: valid,
                signal: lease.controller.signal,
                phase: (next) => {
                    phase = next;
                },
                complete: async (callback) => {
                    if (!valid())
                        throw new Error("Obsolete workflow completion");
                    phase = "callback";
                    completionDelivered = true;
                    await callback();
                },
                write: async (fn, nextTarget) => {
                    if (!valid())
                        throw new Error("Obsolete workflow");
                    if (nextTarget) {
                        target = {
                            ...target,
                            ...(typeof nextTarget === "string" ? { invitationId: nextTarget } : nextTarget),
                        };
                        if (!lock.extend(target))
                            throw conflict;
                        store.pending(lease, target);
                    }
                    const result = await fn();
                    writeSucceeded = true;
                    return result;
                },
            });
            if (!valid() && !completionDelivered)
                return ignored("obsolete");
            return { status: "success", data };
        }
        catch (cause) {
            if (!valid() && !completionDelivered)
                return ignored("obsolete");
            if (cause === conflict)
                return ignored("busy");
            if (cause === identityOperationObsolete) {
                store.clearReceipt(scope, owner);
                return ignored("obsolete");
            }
            const error = { phase, cause, writeSucceeded };
            store.fail(lease, target, error);
            callbacks.current.onError?.({ target, error: cause, diagnostics: error });
            return { status: "error", error };
        }
        finally {
            lock.release();
            store.finish(lease);
        }
    }
    function control(target, reason = null) {
        const visible = store.view(scope);
        return actionControl(available, visible?.pending, target, locks.conflicts(target, runtime.generation), reason);
    }
    return {
        control,
        feedback: (recoveries = []) => operationFeedback(view, recoveries),
        owner,
        actorId: observation.userId ?? identity.userId,
        available,
        current,
        busy,
        canEdit: () => current() && available && !busy(),
        run,
        reset,
        isBusy: view?.pending != null,
        pendingAction: view?.pending ?? null,
        error: view?.error ?? null,
    };
}
//# sourceMappingURL=identity-action.js.map