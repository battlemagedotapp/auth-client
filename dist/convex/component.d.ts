import { type Infer } from "convex/values";
declare const metadata: import("convex/values").VUnion<{
    organizationId?: string | undefined;
    email?: string | undefined;
    inviterId?: string | undefined;
    _id: string;
} | null, [import("convex/values").VNull<null, "required">, import("convex/values").VObject<{
    organizationId?: string | undefined;
    email?: string | undefined;
    inviterId?: string | undefined;
    _id: string;
}, {
    _id: import("convex/values").VString<string, "required">;
    email: import("convex/values").VString<string | undefined, "optional">;
    organizationId: import("convex/values").VString<string | undefined, "optional">;
    inviterId: import("convex/values").VString<string | undefined, "optional">;
}, "required", "organizationId" | "_id" | "email" | "inviterId">], "required", "organizationId" | "_id" | "email" | "inviterId">;
export type LookupMetadata = Infer<typeof metadata>;
/** Register inside the local Better Auth component, never in the parent app. */
export declare const lookup: import("convex/server").RegisteredQuery<"public", {
    userId?: string | undefined;
    organizationId?: string | undefined;
    id?: string | undefined;
    email?: string | undefined;
    slug?: string | undefined;
    model: "organization" | "invitation" | "member" | "user";
}, Promise<{
    organizationId?: string | undefined;
    email?: string | undefined;
    inviterId?: string | undefined;
    _id: string;
} | null>>;
export {};
//# sourceMappingURL=component.d.ts.map