# Bun Skill

This skill activates when `bun.lockb` or `bunfig.toml` is present. Apply these rules
for all development work in Bun projects.

## When to Choose Bun vs Node

**Bun wins for:**
- CLI tools and one-off scripts — startup time is 4–10x faster than Node
- Greenfield APIs where you control the full stack and don't need Vercel Edge
- Projects where built-in TypeScript support matters (no `ts-node` config overhead)
- SQLite-backed apps (built-in `bun:sqlite` is fast with no native deps to compile)
- Test-heavy projects (Bun's test runner is faster than Jest/Vitest on large suites)

**Node wins for:**
- Enterprise environments with existing Node infrastructure and audited dep trees
- Vercel Edge Functions (runtime is V8/Node-compatible, not Bun)
- Projects that require native Node addons (`.node` files) — Bun's compatibility layer
  does not cover all addons
- Legacy codebases with heavy `node_modules` assumptions

Do not migrate an existing Node project to Bun unless there is a measurable benefit
and you have confirmed all critical dependencies work under Bun.

## Built-in TypeScript

Bun executes TypeScript natively — no `ts-node`, `tsx`, or `esbuild` compile step
required for running scripts. `tsconfig.json` is still respected and required.

```bash
bun run src/index.ts        # runs directly, no compile step
bun build src/index.ts --outdir dist  # bundles for production
```

## File I/O with Bun.file()

`Bun.file()` returns a lazy `BunFile` — it doesn't read until you call `.text()`,
`.json()`, or `.arrayBuffer()`. It is faster than `fs.readFile` for most file sizes.

```ts
const file = Bun.file("data.json");
const data = await file.json();
await Bun.write("output.txt", JSON.stringify(data, null, 2));
```

## HTTP Server with Bun.serve()

Use `Bun.serve()` for lightweight HTTP servers. It is faster than Node's `http.createServer`
and supports WebSocket upgrades natively.

```ts
Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/health") return new Response("ok");
    return new Response("Not Found", { status: 404 });
  },
});
```

## SQLite via bun:sqlite

`bun:sqlite` is a zero-dependency, high-performance SQLite binding. Prefer it over
`better-sqlite3` when running under Bun.

```ts
import { Database } from "bun:sqlite";
const db = new Database("app.db");
const rows = db.query("SELECT * FROM users WHERE id = ?").all(userId);
```

## Test Runner

Use `bun test` for all tests. It is Jest-compatible: `describe`, `it`, `expect`,
`beforeEach`, `afterEach` all work without changes. Mock with `jest.fn()` / `jest.spyOn()`.

```bash
bun test                    # run all tests
bun test --watch            # watch mode
bun test src/auth.test.ts   # single file
```

Do not install `jest` or `vitest` in a Bun project. Remove them if migrating from Node.

## Package Manager

Use `bun add`/`bun remove` exclusively. Never mix npm/yarn/pnpm commands in a Bun project.
Commit `bun.lockb` to version control — it is a binary lockfile and must not be
regenerated without a deliberate `bun install`.

```bash
bun add express zod           # add dependencies
bun add -d @types/node        # dev dependency
bun install                   # install from lockfile (CI)
bun remove lodash             # remove package
```

## Environment Variables

Bun automatically loads `.env`, `.env.local`, `.env.production`, etc. No `dotenv`
package is needed. Access via `process.env` or `Bun.env`.

```ts
const port = Bun.env.PORT ?? "3000";
```

## Node.js Compatibility

Bun implements most Node built-ins (`fs`, `path`, `crypto`, `http`, `stream`, etc.)
and passes the Node.js compatibility test suite. However:
- Native addons (`.node` binaries) may not work — check each addon explicitly
- `cluster` module has limited support
- Some `vm` module edge cases differ

## Bun Shell for Scripting

`Bun.$` provides a cross-platform shell for scripting in TypeScript, replacing bash
scripts that rely on Unix-only commands.

```ts
import { $ } from "bun";
const result = await $`ls -la ${dir}`.text();
await $`cp ${src} ${dest}`;
```

Use Bun Shell instead of `child_process.exec` for portability.
