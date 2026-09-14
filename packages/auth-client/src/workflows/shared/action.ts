import { useLayoutEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useClientBoundary } from "../../client/provider-context.js";
import type { CacheRuntime } from "../../cache/query-cache.js";
import type {
  WorkflowError,
  WorkflowOutcome,
  WorkflowPendingAction,
  PolicyDecision,
} from "./types.js";

export type Values = Record<string, unknown>;
export const asRecord = (value: unknown): Values | undefined =>
  value !== null && typeof value === "object" ? (value as Values) : undefined;
export const asRecords = (value: unknown): Values[] =>
  Array.isArray(value) ? value.map(asRecord).filter((row): row is Values => !!row) : [];
export const ignored = (
  reason: "disabled" | "busy" | "obsolete" | "unavailable",
): WorkflowOutcome<never> => ({ status: "ignored", reason });
const conflict = Symbol("workflow conflict");
const unavailable = Symbol("workflow unavailable");
export function requireAvailable(condition: unknown): asserts condition {
  if (!condition) throw unavailable;
}
export function enforcePolicy(decision: PolicyDecision) {
  if (!decision.allowed) throw { code: decision.code };
}
export const allowed: PolicyDecision = { allowed: true };
export const denied = (code: string): PolicyDecision => ({ allowed: false, code });
export function useCommittedRef<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
export function getActionState(action: ReturnType<typeof useWorkflowAction>) {
  return {
    isBusy: action.isBusy,
    pendingAction: action.pendingAction,
    error: action.error,
    reset: action.reset,
  };
}
type Lock = { key: string; exclusive: boolean };
const locks = new WeakMap<CacheRuntime, Map<symbol, Lock[]>>();
export type ActionExecution = {
  write(
    fn: () => Promise<unknown>,
    target?: string | Partial<WorkflowPendingAction>,
  ): Promise<unknown>;
  current(): boolean;
  phase(phase: WorkflowError["phase"]): void;
  signal: AbortSignal;
};

