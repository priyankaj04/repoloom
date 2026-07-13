# UI Polish Skill

This skill activates when the project uses React, Vue, or Svelte. Apply these rules
when building or refining any UI component.

## Spacing Scale

Use a 4px base grid. All spacing values must be multiples of 4: 4, 8, 12, 16, 20, 24,
32, 40, 48, 64, 80, 96. Never use arbitrary pixel values like 7px or 13px. Define the
scale as CSS custom properties or design tokens and reference only those.

```css
:root {
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
  --space-4: 16px; --space-6: 24px; --space-8: 32px;
  --space-12: 48px; --space-16: 64px;
}
```

## Typography

Apply a modular type scale. For body text, line-height must be 1.4–1.6. For headings,
line-height must be 1.1–1.2. Never mix more than 2 typefaces in a single UI (one for
body, one optional for headings or code). Avoid setting font-size below 14px for any
interactive or readable text.

```css
body      { font-size: 16px; line-height: 1.5; }
h1        { font-size: 2.25rem; line-height: 1.15; }
h2        { font-size: 1.75rem; line-height: 1.2; }
.caption  { font-size: 0.875rem; line-height: 1.4; }
```

## Color System

Always use semantic color tokens, not raw hex values in component code.
Define tokens for surface, border, text, brand, feedback (error/warning/success/info),
and interactive states.

```css
:root {
  --color-text-primary: #111827;
  --color-text-secondary: #6B7280;
  --color-surface: #FFFFFF;
  --color-border: #E5E7EB;
  --color-brand: #4F46E5;
  --color-error: #DC2626;
  --color-success: #16A34A;
}
```

## Shadow Layers

Use exactly 3 elevation levels. Do not invent one-off shadows per component.

```css
:root {
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
}
```

## Interactive States

Every interactive element must have visually distinct styles for all four states:
hover, focus, active, and disabled. Never omit any of these.

- **hover**: subtle background shift or underline, cursor: pointer
- **focus**: `focus-visible` outline with sufficient contrast (3:1 minimum)
- **active**: pressed-down visual (scale or darker bg)
- **disabled**: reduced opacity (0.4–0.5), cursor: not-allowed, no pointer events

```css
.btn:hover       { background: var(--color-brand-hover); }
.btn:focus-visible { outline: 2px solid var(--color-brand); outline-offset: 2px; }
.btn:active      { transform: scale(0.98); }
.btn:disabled    { opacity: 0.45; cursor: not-allowed; pointer-events: none; }
```

## Hit Targets

Minimum touch target size is 44×44px for any interactive element. If the visual
element is smaller (icon button, checkbox), pad it to meet the minimum without
changing the visual size using padding or a wrapper with `min-width`/`min-height`.

## Keyboard Navigation

Use `:focus-visible` (not `:focus`) for keyboard focus rings so mouse users don't
see focus outlines. Ensure logical tab order. Use `tabindex="0"` for custom interactive
elements, never `tabindex="-1"` unless intentionally removing from tab order.

## Loading States

Every async action (form submit, data fetch, mutation) must have a loading state.
Use skeleton screens for content areas, spinner + disabled state for buttons.
Never leave the UI unchanged while work is in progress.

## Empty States

Every list, table, or feed must have a designed empty state. Empty state must include:
an illustration or icon, a title explaining why it's empty, and a primary action CTA.
No raw "No data" text.

## Error States

Every form field must show inline error messages below the field, not in a toast.
Error messages must be specific ("Email must be a valid address") not generic ("Invalid
input"). Pair with a red border or icon. Provide a recovery path in the error message.

## Reduced Motion

Wrap all CSS transitions and animations with a `prefers-reduced-motion` media query.
For Framer Motion, use the `useReducedMotion` hook. When reduced motion is preferred,
substitute instant transitions for animated ones — never remove state changes entirely.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0.01ms !important; }
}
```
