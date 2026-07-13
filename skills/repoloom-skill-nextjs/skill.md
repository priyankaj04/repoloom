# Next.js Development Guidelines

## App Router vs Pages Router

- This project uses the App Router (`app/` directory). Do not add files to `pages/` unless
  specifically maintaining legacy routes. The two routers can coexist but mixing them for
  new work creates long-term confusion.
- App Router uses the filesystem as the routing API. Segment names map to URL segments.
  Special files: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`,
  `route.ts` (API), `middleware.ts` (edge).

## Server vs Client Components

- All components in the App Router are Server Components by default. This is the right
  default — lean into it.
- Add `'use client'` only when a component needs: browser APIs, event listeners, React
  state, or React effects. If you are adding it to a component that does none of these,
  remove it.
- Push `'use client'` to the leaves of the component tree. A large client boundary
  eliminates the bundle-size and performance benefits of Server Components.
- Server Components can import and render Client Components. Client Components cannot
  import Server Components directly (they can receive them as `children` props).
- Do not call `fetch` inside a Client Component to load initial page data. That data
  should be fetched in a Server Component and passed down as props.

## Data Fetching

- Fetch data in Server Components using the extended `fetch` API with `cache` and
  `next.revalidate` options.
- `fetch(url, { cache: 'force-cache' })` — static, cached indefinitely until revalidated.
- `fetch(url, { next: { revalidate: 60 } })` — ISR, revalidate every 60 seconds.
- `fetch(url, { cache: 'no-store' })` — dynamic, never cached.
- Do not use `useEffect` + `fetch` to load data that is known at render time. This causes
  waterfalls and poor initial load performance.
- Use `React.cache()` to deduplicate identical fetch calls across a single render tree.

## Server Actions

- Define Server Actions in files marked with `'use server'` at the top, or inline within
  Server Components using `async function` with the directive.
- Server Actions are the correct way to handle form submissions and mutations from Client
  Components. Do not create a separate API route just to proxy a mutation.
- Validate all inputs in Server Actions using Zod or equivalent. Never trust client input.
- Return structured results from Server Actions, not thrown errors, so Client Components
  can handle both success and failure states.

## Route Handlers

- API endpoints live in `app/api/.../route.ts`. Export named async functions: `GET`,
  `POST`, `PUT`, `PATCH`, `DELETE`.
- Use `NextRequest` and `NextResponse` from `next/server`.
- For auth-protected routes, check the session at the top of the handler before any logic.
- Prefer Server Actions over Route Handlers for mutations triggered from your own UI.
  Route Handlers are for third-party webhooks, public APIs, and non-form interactions.

## Rendering Strategy

- Static rendering is the default and the fastest option. A page is static when it
  doesn't use cookies, headers, or uncached `fetch` at render time.
- Dynamic rendering is triggered automatically when a segment calls `cookies()`,
  `headers()`, or uses `cache: 'no-store'`. You rarely need `export const dynamic = 'force-dynamic'`.
- Use `generateStaticParams` for dynamic routes that should be pre-rendered at build time
  (e.g., blog post slugs, product pages).

## Images, Fonts, and Metadata

- Always use `next/image` for images. Set explicit `width` and `height` or use `fill` with
  a positioned parent. Never skip `alt`.
- Use `next/font` to load fonts. It eliminates layout shift and avoids external network
  requests at runtime.
- Define page metadata using the `metadata` export or `generateMetadata` function in
  `page.tsx` and `layout.tsx`. Do not use `<head>` tags directly.

## Error and Loading States

- Add `loading.tsx` to route segments that have slow data fetching. This enables React
  Suspense streaming without extra code.
- Add `error.tsx` to route segments where data fetching can fail. The component receives
  the error and a `reset` function. Always provide both a message and a retry action.
- `not-found.tsx` handles `notFound()` calls from Server Components. Add one at the app
  level and override it per segment as needed.

## Turbopack

- Turbopack is the default dev bundler in Next.js 15+. Do not add `--turbopack` manually;
  it is already active.
- Turbopack does not support all webpack plugins. If a custom webpack plugin is required,
  document why and keep it in `next.config.ts` under `webpack()`, not as a Turbopack config.
