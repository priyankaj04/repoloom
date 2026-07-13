# Vue 3 Development Guidelines

## Composition API

- Use the Composition API for all new components. The Options API is still valid but the
  Composition API offers better TypeScript support, more explicit data flow, and easier
  logic reuse through composables.
- `<script setup>` is the preferred form. It is less verbose than `defineComponent` + `setup()`,
  compiles away the boilerplate, and makes component internals private by default.
- Do not mix Options API and Composition API within the same component.

## Reactivity: ref vs reactive

- Use `ref` for primitive values: strings, numbers, booleans, and `null`. Access the
  underlying value with `.value` in script; Vue unwraps it automatically in templates.
- Use `reactive` for objects and arrays when you want to access properties without `.value`.
  Be aware that destructuring a `reactive` object loses reactivity — use `toRefs()` if
  you need to destructure.
- Prefer `ref` over `reactive` for top-level state declarations. It is more explicit and
  avoids the destructuring pitfall.
- `shallowRef` and `shallowReactive` exist for performance-critical cases with large
  objects. Use them only when profiling confirms the need.

## Computed Properties

- Use `computed()` for any value derived from reactive state. Do not re-derive the same
  value in the template or in multiple places.
- Computed properties are lazy and cached — they only recompute when their reactive
  dependencies change.
- Computed properties must be pure. Do not perform side effects (API calls, mutations)
  inside a computed getter.
- For writable computed properties, define both `get` and `set`. Do not mutate a computed
  value's dependencies inside the getter.

## Watchers

- `watchEffect` runs immediately and tracks its reactive dependencies automatically. Use
  it when you need a side effect that should re-run whenever any accessed reactive value
  changes, and you do not need the old value.
- `watch` is explicit about its source. Use it when you need the previous value, want
  lazy execution (not immediate), or need to watch a specific source precisely.
- Always clean up side effects in watchers using the `onCleanup` callback parameter. This
  prevents stale async operations from completing after a component unmounts.
- Do not use watchers to sync reactive state to other reactive state. Use `computed` for that.

## Composables

- Extract reusable stateful logic into composable functions in `src/composables/`. Name
  them with the `use` prefix: `useAuth`, `useDebounce`, `usePagination`.
- A composable must be called at the top level of `<script setup>` or another composable,
  not inside conditionals or loops. This ensures lifecycle hooks and watchers are
  registered correctly.
- Composables should accept options as a plain object argument, not many positional params.
- Return a plain object from composables, not a `reactive` wrapper. This keeps destructuring
  predictable and avoids reactivity loss surprises.

## Pinia for State Management

- Use Pinia for all global/shared state. Do not use Vuex in new code.
- Define stores with `defineStore`. Prefer the setup syntax (function body) over the
  options syntax when the store has complex logic or needs to compose other stores.
- Store ID strings must be unique across the app and match the store's purpose: `'auth'`,
  `'cart'`, `'notifications'`.
- Do not mutate store state directly from outside the store. All mutations go through
  store actions. This keeps state changes traceable.
- Keep stores focused. A store that manages both user auth and UI preferences is doing
  too much — split it.

## Component Communication

- Define props with `defineProps<{ ... }>()` using TypeScript generics. Provide defaults
  with `withDefaults(defineProps<...>(), { ... })`.
- Define emits with `defineEmits<{ ... }>()` using the TypeScript call signature form.
  This gives full type safety on event payloads.
- Avoid mutating props. If a parent value needs to change in response to child interaction,
  emit an event and let the parent update it.
- For two-way binding, use `v-model` with `defineModel()` (Vue 3.4+) instead of manually
  wiring `:modelValue` + `@update:modelValue`.

## Templates

- Use `v-bind` shorthand (`:prop`) and `v-on` shorthand (`@event`) consistently.
- `v-bind` without an argument spreads an object of bindings: `v-bind="attrs"`. Use this
  to forward attributes to a root element rather than re-declaring each one.
- Use template refs (`ref="el"`) to access DOM elements and child component instances.
  Type them with `ref<HTMLInputElement | null>(null)` and guard against null before use.
- Always provide a `:key` on `v-for` directives. Use stable entity IDs, not array indices.
- `v-if` and `v-for` should not be on the same element. Wrap with a `<template>` tag or
  move the condition outside the loop.

## Lifecycle Hooks

- `onMounted` is the correct place to access the DOM, initialize third-party libraries,
  or start subscriptions.
- `onUnmounted` must clean up any subscriptions, timers, or event listeners started in
  `onMounted`. Missing cleanup is a memory leak.
- `onBeforeUnmount` is for synchronous cleanup that must happen before the component
  teardown begins.
- Avoid `onUpdated` unless you need post-update DOM access. Use `watchEffect` or `watch`
  for reactive side effects instead.
