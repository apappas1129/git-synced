# Changelog

## 1.0.0

- Published as an installable CLI: `npx @apappas1129/git-synced` or `npm i -g @apappas1129/git-synced`.
- Added `-f/--file`, `-v/--version`, `-h/--help` flags.
- Refactored into `src/` modules (scraping, prompts, commit script generation, execution, CLI parsing).
- Added `DECISION_TREE.md` documenting every CLI branch.
- Added automated test suite (`node --test`) covering unit, integration, and black-box e2e flows.
