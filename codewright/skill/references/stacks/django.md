# Django adapter

For Django and Django REST Framework projects. Confirm each command exists before relying on it, and record what you confirm in `.codewright/profile.json`.

## Detect

- `manage.py` at the root. Django version from `requirements*.txt`, `pyproject.toml` or `poetry.lock`. DRF shows as `djangorestframework`. Settings module from `DJANGO_SETTINGS_MODULE` in `manage.py`.

## Commands

| Purpose | Command | Use when |
| --- | --- | --- |
| Tests | `python manage.py test` or `pytest` | `pytest-django` installed → `pytest` |
| Tests, filtered | `python manage.py test {name}` or `pytest -k "{name}"` | Per chunk |
| Lint | `ruff check .` or `flake8` | Configured in `pyproject.toml` / `setup.cfg` |
| Types | `mypy .` | Configured |
| Run the app | `DJANGO_SETTINGS_MODULE=<test settings> python manage.py runserver 127.0.0.1:8765` | Runtime Monitor and personas |
| Migrations, testing only | `DJANGO_SETTINGS_MODULE=<test settings> python manage.py migrate` | Before runtime checks |

## Test environment

- A test settings module (`settings/test.py`, or overrides in `conftest.py`). The test runner creates its own test database; the *running* app for runtime checks needs a separate SQLite or test database through test settings. If none exists, stop and ask; never run `migrate`, `flush` or `runserver` against production settings.

## Where things live

| Concern | Look in |
| --- | --- |
| Routes | `urls.py` per app and the root `urls.py`; DRF routers |
| Views | `views.py`, DRF `ViewSet`s and `APIView`s |
| Validation | Forms, DRF serializers (`validate_<field>`, `validate`) |
| Logic | Model methods, managers, `services.py`, signals |
| Data | `models.py`, `migrations/` |
| Auth | `permission_classes`, `@login_required`, `django.contrib.auth` groups and permissions |
| Templates | `templates/` per app |

## Grouping and conventions

Group by Django app; each app is usually a module. Record: function versus class-based views, serializer patterns, where business logic lives (fat models or services), permission classes, and the error response format.

## Risk hotspots

Missing `permission_classes` (DRF defaults may allow everything); querysets not filtered by the requesting user (IDOR); serializer `fields = '__all__'` exposing or accepting sensitive fields; `Decimal` handling for money; N+1 queries without `select_related`/`prefetch_related`; raw SQL with string formatting; `DEBUG = True` leaking tracebacks.
