# Admin ship-order endpoint (POST /orders/:id/ship)

(Written by the Reporter; saved to disk by the orchestrator because the Reporter's Write was refused. File list verified with `git status`.)

Admins can mark a pending order as shipped with `POST /orders/:id/ship`. The server sets `shippedAt` (ISO UTC) and `GET /orders/:id` returns it. Customers get 403; cancelled and already shipped orders get 409.

## Acceptance criteria
Tests are in `test/orders.test.js` (`ship AC<n>` and `shippedAt AC<n>`); attack tests are in `test/ship.adversary.test.js`.

| AC | Criterion | Tests | Result |
| --- | --- | --- | --- |
| AC1 | Admin ships pending 103: 200, Bob sees it | ship AC1 | Pass |
| AC2 | Customer ships own order: 403, unchanged | ship AC2 | Pass |
| AC3 | Same 403 for foreign, missing, shipped, cancelled | ship AC3 | Pass |
| AC4 | Admin ships shipped 102: 409 already_shipped | ship AC4 | Pass |
| AC5 | Admin ships cancelled 101: 409 not_shippable | ship AC5 | Pass |
| AC6 | Admin ships missing order: 404 | ship AC6 | Pass |
| AC7 | Missing/bad auth: 401 | ship AC7 | Pass |
| AC8 | Bad id / wrong method: 404 Route not found | ship AC8 | Pass |
| AC9 | Pre-existing tests unchanged and passing | full suite | Pass |
| AC10 | shippedAt ISO UTC within request window | shippedAt AC10 | Pass |
| AC11 | GET returns same shippedAt | shippedAt AC11 | Pass |
| AC12 | Re-ship 409, shippedAt unchanged | shippedAt AC12 | Pass |
| AC13 | Unshipped/seed orders have no shippedAt key | shippedAt AC13 | Pass |
| AC14 | Shipped order cannot be cancelled | ship AC14 | Pass |
| AC15 | Request body cannot set status/shippedAt/total/customerId | shippedAt AC15 | Pass |

## Quality checks
| Check | Result |
| --- | --- |
| Tests | 66 passed, 0 failed (baseline 31/0), run by the orchestrator (`chunks/2/gate-a-3.md`) |
| SQA sign-off | Signed off, AC1-AC15 traced |
| Adversary | 20 attack tests added, 0 findings |
| Runtime sweeps | Chunk 1: 41 req, chunk 2: 45 req, final: 41 req; 0 5xx, 0 slow. Final sweep did not ship an order successfully nor test the 401 case (covered by earlier sweeps, tests, personas) |
| Personas | role-boundary-user, careless-user: 0 findings (run once, at UAT) |
| Reviews | Behavior Verifier, Product Manager: no blocker or major; Supervisor checks: correct |

No blocker or major finding is open. Minors are fixed or accepted with reasons in `findings.json`.

## Roles that didn't run
Researcher (no external dependency), Architecture Guardian (no structural change), UI/UX QA (API only).

## Files (`git status`)
- Modified: `src/app.js` (+12), `test/orders.test.js` (+167), `test/helpers.js` (`raw`, `withBody` helpers; not in the plan's file list)
- New: `test/ship.adversary.test.js` (not in the plan's file list)
- Not touched: `src/store.js`. `.codewright/` does not appear in `git status`.

## Needs your confirmation
1. **Customers get 403 `forbidden`, not 404**, for any order id, checked before lookup. First 403 in the API; existing refusals use 404 (BR-004, BR-014). Chosen by the harness default, not by you.
2. **Seeded order 102 has no `shippedAt`**: it is `shipped` in the seed and was not backfilled. Clients must treat `shippedAt` as optional. Harness default.
3. **Process notes:** reviewers (Behavior Verifier, SQA, final Runtime Monitor) lacked Bash, so the orchestrator ran the suite and the final sweep; the orchestrator wrote `chunks/2/product-manager-1.json` from the PM's report; personas ran only at UAT, not per chunk; plan round-2 reviews have no separate record files.

## Check by hand
- Run `npm test` yourself (no reviewer ran it independently).
- Ship 103 as admin, GET it as Bob, then re-ship and cancel to see the 409s.
- Knowledge base (`business-rules.md`, `glossary.md`) is updated by the sync step that follows this report.

## Suggested commit message
```
Add admin-only POST /orders/:id/ship endpoint

Admins can move a pending order to shipped. The server sets shippedAt
(ISO 8601 UTC) and GET /orders/:id returns it. Customers get 403
forbidden before any order lookup. Shipped orders return 409
already_shipped, and cancelled orders return 409 not_shippable. The
request body is ignored. Seeded order 102 is left without shippedAt.

Adds ship and shippedAt tests, test helpers, and adversary regression
tests.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UVdcxfs8oCy1dUXrs5F95Z
```
