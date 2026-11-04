# Java adapter

For Spring Boot and similar JVM services built with Maven or Gradle. Confirm each command exists before relying on it, and record what you confirm in `.codewright/profile.json`.

## Detect

- `pom.xml` (Maven) or `build.gradle` / `build.gradle.kts` (Gradle). Spring Boot shows as `spring-boot-starter-*` dependencies. Java version: `<java.version>` or `toolchain`/`sourceCompatibility`.
- Prefer the wrapper (`./mvnw`, `./gradlew`) when present.

## Commands

| Purpose | Maven | Gradle |
| --- | --- | --- |
| Tests | `./mvnw test` | `./gradlew test` |
| Tests, filtered | `./mvnw test -Dtest={name}` | `./gradlew test --tests {name}` |
| Static checks | the project's Checkstyle / SpotBugs / PMD goal, if configured | `./gradlew check` |
| Run the app | `SPRING_PROFILES_ACTIVE=test SERVER_PORT=8765 ./mvnw spring-boot:run` | `SPRING_PROFILES_ACTIVE=test SERVER_PORT=8765 ./gradlew bootRun` |

## Test environment

- `application-test.yml` / `.properties` selected by the `test` profile. If it doesn't exist, stop and ask; never run against the default profile's datasource.
- Integration tests: `@SpringBootTest` with H2 or Testcontainers, `@WebMvcTest` / `MockMvc` or `WebTestClient` for the web layer. Follow the project's choice.
- Flyway or Liquibase migrations run on startup; make sure the test profile points them at the test database.

## Where things live

| Concern | Look in |
| --- | --- |
| Routes | `@RestController` / `@Controller` classes with `@RequestMapping` |
| Validation | Bean Validation annotations (`@Valid`, `@NotNull`) on DTOs, `@ControllerAdvice` for errors |
| Logic | `@Service` classes; domain packages |
| Data | JPA entities, Spring Data repositories, `db/migration` (Flyway) or changelogs (Liquibase) |
| Auth | Spring Security config (`SecurityFilterChain`), `@PreAuthorize`, method security |
| Config | `application*.yml`, `@ConfigurationProperties` |

## Grouping and conventions

Group by package (feature or layer) or Maven/Gradle module. Record: layering (controller → service → repository), DTO versus entity exposure, mapping (MapStruct or manual), exception handling style, transaction boundaries (`@Transactional` placement).

## Risk hotspots

Entities returned or bound directly (mass assignment); missing `@PreAuthorize` on new endpoints; `@Transactional` on private methods or self-calls (silently ignored); `BigDecimal` scale and rounding for money; lazy-loading outside a transaction; native queries with concatenated input.
