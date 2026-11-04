# Generic adapter

Used for any stack without its own adapter yet (.NET, Java, Node, Django, React, Flutter in this release) and for "Any stack". Instead of known commands, it tells agents how to discover them. Everything discovered is confirmed with the user at init and saved in `.codewright/profile.json`, so later runs never guess.

## Discover the commands

Look in this order and stop when a source answers:

1. `.codewright/profile.json`, if a previous init confirmed the commands.
2. CI configuration: `.github/workflows/*.yml`, `.gitlab-ci.yml`, `bitbucket-pipelines.yml`, `Jenkinsfile`. The steps CI runs are the most trustworthy test and lint commands.
3. Task runners: `Makefile`, `justfile`, `Taskfile.yml`, `package.json` → `scripts`, `composer.json` → `scripts`.
4. `README.md`, `CONTRIBUTING.md`, `docs/` sections named setup, development, testing.
5. Stack defaults, only as a last resort and always confirmed with the user:

| Stack | Test | Lint / analyze | Run |
| --- | --- | --- | --- |
| .NET | `dotnet test` | `dotnet format --verify-no-changes` | `dotnet run --project <api project>` |
| Java (Maven) | `mvn test` | the project's Checkstyle or SpotBugs goal | `mvn spring-boot:run` |
| Java (Gradle) | `./gradlew test` | `./gradlew check` | `./gradlew bootRun` |
| Node | `npm test` | `npm run lint` | `npm run dev` or `npm start` |
| Django | `python manage.py test` or `pytest` | `ruff check` or `flake8` | `python manage.py runserver 8765` |
| React | `npm test` | `npm run lint`, `npx tsc --noEmit` | `npm run dev` |
| Flutter | `flutter test` | `flutter analyze` | `flutter run` (personas test the API it calls; UI through `integration_test/` if present) |

## Test environment

- Find how the project separates test configuration: environment files (`.env.test`, `appsettings.Development.json`, `settings/test.py`), profiles or flags.
- Never run migrations, seeders or the app against a configuration that may point at real data. If there is no clearly separate test configuration, stop and ask the user.

## Where things live

Map these, whatever the stack calls them: entry points and routing; request handlers; business logic; data models and migrations; UI screens or views; background jobs; configuration; authentication and roles; translations.

## Grouping into modules

Use the project's own boundaries first: packages, modules, feature folders, bounded contexts. Fall back to business domains visible in models and handlers. Record each module's path globs in `modules.json`.

## Conventions and risk hotspots

Record conventions with cited examples, as in the Laravel adapter: validation, where logic lives, response and error shapes, naming, authorization. Flag the same risk hotspots: money, state transitions, role boundaries, unvalidated input reaching queries, payment callbacks, file uploads.
