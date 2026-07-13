# Frontend Patterns Skill Instructions

You are working on a frontend application (React, Vue, Svelte, or similar). Apply these
architecture and performance patterns consistently.

## Container / Presentational Component Split

Separate data-fetching from rendering. Presentational components are pure: given props,
return markup. No API calls, no store access, no side effects.

```tsx
// Presentational — pure, testable, reusable
function UserCard({ name, avatarUrl, role }: UserCardProps) {
    return (
        <div className="user-card">
            <img src={avatarUrl} alt={name} />
            <h3>{name}</h3>
            <span>{role}</span>
        </div>
    );
}

// Container — fetches data, passes to presentational
function UserCardContainer({ userId }: { userId: string }) {
    const { data, isLoading, error } = useUser(userId);
    if (isLoading) return <Skeleton />;
    if (error) return <ErrorMessage error={error} />;
    return <UserCard {...data} />;
}
```

This split makes presentational components trivially testable (no mocking required)
and reusable across different data sources.

## Co-locate State — Lift Only When Needed

State lives as close to where it's used as possible. Lift state only when two sibling
components genuinely need to share it. Do not hoist to a global store preemptively.

State escalation order:
1. Local component state (`useState`, `ref`)
2. Lifted to nearest common parent
3. Context (for non-performance-critical global data: auth user, theme, locale)
4. External store (Zustand, Pinia, Redux) — only for complex shared state with actions

Putting everything in a global store is an anti-pattern. It creates hidden coupling and
makes components impossible to test in isolation.

## URL as State for Shareable Views

Any state the user would want to share via a link belongs in the URL:
- Current filters, sort order, search query
- Active tab or step in a multi-step flow
- Selected record IDs

```tsx
// Bad — filter state in component, URL shows nothing
const [status, setStatus] = useState("active");

// Good — filter state in URL, shareable and bookmarkable
const [searchParams, setSearchParams] = useSearchParams();
const status = searchParams.get("status") ?? "active";
```

Sync URL to state on every user action that changes the view. This also makes
the back button work correctly.

## Optimistic Updates for UX

For mutations the user initiates (like, save, delete), update the UI immediately
and roll back on failure. This eliminates perceived latency:

```tsx
const mutation = useMutation({
    mutationFn: (id: string) => api.delete(`/items/${id}`),
    onMutate: async (id) => {
        await queryClient.cancelQueries({ queryKey: ["items"] });
        const previous = queryClient.getQueryData(["items"]);
        queryClient.setQueryData(["items"], (old) =>
            old.filter((item) => item.id !== id)
        );
        return { previous };
    },
    onError: (_err, _id, context) => {
        queryClient.setQueryData(["items"], context.previous);
        toast.error("Delete failed. Please try again.");
    },
});
```

Always show an error and roll back on failure — never silently swallow mutations.

## Code Splitting at Route Level

Split bundles at route boundaries so users only download what they need:

```tsx
// React lazy loading
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Settings  = lazy(() => import("./pages/Settings"));

<Suspense fallback={<PageSkeleton />}>
    <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings"  element={<Settings />} />
    </Routes>
</Suspense>
```

Do not lazy-load components that appear above the fold on the initial render — that
adds a waterfall. Lazy-load secondary routes, modals, and heavy visualizations.

## Image Lazy Loading and Size Optimization

Always specify `width` and `height` to prevent layout shift. Use native lazy loading:

```tsx
<img
    src={photo.url}
    alt={photo.description}
    width={800}
    height={600}
    loading="lazy"
    decoding="async"
/>
```

Serve images in modern formats (WebP/AVIF). Use a CDN with `srcset` for responsive sizing.
Never load a 2000px image to display it at 200px.

## Font Display Swap

Prevent invisible text during font load:

```css
@font-face {
    font-family: "Inter";
    src: url("/fonts/inter.woff2") format("woff2");
    font-display: swap; /* show fallback font immediately, swap when loaded */
}
```

Preload fonts used above the fold:

```html
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin />
```

## Bundle Analysis Before Adding Dependencies

Before `npm install <anything>`:
1. Check bundlephobia.com for size and tree-shaking support.
2. Ask: can this be replaced with 10 lines of code?
3. Prefer dependencies that support tree-shaking (ESM, `sideEffects: false`).

Run `npx vite-bundle-visualizer` (or `webpack-bundle-analyzer`) before releases to
catch accidental bloat. Set a bundle size budget in CI.

## CSS Modules or Utility-First Over Global Styles

Never write unscoped global CSS that targets element types or uses non-namespaced class names.
These rules collide at scale.

Use CSS Modules for component-scoped styles or a utility-first framework (Tailwind):

```tsx
// CSS Modules
import styles from "./Button.module.css";
<button className={styles.primary}>Submit</button>

// Utility-first
<button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
    Submit
</button>
```

Global styles are only acceptable for: CSS resets, design tokens (custom properties),
and typography defaults on `body`.

## Accessibility — Non-Negotiable

- Use semantic HTML: `<nav>`, `<main>`, `<button>`, `<article>` — not `<div>` for everything.
- Every interactive element must be reachable by keyboard. Test with Tab key.
- Every image needs a meaningful `alt` attribute (or `alt=""` for decorative images).
- Color contrast must meet WCAG AA (4.5:1 for normal text, 3:1 for large text).
- Add `aria-label` to icon-only buttons: `<button aria-label="Close dialog">✕</button>`.
- Modals and drawers must trap focus and return focus on close.

Run `axe-core` in tests to catch regressions automatically.

## Error Boundaries at Page Level

Wrap each route/page in an error boundary to prevent a single component crash from
taking down the entire application:

```tsx
class PageErrorBoundary extends React.Component {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        logger.error("Page render error", { error, componentStack: info.componentStack });
    }

    render() {
        if (this.state.hasError) return <ErrorPage />;
        return this.props.children;
    }
}
```

Do not place a single error boundary at the root — granular boundaries let the rest of
the app function while one page is broken.
