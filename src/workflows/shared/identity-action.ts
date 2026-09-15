import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import type { CacheRuntime } from "../../cache/query-cache.js";
import { useClientBoundary } from "../../client/provider-context.js";
import { workflowLocks } from "./locks.js";
import {
  actionControl,
  ignored,
  operationFeedback,
  useCommittedRef,
  type ActionExecution,
  type WorkflowActionController,
} from "./action.js";
import { identityOperationObsolete } from "./identity-sync.js";
import type {
  WorkflowDisabledReason,
  WorkflowError,
  WorkflowFeedback,
  WorkflowFeedbackOptions,
  WorkflowOutcome,
  WorkflowPendingAction,
} from "./types.js";

type VisibleState = {
  owner: symbol;
  pending: WorkflowPendingAction | null;
  error: WorkflowError | null;
  target?: WorkflowPendingAction;
};
type Lease = {
  owner: symbol;
  scope: string;
  controller: AbortController;
  active: boolean;
  callbackAllowed: boolean;
};

function createIdentityOperations() {
  const listeners = new Set<() => void>();
  const visible = new Map<string, VisibleState>();
  const active = new Map<string, Lease>();
  const retireCallbacks = new Map<string, { owner: symbol; callback: (() => void) | undefined }>();
  let revision = 0;
  const changed = () => {
    revision++;
    for (const listener of listeners) listener();
  };
  return {
    subscribe(this: void, listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => revision,
    configure(scope: string, owner: symbol, onRetire?: () => void) {
      retireCallbacks.set(scope, { owner, callback: onRetire });
    },
    view(scope: string) {
      return visible.get(scope);
    },
    begin(scope: string, owner: symbol, target: WorkflowPendingAction) {
      if (active.has(scope)) return null;
      const lease: Lease = {
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
    adopt(scope: string, owner: symbol) {
      const lease = active.get(scope);
      if (!lease) return;
      lease.owner = owner;
      const state = visible.get(scope);
      if (state) visible.set(scope, { ...state, owner });
      changed();
    },
    pending(lease: Lease, target: WorkflowPendingAction | null) {
      if (active.get(lease.scope) !== lease) return;
      const state = visible.get(lease.scope);
      visible.set(lease.scope, {
        owner: lease.owner,
        pending: target,
        error: state?.error ?? null,
        target: state?.target,
      });
      changed();
    },
    fail(lease: Lease, target: WorkflowPendingAction, error: WorkflowError) {
      if (active.get(lease.scope) !== lease) return;
      visible.set(lease.scope, { owner: lease.owner, pending: null, error, target });
      changed();
    },
    finish(lease: Lease) {
      if (active.get(lease.scope) !== lease) return;
      lease.active = false;
      active.delete(lease.scope);
      const state = visible.get(lease.scope);
      if (state?.pending) visible.set(lease.scope, { ...state, pending: null });
      changed();
    },
    reset(scope: string) {
      if (active.has(scope)) return;
      if (visible.delete(scope)) changed();
    },
    retire(scope: string, owner: symbol) {
      const lease = active.get(scope);
      const state = visible.get(scope);
      if (lease?.owner !== owner && state?.owner !== owner) return;
      const retirement = retireCallbacks.get(scope);
      if (retirement?.owner === owner) {
        retirement.callback?.();
        retireCallbacks.delete(scope);
      }
      if (lease?.owner === owner) {
        lease.callbackAllowed = false;
        lease.controller.abort();
      }
      if (state?.owner === owner) visible.delete(scope);
      changed();
    },
    clearReceipt(scope: string, owner: symbol) {
      const retirement = retireCallbacks.get(scope);
      if (retirement?.owner !== owner) return;
      retirement.callback?.();
      retireCallbacks.delete(scope);
    },
  };
}

const stores = new WeakMap<CacheRuntime, ReturnType<typeof createIdentityOperations>>();
const conflict = Symbol("identity workflow conflict");
function identityOperations(runtime: CacheRuntime) {
  let store = stores.get(runtime);
  if (!store) {
    store = createIdentityOperations();
    stores.set(runtime, store);
  }
  return store;
}

type Availability = "guest" | "authenticated" | "settled";

/** Coordinates operations whose successful result intentionally changes session identity. */
export function useIdentityAction(
  runtime: CacheRuntime,
  scope: string,
  availability: Availability,
  enabled = true,
  options: WorkflowFeedbackOptions = {},
  lifecycleOptions: { onRetire?: () => void } = {},
): WorkflowActionController {
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
  const nominallyAvailable =
    enabled &&
    !disposed &&
    sessionSettled &&
    (availability === "settled" ||
      (availability === "guest" ? !observation.userId : observation.ready));
  const available =
    nominallyAvailable ||
    (enabled && !disposed && (view?.pending != null || view?.error?.writeSucceeded === true));
  const current = () => !runtime.disposed;
  const busy = () => store.view(scope)?.pending != null;
  function reset() {
    store.reset(scope);
  }
  async function run<T>(
    initialTarget: WorkflowPendingAction,
    work: (transaction: ActionExecution) => Promise<T>,
    alreadyWritten = false,
  ): Promise<WorkflowOutcome<T>> {
    if (!current()) return ignored("obsolete");
    if (!available) return ignored("disabled");
    if (busy()) return ignored("busy");
    const lock = locks.acquire(initialTarget, runtime.generation);
    if (!lock) return ignored("busy");
    const lease = store.begin(scope, owner, initialTarget);
    if (!lease) {
      lock.release();
      return ignored("busy");
    }
    let target = initialTarget;
    let phase: WorkflowError["phase"] = "write";
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
          if (!valid()) throw new Error("Obsolete workflow completion");
          phase = "callback";
          completionDelivered = true;
          await callback();
        },
        write: async (fn, nextTarget) => {
          if (!valid()) throw new Error("Obsolete workflow");
          if (nextTarget) {
            target = {
              ...target,
              ...(typeof nextTarget === "string" ? { invitationId: nextTarget } : nextTarget),
            };
            if (!lock.extend(target)) throw conflict;
            store.pending(lease, target);
          }
          const result = await fn();
          writeSucceeded = true;
          return result;
        },
      });
      if (!valid() && !completionDelivered) return ignored("obsolete");
      return { status: "success", data };
    } catch (cause) {
      if (!valid() && !completionDelivered) return ignored("obsolete");
      if (cause === conflict) return ignored("busy");
      if (cause === identityOperationObsolete) {
        store.clearReceipt(scope, owner);
        return ignored("obsolete");
      }
      const error = { phase, cause, writeSucceeded };
      store.fail(lease, target, error);
      callbacks.current.onError?.({ target, error: cause, diagnostics: error });
      return { status: "error", error };
    } finally {
      lock.release();
      store.finish(lease);
    }
  }
  function control(target: WorkflowPendingAction, reason: WorkflowDisabledReason | null = null) {
    const visible = store.view(scope);
    return actionControl(
      available,
      visible?.pending,
      target,
      locks.conflicts(target, runtime.generation),
      reason,
    );
  }
  return {
    control,
    feedback: (recoveries: WorkflowFeedback[] = []) => operationFeedback(view, recoveries),
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
