# Member pagination and Convex components

Reviewed against Convex documentation and the installed Better Auth 1.6.22 / Convex Better Auth 0.12.5 baseline on 2026-09-14.

## What Convex supports

Regular application queries support cursor pagination with `paginationOptsValidator`, `.paginate()`, and the React paginated-query hook. Pages represent reactive ranges, so their sizes can change after inserts or deletions. The requested item count is not a permanent fixed page size. [Convex pagination](https://docs.convex.dev/database/pagination)

Components have a different boundary. Convex recommends `paginator` from `convex-helpers` inside a component and the helper package's compatible React pagination hook for component-backed reactive pagination. Authentication belongs in the parent application wrapper; a component does not receive the parent's `ctx.auth`. Component function references are not directly public browser APIs. [Component authoring](https://docs.convex.dev/components/authoring#pagination)

Reactive adjacent pages need pinned boundaries: fetching “the first N rows” independently from “N rows after cursor X” can create gaps or overlaps when earlier records change. The helper's end-cursor/index-key facilities address that boundary. Hand-written arrays of independent subscriptions are not sufficient. [Convex pagination patterns](https://stack.convex.dev/pagination#stitching-the-pages-together), [helper implementation](https://github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/server/pagination.ts)

## Where Better Auth's contract differs

The installed integration already uses `convex-helpers/server/stream` internally. Its component reader returns cursor-bearing results; the Better Auth database adapter consumes those pages in `handlePagination` and returns an array to Better Auth. It explicitly rejects nonzero offsets. The public organization `listMembers` endpoint exposes `limit` and `offset`, and returns `{ members, total }`; it does not expose the internal continuation cursor. Installing a React pagination hook cannot recover that discarded cursor. [Pinned integration adapter](https://github.com/get-convex/better-auth/blob/v0.12.5/src/client/adapter.ts), [component reader implementation](https://github.com/get-convex/better-auth/blob/v0.12.5/src/client/adapter-utils.ts)

The current workflow therefore remains an HTTP endpoint adapter. It requests an ordered prefix and slices it for the visible page. This is a compatibility implementation, not a Convex limitation or a scalable cursor implementation. Larger page numbers increase transfer and dependency observation; upstream sorting, filtering, count behavior, and database limits still apply.

## What a proper cursor extension requires

The following is a proposed architectural extension, not implemented by this housekeeping pass:

1. Add an application-authenticated member-page query that authorizes the current actor's organization access before calling the component. Never re-export arbitrary adapter queries as a public reader.
2. Read the indexed member range with the component-compatible helper. Join visible user fields within bounded reads and provide validators for arguments and results.
3. Specify the projection explicitly: permitted custom fields, public user fields, ID mapping, dates, and filter/sort support. Raw component documents are not automatically the public Better Auth endpoint response.
4. Let the helper manage reactive page boundaries. Prefer cursor/load-more semantics; arbitrary numbered-page jumps and exact totals are separate requirements, not free cursor operations.
5. Keep one authoritative member read path. Direct Convex member data would not need a second HTTP cache plus invalidation for the same page. Other supported Better Auth endpoints can retain the existing cache.
6. Test tenant isolation, access removal, custom-field projection, insertion/deletion at page boundaries, scope resets, subscription cleanup, and large result sets before replacing the existing workflow transport.

This requires an explicit data-query contract alongside today's signal-only API. It is feasible with Convex components, but treating it as a small frontend hook substitution would bypass the library's current response and authorization guarantees.
