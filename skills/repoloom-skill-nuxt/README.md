# repoloom-skill-nuxt

Claude Code skill for Nuxt 4. Activates when a project depends on `nuxt` and guides Claude through auto-imports, SSR-safe data fetching, server routes, hydration safety, `useState` for per-request state, route rules for caching strategy, and lazy-loading with the `Lazy` prefix.

Covers: `useFetch` vs `useAsyncData` key discipline, browser-only code guards, `<ClientOnly>` usage, `routeRules` in `nuxt.config.ts`, `createError` for structured errors, `useRuntimeConfig` for env vars, and Pinia with `@pinia/nuxt`.

```bash
npx repoloom install nuxt
```
