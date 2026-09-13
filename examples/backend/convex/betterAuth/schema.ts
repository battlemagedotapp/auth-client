import { defineSchema } from "convex/server";
import { tables } from "./generatedSchema";
export default defineSchema({
  ...tables,
  session: tables.session.index("userId_expiresAt", ["userId", "expiresAt"]),
  invitation: tables.invitation
    .index("email_organizationId_status", ["email", "organizationId", "status"])
    .index("organizationId_status", ["organizationId", "status"]),
  member: tables.member.index("organizationId_userId", ["organizationId", "userId"]),
});
