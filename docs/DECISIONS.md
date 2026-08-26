# DECISIONS — Architecture Decision Records

Log of technical decisions not fully pinned down by `docs/ARCHITECTURE.md`, made during implementation.

## ADR-001: pnpm workspaces (not Turborepo) for the monorepo

**Date:** 2026-08-27
**Phase:** 0

`docs/ROADMAP.md` phase 0 allowed either "pnpm workspaces یا turborepo". Chose plain pnpm workspaces for now:

- No build-caching/task-graph needs yet at this project size (a handful of small packages, no heavy build pipeline).
- One less moving part during early phases.
- Turborepo can be layered on top later without restructuring, since it works directly on top of pnpm workspaces (`pnpm-workspace.yaml` stays valid).

## ADR-002: Local git repo scoped to the project folder

**Date:** 2026-08-27
**Phase:** 0

The project folder was originally a subdirectory of a much larger git repository rooted at the user's home directory (tracking unrelated personal files). Ran `git init` directly inside the project folder to create an independent repo scoped only to this project, isolated from the home-directory repo. The GitHub remote (see README.md) points at this independent repo.
