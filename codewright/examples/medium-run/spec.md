# Spec: Admin ship-order endpoint

## Request
--mode medium Admins can mark a pending order as shipped with POST /orders/:id/ship. Customers cannot ship orders. Only pending orders can be shipped; shipping a cancelled or already shipped order is an error. A shipped order records shippedAt, which GET /orders/:id returns.

## Goal
Add `POST /orders/:id/ship`, which lets an admin move a `pending` order to `shipped` and stamps `shippedAt`. Customers are refused, and so are cancelled or already shipped orders. `GET /orders/:id` returns `shippedAt` because it returns the stored order object.

## Out of scope
- A request body, such as a carrier, tracking number or a client-supplied `shippedAt`. The endpoint reads no body.
- Recording who shipped the order, notifications, audit log, or stock changes.
- Backfilling `shippedAt` on seeded order 102 (already `shipped` in the seed), or any change to `src/store.js`.
- Any other status transition (for example un-shipping), or new statuses.
- Changing the cancel endpoint, the list filter or `STATUSES`. `shipped` is already filterable.
- A general role or permission helper. One inline admin check is enough for one route.
- Fixing the existing test-cleanup issue or the test gaps listed in `modules/tests.md`.

## Acceptance criteria
Seed data: `t-alice` (customer, id 1) owns 101 (pending) and 102 (shipped, no `shippedAt`). `t-bob` (customer, id 2) owns 103 (pending). `t-admin` (id 3) is the admin.

Chunk 1: endpoint, guard and transitions
- AC1 [api] Given order 103 is pending, when the admin sends `POST /orders/103/ship`, then the response is 200, `data` contains `id: 103, customerId: 2, status: "shipped", total: 900`, and a later `GET /orders/103` by Bob shows `status: "shipped"`.
- AC2 [api] Given order 101 is pending and owned by Alice, when Alice sends `POST /orders/101/ship`, then the response is 403 with body `{ "error": { "code": "forbidden", "message": "Only admins can ship orders" } }`, and a later `GET /orders/101` shows `status: "pending"` and no `shippedAt` key.
- AC3 [api] Given order 101 belongs to Alice, when Bob sends `POST /orders/101/ship`, or Alice sends `POST /orders/999/ship` (no such order), or Alice sends `POST /orders/102/ship` (her shipped order), or Alice cancels 101 via `POST /orders/101/cancel` and then sends `POST /orders/101/ship`, then each ship response is the same 403 body as AC2 (never 404 or 409), so the response does not reveal whether the order exists, who owns it or its status; afterwards `GET /orders/101` by Alice has no `shippedAt` key.
- AC4 [api] Given order 102 is shipped, when the admin sends `POST /orders/102/ship`, then the response is 409 with body `{ "error": { "code": "already_shipped", "message": "Order is already shipped" } }`.
- AC5 [api] Given order 101 was cancelled (by Alice via `POST /orders/101/cancel`), when the admin sends `POST /orders/101/ship`, then the response is 409 with body `{ "error": { "code": "not_shippable", "message": "Only pending orders can be shipped" } }`, and a later `GET /orders/101` still shows `status: "cancelled"` and no `shippedAt` key.
- AC6 [api] Given orders 999 and 0 do not exist, when the admin sends `POST /orders/999/ship` or `POST /orders/0/ship`, then each response is 404 with body `{ "error": { "code": "not_found", "message": "Order not found" } }`.
- AC7 [api] Given any of these `Authorization` headers: none, `Bearer t-nobody`, `Basic t-admin` (wrong scheme), `Bearer ` (empty token) or `Bearer  t-admin` (two spaces), when a client sends `POST /orders/103/ship`, then each response is 401 with body `{ "error": { "code": "unauthenticated", "message": "Missing or invalid token" } }`, and order 103 stays pending. (Note: a bare `t-admin` header without the `Bearer ` prefix is accepted by the existing `currentUser`; that is existing behavior and not asserted here.)
- AC8 [api] Given the admin token, and separately Bob's token `t-bob`, when the client sends `POST /orders/abc/ship`, `POST /orders/-1/ship`, `POST /orders/1.5/ship`, or `GET`, `PUT` or `DELETE` on `/orders/103/ship`, then every response is 404 with body `{ "error": { "code": "not_found", "message": "Route not found" } }` (for Bob too, not 403), and order 103 stays pending.
- AC9 [api] Given the change is in place, when `npm test` runs, then every pre-existing test in `test/orders.test.js` that passes on the base commit still passes, with its code unchanged (the pass/fail set of pre-existing tests matches the base-commit baseline; known existing issues in `modules/tests.md` are not counted against this change).
- AC14 [api] Given the admin has shipped order 103, when Bob sends `POST /orders/103/cancel`, and separately the admin sends `POST /orders/103/cancel`, then each response is 409 with body `{ "error": { "code": "not_cancellable", "message": "Only pending orders can be cancelled" } }`, and a later `GET /orders/103` still shows `status: "shipped"`. (Existing BR-016, now reachable through the ship endpoint.)

