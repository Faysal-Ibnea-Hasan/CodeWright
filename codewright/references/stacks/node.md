# Node adapter

For Node.js back ends: Express, Fastify, NestJS, Koa, or plain `http`. Confirm each command exists before relying on it, and record what you confirm in `.codewright/profile.json`.

## Detect

- `package.json` without a front-end framework as the main dependency. The framework shows in `dependencies` (`express`, `fastify`, `@nestjs/core`, `koa`). TypeScript: `typescript` plus `tsconfig.json`. Package manager: the lockfile (`package-lock.json` npm, `yarn.lock` Yarn, `pnpm-lock.yaml` pnpm).

## Commands

Read `package.json` → `scripts` first; use the project's scripts over raw tools.

| Purpose | Command | Use when |
| --- | --- | --- |
| Tests | `npm test` (or the `pnpm` / `yarn` equivalent) | Always |
| Tests, filtered | Jest/Vitest: `npx jest -t "{name}"` or `npx vitest run -t "{name}"`; node:test: `node --test --test-name-pattern={name} <test glob>` | Per chunk |
| Lint | `npm run lint` | A `lint` script exists |
| Types | `npx tsc --noEmit` | TypeScript projects |
| Run the app | `PORT=8765 NODE_ENV=test npm start` (or the `dev` script) | Runtime Monitor and personas |
| Migrations, testing only | the ORM's command (Prisma `npx prisma migrate deploy`, Knex, TypeORM, Sequelize) with the test `DATABASE_URL` | When the project has a database |

## Test environment

- Test configuration through `NODE_ENV=test`, `.env.test`, or a config module. If the app would read the real `.env` database URL, stop and ask.
- HTTP tests usually use `supertest`, `fastify.inject`, or `fetch` against a server on a random port. Follow the project's pattern.

## Where things live

| Concern | Look in |
| --- | --- |
| Routes | `routes/`, `controllers/`, NestJS `*.controller.ts`, or the app entry file |
| Validation | `zod`, `joi`, `class-validator` DTOs, `express-validator`, or hand-written checks |
| Logic | `services/`, NestJS providers, domain folders |
| Data | ORM models or schemas (`prisma/schema.prisma`, `models/`, entities), migrations |
| Auth | middleware (`passport`, JWT checks), NestJS guards |
| Shared helpers | `utils/`, `lib/`, `helpers/`, response helpers |

## Grouping and conventions

Group by feature folder or NestJS module; fall back to routes by resource. Record: response and error shape (a shared helper is common), validation library, async error handling (wrappers, `next(err)`), module system (ESM or CommonJS).

## Risk hotspots

Unhandled promise rejections crashing the process; missing auth middleware on new routes; request bodies spread into database writes (mass assignment); prototype pollution through object merging; floating-point money; unbounded queries without pagination; secrets read from `.env` without defaults for test.
