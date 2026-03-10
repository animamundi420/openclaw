# Repository Guidelines

## Maintainer Lane Context (Anima Runtime)

- Active runtime topology:
  - ingress: `frontdoor`
  - specialists: `worker`, `web-navigator`, `net-worker`
  - control lanes: `security-auditor-worker`, `maintainer`
  - ACP external harness lane: `claude` (through frontdoor)
- This lane is maintenance-only (`openclaw-core` updates, diagnostics, release hygiene).
- Do not behave as an orchestrator lane.

## Canonical Cross-Lane Contract

- Canonical lane/filesystem/schema contract:
  - `/Users/anima/.openclaw/projects/frontdoor/LANE_CONTRACT.md`
- If maintenance requires external research, request `RESEARCH_RESULT` with:
  - `artifact_path` (optional)
  - `sources`
  - `summary`
  - `confidence`
  - `known_risks`
- If request is out of scope, return `NOT_MY_LANE` with:
  - `target_lane: frontdoor`
  - `reason`
  - `required_input`
  - `artifact_path` (optional)

## Hard Rules

- Never request, store, or reveal secrets.
- Never commit real credentials, tokens, phone numbers, or private keys.
- Do not edit `node_modules` or vendored dependency code directly.
- Prefer minimal, reversible edits and explicit verification.
- When multiple agents may be working:
  - do not use `git stash` unless explicitly requested
  - do not switch branches unless explicitly requested
  - do not modify worktrees unless explicitly requested

## Core Build/Test Commands

- Install: `pnpm install`
- Build/typecheck: `pnpm build`
- Lint/format checks: `pnpm check`
- Tests: `pnpm test`
- Coverage: `pnpm test:coverage`

If a command fails due missing deps/tooling, run the required install step and retry once.

## Repo Structure

- Source: `src/`
- Tests: `*.test.ts` (colocated)
- Docs: `docs/`
- Built output: `dist/`
- Extensions/plugins: `extensions/*`

## Docs and Release Pointers

- Mintlify docs style/routing: `docs/`
- Release procedure: `docs/reference/RELEASING.md`
- macOS release specifics: `docs/platforms/mac/release.md`
- Security posture: `SECURITY.md`

## GH / Security Advisory Notes

- Use heredoc (`-F - <<'EOF'`) for multiline GitHub comment/advisory payloads.
- Avoid embedding literal `\\n` strings in advisory descriptions.
- For GHSA publish flow, ensure required fields are present before publish.

## Troubleshooting

- Rebrand/migration or service warnings: run `openclaw doctor`
- Gateway status/probe:
  - `openclaw gateway status`
  - `openclaw gateway probe`

## Scope Reminder

- This file is intentionally compact to stay below runtime bootstrap limits.
- Put deep operational detail in repo docs; keep this bootstrap as high-signal rules only.
