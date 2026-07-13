# React Development Guidelines

## Component Design

- One component, one responsibility. If a component needs a long comment to explain what
  it does, it should be split.
- Prefer composition over inheritance. Extend behavior through props, children, and
  render props — not class extension.
- Keep components small. If a component's render output exceeds ~80 lines, look for
  extraction opportunities.
- Presentational components should receive all data through props and emit events through
  callbacks. They should not reach into context or global state directly.
- Container/smart components own data fetching and state. They should contain minimal JSX.
- Default to named exports. Default exports make refactoring and grep harder.

## Hooks

- `useState` initial value is only used on the first render. Do not pass expressions that
  should recompute — use `useMemo` or lazy initializer `() => computeValue()` instead.
- `useEffect` must always return a cleanup function when it sets up subscriptions, timers,
  or event listeners. Missing cleanup is a bug, not optional.
- Do not use `useEffect` to compute derived state. If a value can be calculated from
  existing state or props, calculate it inline or with `useMemo`. Adding an effect for
  this creates unnecessary render cycles.
- Do not use `useEffect` to sync state with props on every render. This pattern almost
  always signals a design problem — rethink the ownership of that state.
- `useEffect` dependency arrays must be complete. Never suppress the exhaustive-deps lint
  rule without a written justification comment. Suppressing it hides real bugs.
- Custom hooks should start with `use`, encapsulate one concern, and be independently
  testable. Extract reusable effect logic into custom hooks rather than duplicating it
  across components.
- `useCallback` and `useMemo` have a cost. Only apply them when you have a measured
  performance problem or when referential stability is required (e.g., a memoized child
  depends on a callback prop).

## Avoiding Prop Drilling

- Prop drilling more than 2 levels deep is a signal to reach for context or composition.
- For UI state shared across a subtree (theme, locale, current user), use `React.createContext`
  with a typed context value and a custom `useX` hook that throws if used outside the provider.
- For complex state logic, pair context with `useReducer` rather than a single giant
  `useState`. The reducer is independently testable.
- Before adding context, consider whether component composition (passing JSX as children
  or named slots via props) eliminates the need entirely.

## Key Props

- Always provide stable, unique `key` props when rendering lists. Using array index as key
  is only acceptable for static, never-reordered lists.
- Keys should identify the data, not the position. Use entity IDs from your data model.
- Never generate keys inside render (e.g., `Math.random()`). This defeats reconciliation.

## Performance

- `React.memo` wraps a component to skip re-renders when props are shallowly equal. Only
  apply it after measuring — it adds overhead and can hide bugs.
- Co-locate state as close to where it is used as possible. Lifting state too high causes
  unnecessary re-renders throughout the tree.
- For expensive computations that feed render output, `useMemo` is appropriate. Document
  what makes the computation expensive.
- Lazy-load heavy components with `React.lazy` and `Suspense`. This is one of the highest
  ROI performance wins available.

## Error Handling

- Every significant subtree should be wrapped in an error boundary. React does not
  catch errors in event handlers — handle those with try/catch.
- Error boundary components must be class components (or use a library like
  `react-error-boundary`). They should log errors to your observability platform and
  render a fallback UI, not a blank screen.
- Do not swallow errors silently in async event handlers. Always surface them to the user
  or to an error boundary via state.

## TypeScript

- Define component props with an interface, not inline types: `interface ButtonProps { ... }`.
- Mark optional props explicitly with `?`. Do not use `| undefined` as a substitute.
- Use `React.FC` sparingly — it hides the return type and adds implicit `children`. Prefer
  explicit return type annotation: `function Foo(props: FooProps): JSX.Element`.
- Type event handlers with the specific event type: `React.ChangeEvent<HTMLInputElement>`,
  not a generic `Event`.
- Use `React.ComponentPropsWithoutRef<'button'>` to forward native HTML element props
  without re-declaring every attribute.
- Never cast component props with `as`. Fix the types instead.
