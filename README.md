# repoloom

Analyze your project and install the right [Claude Code](https://claude.ai/code) skills from npm — automatically.

```sh
npx repoloom analyze
```

## What it does

`repoloom` fingerprints your project (stack, frameworks, CI, language), ranks relevant Claude Code skills using the Claude API, and installs them so your AI-assisted engineering sessions are tuned to your repo.

Skills are npm packages following the `repoloom-skill-*` convention. Install them globally for personal use, or locally with a `repoloom.lock` so your whole team shares the same skill set.

## Installation

No install required — use via npx:

```sh
npx repoloom <command>
```

Or install globally:

```sh
npm install -g repoloom
```

## Commands

```sh
repoloom analyze          # Fingerprint project, rank skills, install selected
repoloom install <skill>  # Install a specific skill by package name
repoloom sync             # Install all skills from repoloom.lock
repoloom list             # Show installed skills (global and local)
repoloom remove <skill>   # Uninstall a skill
repoloom publish          # Scaffold or publish a skill to npm
```

## analyze

The primary command. Reads your project, calls the Claude API to rank relevant skills, and lets you pick which to install.

```sh
npx repoloom analyze           # auto-detects mode (local if repoloom.lock exists)
npx repoloom analyze --local   # install to .claude/skills/ (team-shared)
npx repoloom analyze --global  # install to ~/.claude/plugins/ (personal)
```

Set `ANTHROPIC_API_KEY` for LLM-ranked recommendations. Without it, repoloom falls back to tag-based matching.

## Team workflow

```sh
# One teammate sets up skills for the project
npx repoloom analyze --local
git add repoloom.lock .claude/skills/
git commit -m "add repoloom skills"

# Everyone else gets the same skills on clone
npx repoloom sync
```

## Writing and publishing skills

Scaffold a new skill:

```sh
npx repoloom publish
```

Or, if you already have a skill package:

```sh
cd repoloom-skill-myskill
npx repoloom publish
```

A skill package contains:

```text
repoloom-skill-<name>/
├── skill.md        # Claude Code instructions
├── skill.json      # manifest: tags, triggers, targets
└── package.json    # npm config (name must match repoloom-skill-*)
```

`skill.json` example:

```json
{
  "name": "fastapi",
  "description": "Best practices for FastAPI projects",
  "tags": ["python", "fastapi", "backend"],
  "triggers": {
    "dependencies": ["fastapi"]
  },
  "targets": ["claude-code"],
  "version": "1.0.0"
}
```

## Requirements

- Node.js 20+
- `ANTHROPIC_API_KEY` (optional — enables LLM ranking)

## License

MIT
