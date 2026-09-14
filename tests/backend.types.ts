import {
  defineSchema,
  defineTable,
  type DataModelFromSchemaDefinition,
  makeFunctionReference,
} from "convex/server";
import { v } from "convex/values";
import {
  authSignalTables,
  composeTriggers,
  createSignalQueries,
  type ComponentLookupReference,
} from "../packages/auth-client/src/convex/index.js";
import type { LookupMetadata } from "../packages/auth-client/src/convex/component.js";
const appSchema = defineSchema({ ...authSignalTables, audit: defineTable({ email: v.string() }) });
type DataModel = DataModelFromSchemaDefinition<typeof appSchema>;
const localSchema = defineSchema({ user: defineTable({ email: v.string(), custom: v.number() }) });
composeTriggers<DataModel, typeof localSchema>({
  user: {
    onCreate: async (ctx, user) => {
      await ctx.db.insert("audit", { email: user.email });
      const custom: number = user.custom;
      // @ts-expect-error application schema remains checked
      await ctx.db.insert("audit", { email: 42 });
      // @ts-expect-error auth schema remains checked
      const wrong: string = user.custom;
      void [custom, wrong];
    },
  },
});
const lookup = {} as ComponentLookupReference;
createSignalQueries<DataModel>({
  features: { sessions: true },
  lookup,
  requireVerifiedInvitationEmail: true,
  getAuthUser: async (ctx) => {
    await ctx.db.query("audit").collect();
    // @ts-expect-error unknown application table
    await ctx.db.query("nonexistent").collect();
    return null;
  },
});
// @ts-expect-error arbitrary query output cannot implement component lookup
const wrongLookup: ComponentLookupReference = makeFunctionReference<
  "query",
  { model: "user" },
  number
>("other:query");
void wrongLookup;
type IsAny<T> = 0 extends 1 & T ? true : false;
const metadataNotAny: IsAny<NonNullable<LookupMetadata>["_id"]> = false;
void metadataNotAny;