Chunk 2: shippedAt
- AC10 [api] Given order 103 is pending, when the admin sends `POST /orders/103/ship`, then `data.shippedAt` is a string equal to `new Date(data.shippedAt).toISOString()` (ISO 8601 UTC with milliseconds), and its time is at or after a timestamp taken just before the request and at or before one taken just after the response.
- AC11 [api] Given the admin has shipped order 103, when Bob sends `GET /orders/103` and the admin sends `GET /orders/103`, then both responses are 200 and `data.shippedAt` equals the `shippedAt` returned by the ship call.
- AC12 [api] Given the admin has shipped order 103, when the test waits at least 5 ms (for example `await new Promise(r => setTimeout(r, 5))`) so the clock has moved, and the admin sends `POST /orders/103/ship` again, then the response is the 409 `already_shipped` body from AC4, and a later `GET /orders/103` returns the original `shippedAt` unchanged.
- AC13 [api] Given a fresh app, when anyone sends `GET /orders/101`, `GET /orders/102` or `GET /orders/103`, then `data` has no `shippedAt` key (orders not shipped through the endpoint, including seeded 102, do not carry the field). This is a regression guard: it passes before the change and fails if the implementation adds `shippedAt: null` or backfills the seed.
- AC15 [api] Given order 103 is pending, when the admin sends `POST /orders/103/ship` with header `Content-Type: application/json` and body `{"status":"cancelled","shippedAt":"2000-01-01T00:00:00.000Z","total":1,"customerId":1}`, then the response is 200 with `status: "shipped"`, `total: 900`, `customerId: 2`, and `shippedAt` is not `"2000-01-01T00:00:00.000Z"` but satisfies the time window of AC10; a later `GET /orders/103` shows the same values.

## Contract
### Routes
`POST /orders/:id/ship`. Inline handler in `createApp` in `src/app.js`, placed next to the cancel handler and following its pattern.
- Path: `^/orders/(\d+)/ship$`. Digits only (BR-006); the id is converted with `Number(...)`.
- Method: `POST` only. Other methods on this path fall through to the existing 404 `"Route not found"`.
- Guard: bearer token (existing global check), then `user.role === 'admin'`. `canView` is not needed for authorization because admins can view every order.
- Request body: none. Never read; any body sent is ignored (AC15).
- Checks, in this order, returning at the first match:
  1. Missing or invalid token → 401 `{ error: { code: "unauthenticated", message: "Missing or invalid token" } }` (existing global check, unchanged).
  2. `user.role !== 'admin'` → 403 `{ error: { code: "forbidden", message: "Only admins can ship orders" } }`. Done before the order lookup, so a customer gets the same answer for own, foreign and missing orders.
  3. Order not found → 404 `{ error: { code: "not_found", message: "Order not found" } }`.
  4. `order.status === "shipped"` → 409 `{ error: { code: "already_shipped", message: "Order is already shipped" } }`.
  5. `order.status !== "pending"` (covers `cancelled`) → 409 `{ error: { code: "not_shippable", message: "Only pending orders can be shipped" } }`.
  6. Otherwise set `order.status = "shipped"` and (chunk 2) `order.shippedAt = new Date().toISOString()` on the stored object, then return 200 `{ data: order }`.
