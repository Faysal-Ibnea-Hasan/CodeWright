# .NET adapter

For ASP.NET Core APIs and web apps. Confirm each command exists before relying on it, and record what you confirm in `.codewright/profile.json`.

## Detect

- `*.sln` or `*.csproj` at the root. The target framework is `<TargetFramework>` in the `.csproj` (`net8.0`, `net9.0`). Web projects reference `Microsoft.NET.Sdk.Web`.
- Test projects reference `xunit`, `NUnit` or `MSTest` and usually live under `tests/`.

## Commands

| Purpose | Command | Use when |
| --- | --- | --- |
| Tests | `dotnet test` | Always |
| Tests, filtered | `dotnet test --filter "FullyQualifiedName~{name}"` | Per chunk |
| Build | `dotnet build --no-restore` | Before tests, to surface compile errors |
| Style check | `dotnet format --verify-no-changes` | Always available with the SDK |
| Run the app | `ASPNETCORE_ENVIRONMENT=Testing ASPNETCORE_URLS=http://127.0.0.1:8765 dotnet run --project <web project>` | Runtime Monitor and personas |
| Migrations, testing only | `dotnet ef database update` with the testing connection string | EF Core projects |

## Test environment

- `appsettings.Testing.json` (or `Development`) selected by `ASPNETCORE_ENVIRONMENT`. If no testing configuration exists, stop and ask; never point the app at the connection string in `appsettings.Production.json`.
- Integration tests usually use `WebApplicationFactory<Program>` with an in-memory or SQLite database, or Testcontainers. Follow whichever the project uses.

## Where things live

| Concern | Look in |
| --- | --- |
| Routes | Controllers with `[Route]` attributes, or minimal APIs in `Program.cs` / endpoint extension classes |
| Validation | Data annotations, FluentValidation validators, or endpoint filters |
| Logic | Services registered in `Program.cs` DI; MediatR handlers in CQRS projects |
| Data | EF Core `DbContext`, entity classes, `Migrations/` |
| Auth | `AddAuthentication`/`AddAuthorization`, `[Authorize(Roles/Policy)]` attributes, policies |
| Config | `appsettings*.json`, options classes bound with `Configure<T>` |

## Grouping and conventions

Group modules by project (in multi-project solutions), then by feature folder or domain. Record: controller versus minimal API style; where validation lives; DTO naming and mapping (manual, AutoMapper, Mapster); error format (`ProblemDetails` or custom); async conventions.

## Risk hotspots

Authorization attributes missing on new endpoints; over-posting into entities (bind DTOs, not entities); `decimal` versus `double` for money; EF `Include` causing N+1 or over-fetching; raw SQL with `FromSqlRaw` and interpolated input; secrets in `appsettings.json`.
