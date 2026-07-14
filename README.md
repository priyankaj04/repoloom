# repoloom

Analyze your project and get the right AI agent skills — automatically, from [skillsllm.com](https://skillsllm.com).

```sh
npx repoloom analyze
```

## What it does

`repoloom` fingerprints your project (stack, frameworks, CI, language), fetches the live skills catalog from skillsllm.com, ranks the best matches using the Claude API, and shows you the exact install commands for every platform.

Works with Claude Code, Codex CLI, Cursor, GitHub Copilot, Gemini CLI, and more.

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
repoloom analyze          # Fingerprint project, fetch live catalog, show install commands
repoloom list             # Show currently installed skills (global and local)
repoloom remove <skill>   # Uninstall a skill
repoloom publish          # Scaffold or publish a skill to npm
```

## analyze

The primary command. Fingerprints your repo, fetches skills from skillsllm.com, ranks them for your stack, and prints platform-specific install commands for the ones you choose.

```sh
npx repoloom analyze
```

Example output:

```
Recommended skills:

  1. superpowers
     Agentic skills framework — TDD, debugging, code review, git worktrees.
     https://github.com/obra/superpowers

  2. context7
     Up-to-date documentation retrieval via MCP for any library you use.
     https://github.com/upstash/context7

? Which skills would you like to install? › superpowers, context7

────────────────────────────────────────────────────────────

📦 superpowers
   Install commands:

   Claude Code:
     /plugin install superpowers@claude-plugins-official

   Codex CLI:
     codex plugin install superpowers

   GitHub (git clone):
     git clone https://github.com/obra/superpowers

📦 context7
   Install commands:

   npm:
     npm install @upstash/context7-mcp

   npx:
     npx ctx7 setup
```

Set `ANTHROPIC_API_KEY` for LLM-ranked recommendations. Without it, repoloom falls back to tag-based matching against your project's detected stack.

## How it works

1. **Fingerprint** — detects languages, frameworks, test tools, CI, package managers
2. **Fetch** — scrapes relevant categories from skillsllm.com (ai-agents, mcp-servers, cli-tools, testing, etc.) each run — always fresh
3. **Rank** — Claude picks the top 5 skills for your project (or tag-based if no API key)
4. **Install** — you pick skills, repoloom shows the exact install command per platform

## Setting up ANTHROPIC_API_KEY

`repoloom analyze` works without an API key using tag-based matching, but setting one enables smarter LLM-ranked recommendations.

### 1. Get your API key

Go to [console.anthropic.com](https://console.anthropic.com) → API Keys → **Create Key**.

### 2. Set the key

```sh
# Current session only
export ANTHROPIC_API_KEY=sk-ant-your-key-here

# Permanent (zsh)
echo 'export ANTHROPIC_API_KEY=sk-ant-your-key-here' >> ~/.zshrc && source ~/.zshrc

# Permanent (bash)
echo 'export ANTHROPIC_API_KEY=sk-ant-your-key-here' >> ~/.bashrc && source ~/.bashrc
```

### 3. Verify

```sh
echo $ANTHROPIC_API_KEY
```

## Requirements

- Node.js 20+
- `ANTHROPIC_API_KEY` (optional — enables LLM-ranked recommendations)

## License

MIT
