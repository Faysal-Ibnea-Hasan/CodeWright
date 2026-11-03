# React adapter

For React front ends: Vite, Create React App or Next.js. Confirm each command exists before relying on it, and record what you confirm in `.codewright/profile.json`.

## Detect

- `react` in `package.json` dependencies. Build tool: `vite`, `react-scripts`, or `next` (Next.js also has server code under `app/` or `pages/api/`). TypeScript: `tsconfig.json`.

## Commands

Read `package.json` → `scripts` first.

| Purpose | Command | Use when |
| --- | --- | --- |
| Tests | `npm test` (Vitest or Jest with Testing Library) | Always; add `-- --run` for Vitest if `test` watches |
| Tests, filtered | `npx vitest run -t "{name}"` or `npx jest -t "{name}"` | Per chunk |
| Lint | `npm run lint` | A `lint` script exists |
| Types | `npx tsc --noEmit` | TypeScript projects |
| End-to-end | `npx playwright test` or `npx cypress run` | The project has them |
| Run the app | `npm run dev -- --port 8765 --host 127.0.0.1` (Vite), `PORT=8765 npm start` (CRA), `npm run dev -- -p 8765` (Next.js) | UI/UX QA and browser personas |

## Test environment

- The front end talks to an API: point it at a test or mock back end through its env variable (`VITE_API_URL`, `NEXT_PUBLIC_API_URL`) in `.env.test` or `.env.development.local`, or MSW mocks. Never point a test run at the production API.
- Component tests use Testing Library: query by role and label, the way users find things.

## Where things live

| Concern | Look in |
| --- | --- |
| Routes / pages | `src/routes`, React Router config, Next.js `app/` or `pages/` |
| Components | `src/components`, feature folders |
| State and data | hooks, context, Redux/Zustand stores, React Query / SWR |
| API calls | `src/api`, `services/`, generated clients |
| Styles and design system | CSS modules, Tailwind config, theme files, a component library |
| Copy | i18n files (`locales/`, `messages/`) |

## Grouping and conventions

Group by feature folder or route. Record: component and hook naming, state management choice, data fetching pattern, styling approach and the design-system components to reuse, form handling and validation library, accessibility patterns.

## Risk hotspots

Authorization enforced only in the UI (the API must enforce it too); secrets in `VITE_` / `NEXT_PUBLIC_` variables; `dangerouslySetInnerHTML` with user content; missing loading, empty and error states; layout breaking at small widths; inaccessible custom controls; untranslated strings.
