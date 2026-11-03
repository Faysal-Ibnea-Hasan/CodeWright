# Plan

Size mode: medium — user asked for medium; one module (orders), one new route plus a new field, split into 2 chunks: the guarded transition, then `shippedAt`.

## Chunks
### Chunk 1: POST /orders/:id/ship with admin guard and transitions
- Covers: AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC8, AC9, AC14
- Files: modify `src/app.js`, modify `test/orders.test.js`
- Knowledge to read: `modules/orders.md`, `modules/tests.md`, `business-rules.md`
- Depends on: none
- Tests: `node --test --test-name-pattern=^ship test/*.test.js`, then `npm test` for regressions

### Chunk 2: Record and return shippedAt
- Covers: AC10, AC11, AC12, AC13, AC15 (and AC9 again)
- Files: modify `src/app.js`, modify `test/orders.test.js`
- Knowledge to read: `modules/orders.md`, `modules/tests.md`
- Depends on: Chunk 1
- Tests: `node --test --test-name-pattern=^shippedAt test/*.test.js`, then `npm test` for regressions

## Relevance matrix
| Role | Chunk 1 | Chunk 2 |
| --- | --- | --- |
| Implementer | run: new inline route in `src/app.js` | run: one assignment in the ship handler |
| Test Designer | run: new behavior, new 403/409 codes | run: new response field and its immutability |
| Behavior Verifier | run: BR-001, BR-006, BR-013 to BR-016 (including cancel after ship, AC14) and existing GET/cancel behavior must hold against the base-commit baseline (AC9) | run: existing `deepEqual` assertions on orders must still pass (field absent when unset) |
| Architecture Guardian | skip: no new files, classes, layers or dependencies; same inline-handler pattern as cancel | skip: no structural change |
| Adversary | run: new permission boundary (first admin-only action) and a data write | run: data write with a server-generated value; must confirm a client-supplied body cannot set `shippedAt`, `status` or other fields (AC15) |
| Runtime Monitor | run: new route | run: handler change |
| SQA | run: behavior change | run: behavior change |
| UI/UX QA | skip: API only, no views | skip: API only |
| End User personas | role-boundary-user, careless-user [api] | careless-user [api]: re-ship must not move `shippedAt` |
| Product Manager | run: new feature, role rule and status transition (BR-019 to BR-021) | run: new data rule BR-022 |
