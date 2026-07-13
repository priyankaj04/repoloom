# repoloom — Design Spec

**Date:** 2026-07-13  
**Status:** Approved  

---

## Overview

`repoloom` is a CLI tool that analyzes a software project, recommends relevant Claude Code skills from npm, and installs them — globally for the individual or locally for the team. Skills are npm packages following a `repoloom-skill-*` naming convention. No backend infrastructure required.

---

## Problem

Engineers using Claude Code must manually discover and install skills that improve AI-assisted engineering quality. There is no tool that understands a project's stack and automatically surfaces the right skills. Teams have no way to standardize which skills are active across their repos.

---

## Goals

- Analyze any project and recommend the most relevant Claude Code skills
- Install skills to `~/.claude/plugins/` (global) or `.claude/skills/` (local)
- Enable team reproducibility via `repoloom.lock`
- Allow any developer to publish skills to the ecosystem via npm
- Be extensible to other AI tools (Cursor, Copilot) in future versions

---

## Out of Scope

- A hosted registry service or backend API
- Automatic ambient analysis on `cd` (must be invoked explicitly)
- Supporting non-Claude-Code AI tools in v1

---

## CLI Commands

```sh
npx repoloom analyze          # fingerprint project → LLM ranks → show recommendations → install selected
npx repoloom install <skill>  # install a specific skill by name
npx repoloom sync             # install all skills from repoloom.lock (for teammates)
npx repoloom list             # show installed skills (local + global)
npx repoloom remove <skill>   # uninstall a skill
npx repoloom publish          # scaffold + validate + publish a skill to npm
```

### `analyze` flow (primary)

1. Run fingerprinter on current directory
2. Fetch available `repoloom-skill-*` packages from npm search API
3. Call Claude API with fingerprint + available skills → ranked recommendations
4. Present top 5 recommendations with explanations to the user
5. User confirms which to install (interactive multi-select)
6. Installer places skill files, writes/updates `repoloom.lock`

If a `repoloom.lock` already exists in the project root, `analyze` defaults to `--local` (project is already using repoloom as a team). If no lock file exists, defaults to `--global` (first-time personal use). User can override either way with `--local` or `--global` flags.

### `sync` flow (team onboarding)

1. Read `repoloom.lock` from project root
2. For each skill + pinned version, download from npm and install locally
3. Idempotent — skips already-installed matching versions

---

## Architecture

### Module: `fingerprinter`

Produces a `ProjectFingerprint` JSON by reading the project statically. No network, no LLM. Runs in under 1 second.

```typescript
interface ProjectFingerprint {
  packageManagers: string[]   // ["npm", "pip"]
  languages: string[]         // ["typescript", "python"]
  frameworks: string[]        // ["react", "fastapi"]
  testFrameworks: string[]    // ["pytest", "vitest"]
  ciProvider: string | null   // "github-actions"
  isMonorepo: boolean
  installedSkills: string[]   // already-installed skill names — excluded from recommendations
}
```

Detection sources:

- `package.json` dependencies and devDependencies
- `pyproject.toml` / `requirements.txt`
- `Cargo.toml`, `go.mod`, `pom.xml`, `build.gradle`
- File extension distribution across the tree
- `.github/workflows/`, `.circleci/`, `Jenkinsfile`

### Module: `ranker`

1. Calls npm search API: `https://registry.npmjs.org/-/v1/search?text=repoloom-skill`
2. Fetches `skill.json` manifest from each result's npm package
3. Calls Claude API (claude-sonnet-4-6) with fingerprint + skill manifests
4. Returns top 5 ranked skills with per-skill explanation text

**Caching:** Results are cached at `~/.repoloom/cache/<fingerprint-hash>.json`. Cache is invalidated when the fingerprint changes (i.e. when `package.json` or project structure changes).

**Claude API call:** ~2k tokens. Prompt instructs Claude to rank by relevance to the fingerprint and explain each recommendation in one sentence.

