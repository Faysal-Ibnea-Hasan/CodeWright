# Flutter adapter

For Flutter apps (mobile, web, desktop). Confirm each command exists before relying on it, and record what you confirm in `.codewright/profile.json`.

## Detect

- `pubspec.yaml` with `sdk: flutter`. Flutter and Dart constraints under `environment`. State management from dependencies: `provider`, `flutter_bloc`, `riverpod`, `get` (GetX), `mobx`.

## Commands

| Purpose | Command | Use when |
| --- | --- | --- |
| Tests | `flutter test` | Always |
| Tests, filtered | `flutter test --plain-name "{name}"` | Per chunk |
| Analysis | `flutter analyze` | Always |
| Format check | `dart format --output=none --set-exit-if-changed lib test` | Always available |
| Integration tests | `flutter test integration_test` | `integration_test/` exists and a device or emulator is available |
| Code generation | `dart run build_runner build --delete-conflicting-outputs` | `build_runner` used (freezed, json_serializable); run after model changes |

## Runtime checks and personas

A Flutter app usually can't be driven like a website here. Personas and the Runtime Monitor test the **API the app calls**: point them at the back end's test instance (its URL and `testAccounts` go in `profile.json`). If the project builds for web (`flutter build web`) and the user wants browser checks, serve the build on the test port. UI/UX QA reviews golden tests and widgets against the theme.

## Test environment

- API base URLs and keys usually come from a config class, `--dart-define`, or flavor files. Tests must use a fake or test API (mocked HTTP client, `mocktail`, `http.MockClient`); never the production base URL.

## Where things live

| Concern | Look in |
| --- | --- |
| Screens | `lib/view/screens`, `lib/screens`, `lib/features/<feature>/presentation` |
| Widgets | `lib/view/base`, `lib/widgets`, shared components |
| State | controllers (GetX), blocs/cubits, providers, notifiers |
| Data | repositories, API clients (`dio`, `http`), models with `fromJson`/`toJson` |
| Routing | `GetMaterialApp` routes, `go_router` config, `RouteHelper`-style classes |
| Theme and design | `lib/theme`, `lib/util/styles.dart`, `dimensions.dart`, color constants |
| Copy | `assets/language/*.json`, ARB files, `.tr` keys |

## Grouping and conventions

Group by feature folder (many projects use `lib/features/<feature>` with data, controller and view layers). Record: state management pattern, repository and API client conventions, where dimensions, styles and colors are defined (reuse them), translation keys, and navigation pattern.

## Risk hotspots

Business rules enforced only in the app (the API must enforce them too); prices computed on the device; tokens stored insecurely (`SharedPreferences` versus secure storage); unhandled API errors leaving spinners forever; hard-coded strings instead of translation keys; layouts overflowing on small screens; controllers or streams not disposed.