- All responses go through `json` and `error` from `src/http.js`.

### GET /orders/:id and GET /orders
No code change. They return the stored object, so `shippedAt` appears once set. Orders without it have no `shippedAt` key (not `null`), which keeps the existing `deepEqual` assertions in `test/orders.test.js` (lines 41, 191) valid.

### Classes and methods
No new functions, files or exports in `src/`. Reuses `currentUser`, `json`, `error`.

### Data
- No schema change. Order objects gain an optional `shippedAt: string` (ISO 8601 UTC, from `Date.prototype.toISOString`), present only on orders shipped through the endpoint.
- Mutated in place in `store.orders`; lasts only for that app instance (BR-007).

### Events, jobs, notifications, config keys
None.

### Tests
Added to `test/orders.test.js` using the existing `withApp` helper. Chunk 1 test names start with `ship AC` (AC1-AC9, AC14); chunk 2 test names start with `shippedAt AC` (AC10-AC13, AC15).

## Business rules
- BR-001, BR-006, BR-007 apply unchanged.
- BR-005 updated: cancel and ship are the two writes; there is still no create.
- BR-013 to BR-016 (cancel) are unchanged. Consequence made explicit: once an admin ships an order, neither the customer nor an admin can cancel it (BR-016, 409 `not_cancellable`; AC14).
- New BR-019: only an admin can ship an order (`POST /orders/:id/ship`); any customer gets 403 `forbidden` before the order is looked up, so existence and status are not revealed (consistent with the intent of BR-004). This is the first 403 in the API and a deliberate break from the 404-for-refusals pattern of BR-004/BR-014 (see open question 1).
- New BR-020: only a `pending` order can be shipped; it becomes `shipped` and the full order is returned with 200.
- New BR-021: shipping an already `shipped` order returns 409 `already_shipped`; shipping an order in any other non-pending status, such as `cancelled`, returns 409 `not_shippable`.
- New BR-022: a successful ship sets `shippedAt` to the server time as an ISO 8601 UTC string; it is never changed afterwards, and orders not shipped through the endpoint have no `shippedAt`.

## Risks
- **Role boundary** (adapter hotspot "missing auth on new routes"): this is the first admin-only action and the first 403 in the API. The admin check must come before the lookup and before any write; tests AC2, AC3 and AC7 pin it.
- **State transition**: no `await` between the status check and the write, so no race today (same as cancel).
- **Inconsistent data**: seeded order 102 is `shipped` without `shippedAt`. Clients must treat `shippedAt` as optional. Backfilling is out of scope.
- **Clock**: `shippedAt` uses server time; tests assert a time window, not an exact value.
- No new dependency. No `product.md` exists in the knowledge base; the plan uses `INDEX.md` and the module files instead.

## Open questions
Each has a recommendation; the contract above already follows it.
1. What does a customer get when trying to ship? — recommended: 403 `forbidden` "Only admins can ship orders", for every order id, checked before the lookup. It tells the customer why without revealing whether an order exists. (Alternative: 404 for all, matching BR-004 literally.)
2. Error codes for refused transitions? — recommended: 409 `already_shipped` for a shipped order and 409 `not_shippable` for a cancelled or other non-pending order, mirroring the cancel endpoint's `already_cancelled` / `not_cancellable`.
3. Format of `shippedAt`, and what unshipped orders show? — recommended: ISO 8601 UTC string from `new Date().toISOString()`; the key is absent (not `null`) on orders without it, so existing responses and tests stay unchanged.
4. Should seeded order 102 get a `shippedAt`? — recommended: no; leave the seed unchanged (tests hard-code seed data). Note this departs from the request's wording "A shipped order records shippedAt" for that one seeded order; clients must treat `shippedAt` as optional.
