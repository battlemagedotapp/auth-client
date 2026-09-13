// Schema-generation entry point only: the CLI inspects options without executing database methods.
import type { GenericCtx } from "@convex-dev/better-auth";
import type { DataModel } from "../_generated/dataModel";
import { createAuth } from "../auth";
export const auth = createAuth({} as GenericCtx<DataModel>);