/** TanStack observes writes; this coordinator owns only locks and guarded continuations. */
export function useWorkflowAction(runtime: CacheRuntime, scope: string, enabled = true) {
  const { identity, disposed } = useClientBoundary(runtime);
  const key = JSON.stringify([identity, scope, disposed]);
  const [boundary, setBoundary] = useState(() => ({ key, owner: Symbol() }));
  const currentBoundary = boundary.key === key ? boundary : { key, owner: Symbol() };
  if (boundary.key !== key) setBoundary(currentBoundary);
  const { owner } = currentBoundary;
  const lifecycle = useRef({
    owner,
    active: false,
    busy: false,
    available: false,
    suspension: 0,
    controllers: new Set<AbortController>(),
  });
  const available = enabled && identity.ready && !disposed;
  const { reset: resetMutation, mutateAsync } = useMutation(
    {
      mutationFn: (write: () => Promise<unknown>) => write(),
      retry: false,
      gcTime: 0,
      networkMode: "always",
    },
    runtime.cache,
  );
  const [feedback, setFeedback] = useState<{
    owner: symbol;
    pending: WorkflowPendingAction | null;
    error: WorkflowError | null;
  }>();
  useLayoutEffect(() => {
    const lease = {
      owner,
      active: true,
      busy: false,
      available: false,
      suspension: 0,
      controllers: new Set<AbortController>(),
    };
    lifecycle.current = lease;
    resetMutation();
    return () => {
      lease.active = false;
      for (const controller of lease.controllers) controller.abort();
      resetMutation();
    };
  }, [owner, resetMutation]);
  useLayoutEffect(() => {
    lifecycle.current.available = available;
    if (!available) {
      lifecycle.current.suspension++;
      for (const controller of lifecycle.current.controllers) controller.abort();
    }
  }, [owner, available]);
  const current = () =>
    lifecycle.current.active && lifecycle.current.owner === owner && !runtime.disposed;
  const busy = () => lifecycle.current.owner === owner && lifecycle.current.busy;
  function reset() {
    if (current() && !busy()) {
      resetMutation();
      setFeedback(undefined);
    }
  }
  async function run<T>(
    pending: WorkflowPendingAction,
    work: (transaction: ActionExecution) => Promise<T>,
    alreadyWritten = false,
  ): Promise<WorkflowOutcome<T>> {
    if (!current()) return ignored("obsolete");
    if (!lifecycle.current.available) return ignored("disabled");
    if (busy()) return ignored("busy");
    const generation = runtime.generation;
    let shared = locks.get(runtime);
    if (!shared) {
      shared = new Map();
      locks.set(runtime, shared);
    }
    const token = Symbol();
    const acquired: Lock[] = [];
    function claim(target: WorkflowPendingAction) {
      const requested: Lock[] = [];
      const add = (kind: string, id: string, exclusive = true) =>
        requested.push({ key: JSON.stringify([generation, kind, id]), exclusive });
      if (target.organizationId)
        add(
          "organization",
          target.organizationId,
          target.operation === "delete" || target.operation === "leave",
        );
      if (target.invitationId) add("invitation", target.invitationId);
      if (target.memberId) add("member", `${target.organizationId}:${target.memberId}`);
      if (target.operation.startsWith("revoke"))
        add("sessions", identity.userId ?? "", target.operation !== "revokeSession");
      if (target.sessionId) add("session", target.sessionId);
      for (const [holder, held] of shared!)
        if (
          holder !== token &&
          requested.some((request) =>
            held.some((lock) => lock.key === request.key && (lock.exclusive || request.exclusive)),
          )
        )
          throw conflict;
      acquired.push(...requested);
      shared!.set(token, acquired);
    }
    try {
      claim(pending);
    } catch {
      return ignored("busy");
    }
    const lease = lifecycle.current;
    lease.busy = true;
    const controller = new AbortController();
    lease.controllers.add(controller);
    const suspension = lease.suspension;
    setFeedback({ owner, pending, error: null });
    let phase: WorkflowError["phase"] = "write";
    let writeSucceeded = alreadyWritten;
    const valid = () =>
      current() &&
      lifecycle.current === lease &&
      lease.available &&
      lease.suspension === suspension &&
      generation === runtime.generation;
    try {
      const data = await work({
        current: valid,
        signal: controller.signal,
        phase: (next) => {
          phase = next;
        },
        write: async (fn, target) => {
          if (!valid()) throw new Error("Obsolete workflow");
          if (target) {
            pending = {
              ...pending,
              ...(typeof target === "string" ? { invitationId: target } : target),
            };
            claim(pending);
            setFeedback({ owner, pending, error: null });
          }
          const result = await mutateAsync(() => {
            if (!valid()) throw new Error("Obsolete workflow");
            return fn();
          });
          writeSucceeded = true;
          return result;
        },
      });
      if (!valid()) return ignored("obsolete");
      setFeedback({ owner, pending: null, error: null });
      return { status: "success", data };
    } catch (cause) {
      if (!valid()) return ignored("obsolete");
      if (cause === conflict) return ignored("busy");
      if (cause === unavailable) return ignored("unavailable");
      const error = { phase, cause, writeSucceeded };
      setFeedback({ owner, pending: null, error });
      return { status: "error", error };
    } finally {
      shared.delete(token);
      lease.controllers.delete(controller);
      if (current() && lifecycle.current === lease) {
        lease.busy = false;
        resetMutation();
        setFeedback((previous) =>
          previous?.owner === owner ? { ...previous, pending: null } : previous,
        );
      }
    }
  }
  const visible = available && feedback?.owner === owner ? feedback : undefined;
  return {
    owner,
    actorId: identity.userId,
    available,
    current,
    busy,
    canEdit: () => current() && lifecycle.current.available && !busy(),
    run,
    reset,
    isBusy: visible?.pending != null,
    pendingAction: visible?.pending ?? null,
    error: visible?.error ?? null,
  };
}