### Module: `installer`

Handles file placement and lock file management.

**Install modes:**

| Flag              | Destination                          | Use case                      |
|-------------------|--------------------------------------|-------------------------------|
| `--global` (default) | `~/.claude/plugins/<skill-name>/` | personal, cross-project       |
| `--local`         | `.claude/skills/<skill-name>/`       | team-shared, committed to git |

**Lock file (`repoloom.lock`):**

```json
{
  "version": 1,
  "skills": {
    "repoloom-skill-react": "1.2.0",
    "repoloom-skill-typescript": "2.0.1"
  }
}
```

Written/updated only for `--local` installs. Global installs do not touch `repoloom.lock` — they belong to the user, not the project. Read by `sync`. Committed to git for team reproducibility.

### Module: `publisher`

For skill authors. Two modes:

1. **Scaffold mode** (no `skill.json` present): Interactive prompts to generate package structure
2. **Publish mode** (existing skill package): Validates then runs `npm publish`

**Generated structure:**

```text
repoloom-skill-<name>/
├── skill.md        # Claude Code skill instructions
├── skill.json      # manifest
├── package.json    # npm config
└── README.md       # auto-generated from skill.json
```

**`skill.json` schema:**

```json
{
  "name": "fastapi",
  "description": "Best practices for FastAPI projects",
  "tags": ["python", "fastapi", "backend", "api"],
  "triggers": {
    "dependencies": ["fastapi"],
    "files": ["main.py", "app/main.py"]
  },
  "targets": ["claude-code"],
  "version": "1.0.0"
}
```

**Validation checks before publish:**

- Package name matches `repoloom-skill-*` or `@scope/repoloom-skill-*`
- `skill.json` has all required fields: `name`, `description`, `tags`, `targets`, `version`
- `skill.md` is non-empty
- `triggers` has at least one entry (either `dependencies` or `files`)

---

## Dependency Surface

```text
repoloom
├── @anthropic-ai/sdk    — Claude API for ranking
├── ora                  — spinner UX during analysis
└── prompts              — interactive multi-select for install confirmation
```

No bundler, no framework. Node built-ins for all file I/O. Minimizes install time and attack surface.

---

## Data Flow Summary

```text
npx repoloom analyze
       │
       ▼
[fingerprinter] ──── reads project files ────▶ ProjectFingerprint
       │
       ▼
[ranker] ──── npm search API ──▶ available skill manifests
         ──── Claude API ──────▶ ranked recommendations + explanations
       │
       ▼
[user confirms] ──── interactive multi-select
       │
       ▼
[installer] ──── npm download ──▶ ~/.claude/plugins/ or .claude/skills/
             ──── writes ───────▶ repoloom.lock
```

---

## Error Handling

- **No API key:** If `ANTHROPIC_API_KEY` is unset, `analyze` falls back to tag-based matching only (no LLM ranking). Displays a notice.
- **npm search fails:** Display error, suggest `npx repoloom install <skill>` as manual fallback.
- **Skill already installed:** `install` is idempotent — skips silently unless `--force` is passed.
- **Lock file conflict:** If `repoloom.lock` specifies a version that differs from what's installed, `sync` always wins (installed version is overwritten).

---

## Extensibility (Post-v1)

The `targets` field in `skill.json` and the `installer` module are the two extension points for supporting other AI tools. In v2, `repoloom install --target cursor` would place rule files into `.cursor/rules/` instead of `.claude/`. No CLI surface changes required.

---

## Testing Strategy

- `fingerprinter`: unit tests with fixture project directories (React app, FastAPI app, monorepo, empty dir)
- `ranker`: unit tests mock both npm API and Claude API responses; integration test with real npm search (no LLM)
- `installer`: unit tests verify correct file placement and lock file format for both install modes
- `publisher`: unit tests for validation logic; no real npm publish in CI
- E2E: one test that runs `analyze` against a fixture project with mocked Claude API and verifies the full flow end-to-end
