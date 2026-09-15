# Repository Guidelines

## Project Structure & Module Organization

This project is at the requirements stage for 人生支线 (SideQuest), a responsive Web/PWA that suggests real-world experiences and records completion and growth.

- `docs/1.人生支线产品需求分析文档.md`: primary product specification, including MVP scope, data models, requirements (`FR`), and acceptance criteria (`AC`).
- `docs/2.人生支线技术架构与模块拆分.md`: proposed technology stack, architecture, module dependencies, development tasks, and unresolved decisions.
- `docs/3.开发前准备清单.md`: verified local tools, setup prerequisites, responsibilities, and readiness checks.
- `docs/`: place supporting design decisions, implementation plans, and validation records here. Contributor guidance lives in this `AGENTS.md`.

No source, test, or asset directories exist yet. Document their locations when scaffolding the application.

The backend choice is confirmed: Payload CMS with TypeScript on Node.js / Next.js, providing the operations admin and API. Use Payload for base content operations and custom services for publishing, scheduling, and analytics.

## Build, Test, and Development Commands

No package manifest, build system, development server, or automated test commands are configured. Do not assume `npm test` or `npm run dev` works.

Useful inspection commands from the project root:

- `rg --files --hidden`: list project files.
- `rg -n 'FR 0|AC 0' --glob '*.md'`: locate requirement and acceptance references.

When introducing tooling, document exact installation, development, build, lint, and test commands here.

## Coding Style & Naming Conventions

Use UTF-8 Markdown, descriptive headings, short paragraphs, and consistent tables. Preserve Chinese product terminology and existing requirement identifiers. Use descriptive filenames for additions under `docs/`, and keep links relative to the repository root or containing document.

The architecture proposal specifies strict TypeScript, two-space indentation, ESLint, and Prettier. Configure these alongside the first implementation; no tooling is installed yet.

## Testing Guidelines

No test framework, test naming convention, or coverage threshold exists. Review documentation changes against the specification for contradictions and broken references.

For implementation work, derive behavioral tests from AC 01–10, especially persistence after restart, duplicate completion submissions, reward rollback, task snapshots, and daily rollover at Beijing midnight. Document the chosen framework and test naming pattern when adding tests.

## Commit & Pull Request Guidelines

No Git metadata or commit history is available in this workspace. As an initial convention, use concise imperative subjects, such as `docs: clarify quest completion rules`.

PRs should explain the change, reference affected FR/AC identifiers and related issues, and report validation performed. Include screenshots for UI changes and flag unresolved product decisions.

## Product & Privacy Constraints

Preserve anonymous first use and one-click recommendations without prerequisite filters. Keep completion records private by default; exclude note contents, photos, and precise location from analytics. Keep changes within the documented MVP scope.
