# Motion Skill

This skill activates when the project depends on `framer-motion` or `motion`.
Apply these rules for all animation work in React.

## Motion Tokens

Define a centralized duration and spring preset map. Never hardcode easing or duration
values inline — reference tokens so the system stays consistent.

```ts
export const duration = {
  instant:  0.1,   // 100ms — immediate feedback (hover, tap)
  fast:     0.2,   // 200ms — small UI transitions
  normal:   0.3,   // 300ms — standard layout changes
  slow:     0.5,   // 500ms — entrance/exit of large elements
} as const;

export const spring = {
  snappy:  { type: "spring", stiffness: 500, damping: 35 },
  bouncy:  { type: "spring", stiffness: 300, damping: 20 },
  gentle:  { type: "spring", stiffness: 120, damping: 20 },
  stiff:   { type: "spring", stiffness: 600, damping: 45 },
} as const;
```

## AnimatePresence for Mount/Unmount

Wrap any conditionally rendered component in `AnimatePresence` so exit animations play
before the element is removed from the DOM. Always set `mode="wait"` when only one
child should be visible at a time (page transitions, tabs).

```tsx
<AnimatePresence mode="wait">
  {isVisible && (
    <motion.div key="modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0 }} transition={{ duration: duration.fast }}>
      {children}
    </motion.div>
  )}
</AnimatePresence>
```

## Layout Animations

Use `layoutId` for shared element transitions (cards expanding, list items reordering).
Wrap layout-animated elements in `<LayoutGroup>` to scope the layout context and avoid
unintended cross-component layout animations.

```tsx
<motion.div layoutId={`card-${id}`} layout>
  <CardContent />
</motion.div>
```

Use `layout="position"` or `layout="size"` when animating only one dimension to
avoid visual artifacts.

## Stagger Children

Use `delayChildren` and `staggerChildren` in a parent variant to create staggered
list entrances. Keep stagger delays short (0.05–0.08s per item) to avoid feeling slow.

```ts
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: spring.snappy },
};
```

## GPU-Accelerated Properties Only

Only animate `transform` (translate, scale, rotate) and `opacity`. Never animate
`width`, `height`, `top`, `left`, `margin`, or `padding` directly — these trigger
layout recalculation and cause jank. Use `scaleX`/`scaleY` to animate size changes
when the layout animation approach is not viable.

```tsx
// Correct
animate={{ opacity: 1, scale: 1, x: 0 }}
// Wrong — triggers layout
animate={{ width: 300, marginLeft: 16 }}
```

## useReducedMotion — Mandatory

Every component that uses motion must call `useReducedMotion()` and disable or
minimise all animations when it returns `true`. This is a WCAG requirement.

```tsx
const shouldReduceMotion = useReducedMotion();
const animation = shouldReduceMotion
  ? {}
  : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } };
```

## Variants for Multi-State Animations

Use named variants for components with 3+ animation states. String literals in
`animate` prop reference named variants, making state transitions declarative.

```tsx
const variants = {
  idle:    { scale: 1,    boxShadow: "var(--shadow-sm)" },
  hovered: { scale: 1.02, boxShadow: "var(--shadow-md)" },
  pressed: { scale: 0.98, boxShadow: "var(--shadow-sm)" },
};
<motion.button variants={variants} animate={state} />
```

## Interactive Feedback: whileHover / whileTap

Prefer `whileHover` and `whileTap` props over managing hover/press state manually.
Keep these animations instant or fast (spring.snappy or duration.instant).

```tsx
<motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
  transition={spring.snappy}>
  Click me
</motion.button>
```

## Scroll-Linked Animations

Use `useMotionValue` + `useTransform` for scroll-driven effects. Never read
`window.scrollY` in a render function. Combine with `useScroll` for element-level
scroll tracking.

```tsx
const { scrollYProgress } = useScroll({ target: ref });
const opacity = useTransform(scrollYProgress, [0, 0.3], [0, 1]);
```

## Avoid Re-Creating Motion Values on Every Render

`useMotionValue` and `useTransform` must be called at the top level of the component,
not inside event handlers, loops, or conditionals. Re-creating them on each render
breaks animation continuity and leaks memory.

## Performance Profiling

Profile animations with React DevTools Profiler. Look for components that re-render
during animations — they indicate a mis-placed motion value or an unoptimized parent.
`motion.div` does not re-render the parent on value changes; if the parent is
re-rendering anyway, find and fix the cause.
