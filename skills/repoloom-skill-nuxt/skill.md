# Nuxt 4 Development Guidelines

## Auto-Imports

- Nuxt auto-imports composables from `composables/`, utilities from `utils/`, and
  components from `components/`. Do not manually import these — the auto-import system
  handles it, and explicit imports create redundancy.
- Auto-imports are scanned recursively. Nested directories are supported:
  `composables/auth/useSession.ts` exports `useSession` without any import statement.
- If a name collision exists, use explicit imports to resolve it. Do not rely on
  auto-import priority order to silently resolve conflicts.
- Third-party composables (e.g., from VueUse) must be explicitly imported or configured
  in `nuxt.config.ts` under `imports.presets`.

## Data Fetching

- Use `useFetch` for component-level data fetching that needs SSR hydration. It is the
  standard and handles server/client consistency automatically.
- Use `useAsyncData` when you need a custom fetching function (e.g., calling a Pinia
  action, using a third-party SDK) rather than a plain URL.
- Both `useFetch` and `useAsyncData` deduplicate requests by key. Always provide an
  explicit, unique key when using `useAsyncData`. For `useFetch`, the URL is the key
  by default — make sure URLs are stable.
- Do not use `fetch` directly in `onMounted` for data that should be server-rendered.
  This causes content flicker and breaks SSR hydration.
- Refresh data with `refresh()` or `execute()` returned from `useFetch`/`useAsyncData`.
  Do not re-declare the composable call to trigger a re-fetch.

## Server Routes

- API endpoints live in `server/api/` and are exposed under `/api/`. Utility functions
  shared across server routes go in `server/utils/`.
- File naming determines the HTTP method: `server/api/users.get.ts` handles `GET /api/users`.
  For all methods, omit the suffix.
- Use `defineEventHandler` for all server route handlers. Access the request body with
  `readBody(event)`, query params with `getQuery(event)`.
- Validate request bodies with Zod or similar before any business logic. Throw
  `createError({ statusCode: 400, statusMessage: 'Invalid body' })` on failure.
- Use `server/middleware/` for logic that runs on every server request (auth, logging).
  Server middleware runs before route handlers.

## Hydration Safety

- Never access browser-only APIs (`window`, `document`, `localStorage`) at the top level
  of a component or composable. These run on the server during SSR and will throw.
- Wrap browser-only code in `onMounted` or guard with `if (import.meta.client)`.
- Use `<ClientOnly>` to wrap entire components that cannot be server-rendered (e.g.,
  components that embed third-party widgets with no SSR support). Provide a fallback
  slot to avoid layout shift.
- Hydration mismatches occur when server-rendered HTML differs from the client's first
  render. Common causes: `Date.now()`, `Math.random()`, and conditional rendering based
  on `window` checks. Use `useId()` for stable IDs.

## SSR-Safe State

- Do not use plain `ref` at module scope for state shared across requests. On the server,
  module-level state is shared across all concurrent users — this is a security and
  correctness bug.
- Use `useState` for SSR-safe reactive state. It is scoped to the current request on the
  server and hydrated to the client. Provide a unique key and a factory initializer.
- For global app state, use Pinia with `@pinia/nuxt`. Pinia stores are properly
  instantiated per request on the server.

## Route Rules and Caching

- Define rendering and caching strategy per route in `nuxt.config.ts` under `routeRules`.
- `routeRules: { '/blog/**': { isr: 3600 } }` — ISR with 1-hour revalidation.
- `routeRules: { '/api/public/**': { cache: { maxAge: 60 } } }` — CDN cache for API.
- `routeRules: { '/dashboard/**': { ssr: false } }` — client-only rendering for authenticated
  sections.
- `routeRules: { '/static-page': { prerender: true } }` — generate at build time.
- Prefer `routeRules` over per-page `definePageMeta` for site-wide caching strategies.
  It keeps the config in one place and works with edge deployment targets.

## Lazy Loading

- Prefix any component with `Lazy` to lazy-load it: `<LazyHeavyChart />` instead of
  `<HeavyChart />`. Nuxt resolves this automatically — no import changes needed.
- Use `LazyX` for components below the fold, in tabs, or inside modals. This reduces
  initial bundle size without manual `defineAsyncComponent`.
- For pages in large apps, use `definePageMeta({ keepalive: true })` sparingly. Kept-alive
  pages consume memory — only use it for pages with expensive initialization that users
  frequently return to.

## Runtime Config and Env Vars

- Use `useRuntimeConfig()` to access environment variables in components and composables.
- Public config (safe to expose to the client) goes under `runtimeConfig.public` in
  `nuxt.config.ts`. Private config (API keys, secrets) goes directly under `runtimeConfig`.
- Do not access `process.env` directly in component code. It is not available on the client.
- Prefix public env vars with `NUXT_PUBLIC_` and private vars with `NUXT_`. Nuxt
  auto-maps them to the corresponding `runtimeConfig` keys.

## Error Handling

- Use `createError({ statusCode, statusMessage, data })` in server routes and server-side
  composables. This produces a structured error that Nuxt can render with `error.vue`.
- In the page/component layer, use `useError()` to read a thrown error and `clearError()`
  to reset it. Provide a redirect on clear when appropriate.
- `error.vue` at the root handles unrecoverable errors. It receives the error object as
  a prop. Always provide a path back to a working state (home link or retry button).
