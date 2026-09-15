# Repository Guidelines

## Project Structure & Module Organization

This project implements the core local-first 人生支线 (SideQuest) Web/PWA loop and Payload content operations. See `docs/4.主要功能操作说明.md` for current usage and `docs/validation/主要功能闭环验证.md` for verification boundaries. The user explicitly excluded remote analytics from MVP; statistics stay local and are exported/deleted with personal data. Full production acceptance is not complete.

- `docs/1.人生支线产品需求分析文档.md`: primary product specification, including MVP scope, data models, requirements (`FR`), and acceptance criteria (`AC`).
- `docs/2.人生支线技术架构与模块拆分.md`: proposed technology stack, architecture, module dependencies, development tasks, and unresolved decisions.
- `docs/`: place supporting design decisions, implementation plans, and validation records here. Contributor guidance lives in this `AGENTS.md`.
- `docs/devTasks/`: M01–M12 implementation tasks and product decision register.
- `docs/3.工程开发说明.md`: actual development commands, configuration and verification boundaries.

- `apps/web/src/app/`: React/Vite application shell, routes and styles; `apps/web/public/` is reserved for static assets.
- `apps/web/src/data/`: Dexie database versions/models; `src/services/`: transactional quest lifecycle, photos and export; `src/app/`: reactive UI and startup reconciliation. Tests are colocated or under `tests/e2e`.
- `apps/content/src/`: Payload/Next.js routes, environment validation, collections and explicit migrations.
- `packages/contracts/src/`, `packages/domain/src/`: public content, snapshots, validation and pure reward/date/state rules.
- `tests/e2e/`: Playwright browser tests; `tests/setup/`: test environment setup. Unit tests live beside source files.

The backend choice is confirmed: Payload CMS with TypeScript on Node.js / Next.js, providing the operations admin and API. Use Payload for base content operations and custom services for publishing, scheduling, and analytics.

## Build, Test, and Development Commands

Use Node.js 24.16.0 and pnpm 11.5.1 from the workspace root. Direct dependency versions and the lockfile are pinned.

- `pnpm install --frozen-lockfile`: install dependencies.
- `pnpm dev:web`: run the independent user app on 127.0.0.1:5173.
- `pnpm dev:content`: run the content app on 127.0.0.1:3000; configure `apps/content/.env` first.
- `pnpm dev`: run both applications.
- `pnpm build`: build shared packages and both apps; content configuration is required, but dynamic routes do not query PG during build.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`: static validation.
- `pnpm test`: Vitest tests. Current tests do not prove business acceptance criteria.
- `pnpm test:e2e`: Playwright tests against the built web app. First build web and run `pnpm exec playwright install chromium webkit`.
- `pnpm db:migrate:create`, `pnpm db:migrate:status`, `pnpm db:migrate`: explicit Payload migration commands; confirm database target and migration contents before execution.

The user already provides PostgreSQL. Do not create or operate database infrastructure. Automatic database creation and schema push are disabled. The initial Payload migration has been applied and checked in the provided database. The user has confirmed creating their administrator account. Full role permissions belong to T07.

Useful inspection commands from the project root:

- `rg --files --hidden`: list project files.
- `rg -n 'FR 0|AC 0' --glob '*.md'`: locate requirement and acceptance references.

When introducing tooling, document exact installation, development, build, lint, and test commands here.

## Coding Style & Naming Conventions

Use UTF-8 Markdown, descriptive headings, short paragraphs, and consistent tables. Preserve Chinese product terminology and existing requirement identifiers. Use descriptive filenames for additions under `docs/`, and keep links relative to the repository root or containing document.

Use strict TypeScript, two-space indentation, ESLint, and Prettier. Shared domain/contracts must not import UI, CMS or database implementations. Existing Chinese documents retain manual formatting and are excluded from Prettier.

## Testing Guidelines

Use Vitest and fake-indexeddb for unit/local integration tests named `*.test.ts`; Playwright browser tests are `tests/e2e/*.spec.ts`. No arbitrary coverage percentage is set. Review documentation changes against the specification for contradictions and broken references.

For implementation work, derive behavioral tests from AC 01–10, especially persistence after restart, duplicate completion submissions, single-active-quest enforcement, irreversible completion, transaction rollback on failure, task snapshots, and daily rollover at Beijing midnight. Current skeleton tests are not substitutes for these later acceptance tests.

## Commit & Pull Request Guidelines

No Git metadata or commit history is available in this workspace. As an initial convention, use concise imperative subjects, such as `docs: clarify quest completion rules`.

PRs should explain the change, reference affected FR/AC identifiers and related issues, and report validation performed. Include screenshots for UI changes and flag unresolved product decisions.

## Product & Privacy Constraints

Preserve anonymous first use and one-click recommendations without prerequisite filters. Keep completion records private by default; exclude note contents, photos, and precise location from analytics. Keep changes within the documented MVP scope.

Confirmed on 2026-09-15: MVP personal records, photos, and growth data stay in IndexedDB in the current browser and site origin. Do not add account login, cloud photo uploads, or personal-record cloud sync. Provide export and deletion, and explain that clearing site data loses local records; cloud backup and cross-device recovery are not included. Other unresolved product decisions require discussion with the user before implementation.

Confirmed base rewards: difficulty 1–5 grants 10/20/35/55/80 XP and 2/3/5/7/10 integer attribute points. Allocate positive points to 2–3 attributes; no attribute exceeds 70% of the total. Shared validation lives in `packages/contracts`. Levels start at 1 with 0 XP; cumulative XP for level L is ceil(50 × (L−1)^1.5). Derive the level from accumulated XP. Repeat/daily rules are defined below.

Confirmed execution rules: at most one active ordinary quest; daily quests have an independent slot and may coexist even for the same questId. Users must complete or abandon it before accepting the next. Completion is irreversible; do not implement undo windows, reward-reversal actions, or a completion-revoke event. Completed and abandoned executions stay terminal; a reacceptance creates a new execution. AC 04 now verifies this rule. Transaction rollback on a failed write remains required.

Confirmed repeat rewards: completions 1/2/3/4+ grant 100%/50%/25%/10% of base XP and each attribute, rounded down; XP and originally positive attributes have a minimum of 1, originally zero attributes stay zero. Abandonment does not count; quest version changes do not reset the stable questId count. Ordinary and daily completions share the stable questId completion count. Daily rewards are limited to one per Beijing business date; unfinished daily quests expire into abandoned status at midnight without reward or a completion count increment. The pure calculator does not implement persistence or eligibility.
