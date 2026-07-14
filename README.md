# repoloom

Analyze your project and install the right AI agent skills and plugins — automatically, from [skillsllm.com](https://skillsllm.com).

```sh
npx repoloom analyze
```

## What it does

`repoloom` fingerprints your project (stack, frameworks, test tools, CI), fetches the live skills catalog from skillsllm.com, and uses Claude to score each skill on **incremental value** — what gap does this fill given what you already have? Only skills that genuinely improve your setup get recommended.

Works with **Claude Code, Cursor, GitHub Copilot, Codex CLI, Gemini CLI**, and more. Each platform gets skills installed in the right location automatically.

---

## Installation

No install required — use via npx:

```sh
npx repoloom <command>
```

Or install globally for faster runs:

```sh
npm install -g repoloom
```

---

## Commands

| Command | Description |
|---------|-------------|
| `repoloom analyze` | Fingerprint project, score skills, install selected ones |
| `repoloom sync` | Re-install all skills from `repoloom.lock` |
| `repoloom list` | Show installed skills (local and global) |
| `repoloom remove <skill>` | Uninstall a skill by slug |
| `repoloom publish` | Scaffold or publish a skill to npm |

---

## analyze

Primary command. Detects your stack, fetches skills from skillsllm.com, scores each by incremental value, and installs what you choose.

```sh
npx repoloom analyze
```

Example output:

```
Platform: claude-code | Project: javascript+typescript react+express
Coverage: Has senior engineering and readthru skills. Gaps: E2E testing,
security hardening, React UI patterns, CI/CD.

8 skill(s) add real value (incremental ≥6/10):

  1. playwright-skill  ★2.9k  [testing]
     Fills complete E2E testing gap — vitest/jest alone can't cover browser flows.
     Incremental: █████████░ 9/10  Overall: 8.9/10
     R:9 U:9 Q:8

  2. agent-skills  ★77.7k  [ai-agents]
     24-skill bundle covering performance, security, code review, CI/CD, frontend.
     Incremental: █████████░ 9/10  Overall: 8.9/10
     R:9 U:9 Q:8

? Which skills to install? (→ .claude/skills/) › playwright-skill, agent-skills

✔ playwright-skill [plugin] → .claude/plugins/playwright-skill/
✔ agent-skills [bundle: 24 skills] → api-and-interface-design, security-and-hardening, ...
```

If your project is already well-covered, repoloom says so and exits:

```
Coverage: All major areas covered — no high-value additions found.
Your skill coverage is solid.
```

Set `ANTHROPIC_API_KEY` for LLM-ranked scores. Without it, falls back to tag-based matching.

---

## Local vs Global install

By default, skills install **locally** to the current project:

```
.claude/
  skills/       ← SKILL.md-based skills
  plugins/      ← full plugin repos (have .claude-plugin/ manifest)
```

To install globally (available in all projects):

```sh
# Not yet a flag — install globally by pointing at your home dir
# Recommended: use local install per project and commit repoloom.lock
```

**Skill vs Plugin distinction:**
- **Skill** — repo contains `SKILL.md`. Installed to `.claude/skills/{slug}/`.
- **Plugin** — repo contains `.claude-plugin/`. Installed to `.claude/plugins/{slug}/` (full repo copied — includes hooks, slash commands, settings).
- **Bundle** — repo has `skills/*/SKILL.md`. Each sub-skill extracted to `.claude/skills/`.

---

## Team workflow with repoloom.lock

One teammate sets up skills, commits the lock. Everyone else syncs.

```sh
# Teammate 1 — runs analyze, installs, commits lock
npx repoloom analyze
git add repoloom.lock
git commit -m "chore: add repoloom skills"
git push

# Teammate 2 (Claude Code) — syncs from lock
npx repoloom sync

# Teammate 3 (Cursor) — syncs, gets skills in .cursor/rules/
npx repoloom sync

# Teammate 4 (GitHub Copilot) — syncs, appends to .github/copilot-instructions.md
npx repoloom sync
```

`repoloom.lock` format:
```json
{
  "version": 2,
  "skills": {
    "playwright-skill": "https://github.com/lackeyjb/playwright-skill",
    "agent-skills": "https://github.com/addyosmani/agent-skills"
  }
}
```

Lock is **platform-agnostic** — each teammate's `sync` detects their tool and installs to the right location.

---

## Platform install locations

| Platform | Skills location | Plugins location |
|----------|----------------|-----------------|
| Claude Code | `.claude/skills/{slug}/SKILL.md` | `.claude/plugins/{slug}/` |
| Cursor | `.cursor/rules/{slug}.md` | — |
| GitHub Copilot | `.github/copilot-instructions.md` (appended) | — |
| Codex CLI | `.codex/skills/{slug}/SKILL.md` | — |
| Others | Manual — prints skillsllm.com link | — |

---

## How it works

1. **Fingerprint** — detects languages, frameworks, test tools, CI, package managers, already-installed skills
2. **Fetch** — scrapes relevant categories from skillsllm.com (ai-agents, cli-tools, testing, etc.) — always fresh per run
3. **Rank** — Claude evaluates what's missing given installed skills. Scores: `relevance`, `usefulness`, `quality`, `incremental_value`. Only shows skills scoring ≥6/10 on incremental value.
4. **Install** — detects repo type (skill / plugin / bundle), installs to correct location for your platform, writes `repoloom.lock`

---

## Setting up ANTHROPIC_API_KEY

Works without a key (tag-based matching), but LLM ranking is significantly smarter.

```sh
# Current session
export ANTHROPIC_API_KEY=sk-ant-your-key-here

# Permanent (zsh)
echo 'export ANTHROPIC_API_KEY=sk-ant-your-key-here' >> ~/.zshrc && source ~/.zshrc

# Permanent (bash)
echo 'export ANTHROPIC_API_KEY=sk-ant-your-key-here' >> ~/.bashrc && source ~/.bashrc
```

---

## Requirements

- Node.js 20+
- `git` (for cloning skills from GitHub)
- `ANTHROPIC_API_KEY` (optional — enables LLM-ranked recommendations)

---

## License

MIT
