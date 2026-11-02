# Laravel adapter

Reference adapter. Every agent working on a Laravel project reads the section it needs; nothing here is a fixed truth about a given project. Confirm each command exists before relying on it, and record what you confirm in `.codewright/profile.json`.

## Detect

- `artisan` at the project root, and `laravel/framework` in `composer.json` → `require`.
- Version: `laravel/framework` in `composer.lock`. Read `php` in `composer.json` too; syntax and helpers differ between Laravel 9, 10, 11 and 12 (11+ has no `app/Http/Kernel.php`, middleware and routing live in `bootstrap/app.php`).

## Commands

Check `composer.json` → `require-dev` and `vendor/bin/` to pick the right variant.

| Purpose | Command | Use when |
| --- | --- | --- |
| Tests | `php artisan test` | Always available |
| Tests, one file or filter | `php artisan test --filter=<Name>` | Fast feedback per chunk |
| Pest directly | `vendor/bin/pest` | `pestphp/pest` installed |
| Browser tests | `php artisan dusk` | `laravel/dusk` installed |
| Code style check | `vendor/bin/pint --test` | `laravel/pint` installed; never run `pint` without `--test` unless the plan says to format |
| Static analysis | `vendor/bin/phpstan analyse` | `phpstan.neon` exists or `larastan/larastan` installed |
| Routes | `php artisan route:list --json` | Mapping endpoints; pass `--path=api` to narrow |
| Migrations, testing only | `php artisan migrate --env=testing` | Before runtime checks |
| Run the app | `php artisan serve --env=testing --port=8765` | Runtime Monitor and personas; never the default port |
| Logs | `storage/logs/laravel.log` | Read the tail after each runtime sweep |

## Test environment

- `.env.testing` must exist before anything runs the app or migrations. If it is missing, stop and ask the user; never copy `.env` to create it, because `.env` may hold production credentials.
- Prefer SQLite (`DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:` for tests, a file under `database/` for the running app) unless the schema needs MySQL or PostgreSQL features. Raw SQL, JSON columns and full-text indexes often do.
- `phpunit.xml` `<env>` entries override `.env.testing` during tests. Read both.
- Queues: `QUEUE_CONNECTION=sync` in testing, so jobs run inline and failures surface.
- Mail and notifications: `MAIL_MAILER=array` or `log`. External payment, SMS and push gateways must point at sandbox credentials or be faked with `Http::fake()`.

## Where things live

| Concern | Look in |
| --- | --- |
| Routes | `routes/web.php`, `routes/api.php`, extra files loaded from `bootstrap/app.php` or `RouteServiceProvider` (multi-panel apps often have `routes/admin.php`, `routes/vendor.php`, versioned `routes/api/v1/*.php`) |
| HTTP layer | `app/Http/Controllers/` (panel subfolders such as `Admin/`, `Vendor/`, `Api/V1/`), `app/Http/Requests/`, `app/Http/Middleware/`, `app/Http/Resources/` |
| Domain | `app/Models/`, plus whatever the project uses for logic: `app/Services/`, `app/Repositories/`, `app/Actions/`, `app/Traits/`, helper classes such as `app/CentralLogics/` or `app/Helpers/` |
| Modules | `Modules/<Name>/` when `nwidart/laravel-modules` is installed; each module mirrors the app structure |
| Data | `database/migrations/`, `database/seeders/`, `database/factories/` |
| Views | `resources/views/` (Blade); panel layouts under `layouts/` |
| Translations | `lang/` or `resources/lang/`; projects may use a `translate()` helper instead of `__()` |
| Config and integrations | `config/`, plus settings stored in the database (a `business_settings` style table is common) |
| Background work | `app/Jobs/`, `app/Events/`, `app/Listeners/`, `app/Observers/`, `app/Console/` or `routes/console.php` schedules |
| Auth and roles | `config/auth.php` guards, middleware aliases, policies in `app/Policies/`, permission packages such as `spatie/laravel-permission` |

## Grouping into modules

The System Analyst groups the code into modules for the knowledge base. Use the first rule that gives clear groups:

1. `Modules/<Name>/` folders, one module each.
2. Business domains visible in models and controllers: orders, products, wallet, delivery, payments, users, settings. Put a domain's model, controllers across panels, requests, services, migrations and views in one module.
3. Panels or audiences (admin, vendor, customer, delivery person, API) only when domains are not separable.

Record each module's globs in `modules.json`, for example `app/Models/Order*.php`, `app/Http/Controllers/**/Order*.php`, `database/migrations/*_order*`.

## Conventions to record

Read three or four existing examples before writing down a convention, and cite them:

- Where validation happens: Form Requests, inline `$request->validate()`, or `Validator::make`.
- Where business logic lives: controllers, services, repositories, model methods, static helper classes.
- Response shape for APIs: Resources, a shared response helper, raw arrays; the error format.
- Naming: route names, controller method names, translation keys.
- Authorization: middleware per route group, policies, manual checks in controllers.
- How money, status values and settings are represented: decimals or integers, constants or enums, config or database settings.

## Risk hotspots

Flag these for the Adversary, Behavior Verifier and Product Manager whenever a change touches them:

- Money: wallet balances, order totals, tax, coupons, commissions, refunds, currency rounding.
- State machines: order and delivery status transitions; who may move a status where.
- Role boundaries: a route reachable by the wrong guard or panel; IDs taken from the request without an ownership check.
- Mass assignment: `$guarded = []` or broad `$fillable` on models touched by the change.
- Raw queries and `DB::raw` with request input.
- Payment and webhook callbacks: signature checks, idempotency.
- File uploads: type and size validation, storage disk, public exposure.
- Cached config and routes: changes may need `php artisan optimize:clear` in testing.
