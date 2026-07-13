# TypeScript Development Guidelines

## Strict Mode

- `strict: true` must be enabled in `tsconfig.json`. This is non-negotiable. It enables
  `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, and others. Without it,
  TypeScript is a linter, not a type system.
- Also enable `noUncheckedIndexedAccess` — it forces you to handle the case where an
  array index or object key lookup returns `undefined`.
- Enable `exactOptionalPropertyTypes` in new projects. It distinguishes `{ x?: number }`
  (property may be absent) from `{ x: number | undefined }` (property must be present
  but may be undefined).

## Never Use `any`

- `any` disables the type checker for everything it touches. It propagates silently through
  your codebase and defeats the purpose of TypeScript.
- Use `unknown` for values whose type is genuinely unknown at the point of declaration.
  You must then narrow with a type guard before using the value.
- Write type guard functions: `function isUser(v: unknown): v is User { ... }`. They are
  reusable, testable, and make narrowing explicit.
- If you are tempted to use `any` to silence an error, that error is telling you something.
  Fix the types instead.

## Interfaces vs Type Aliases

- Use `interface` for object shapes that represent entities or contracts. Interfaces
  support declaration merging and are clearer in error messages.
- Use `type` for unions, intersections, mapped types, conditional types, and aliases
  for primitives.
- Do not use `type` where `interface` reads more clearly just to be consistent.
  Use the right tool: `interface` for objects, `type` for everything else.

## Discriminated Unions

- Model state machines and result types as discriminated unions, not optional fields.
- Correct: `type Result<T> = { ok: true; data: T } | { ok: false; error: string }`.
- Wrong: `type Result<T> = { ok: boolean; data?: T; error?: string }`.
- The discriminant (`ok` above) must be a literal type, not `boolean` or `string`.
- Exhaustive switch statements over discriminated unions should use a `never` assertion
  in the default branch to catch unhandled cases at compile time.

## Utility Types

- `Partial<T>` — all properties optional. Use for update/patch payloads.
- `Required<T>` — all properties required. Use when you know all fields are present.
- `Pick<T, K>` — subset of T's properties. Prefer over re-declaring shapes manually.
- `Omit<T, K>` — T without certain keys. Use for DTOs derived from domain models.
- `Record<K, V>` — typed dictionary. Prefer over `{ [key: string]: V }`.
- `ReturnType<typeof fn>` — derive return type from a function. Avoids duplication.
- `Parameters<typeof fn>` — derive parameter tuple from a function.
- `NonNullable<T>` — removes `null` and `undefined` from a union.

## Generics

- Write generic functions and types when the logic is truly reusable across multiple types.
  Do not add generics prematurely.
- Constrain generics with `extends`: `function getKey<T extends { id: string }>(item: T)`.
  Unconstrained `T` is almost always wrong.
- Name type parameters descriptively in complex generics: `TEntity`, `TKey`, `TValue`
  rather than single letters when the context is not immediately obvious.
- Default type parameters (`<T = string>`) reduce boilerplate at call sites when one
  type dominates usage.

## Type Narrowing

- Use `typeof` for primitive narrowing: `if (typeof x === 'string')`.
- Use `instanceof` for class narrowing: `if (err instanceof TypeError)`.
- Use `in` for object shape narrowing: `if ('id' in value)`.
- Use type predicate functions for complex or repeated narrowing logic.
- Avoid casting with `as`. If `as` is the only way to satisfy the type checker, the types
  are wrong. The one legitimate exception is narrowing from a union when you have
  non-typeable runtime evidence — document why.

## Modern TypeScript Features

- Use the `satisfies` operator to validate a value against a type without widening it:
  `const config = { ... } satisfies Config`. Prefer over `as Config` for assignments.
- Use `as const` for literal type preservation: `const DIRECTIONS = ['north', 'south'] as const`.
  The resulting type is `readonly ['north', 'south']`, not `string[]`.
- Use `from __future__`-style imports with `import type` for type-only imports. This
  ensures they are erased at compile time and prevents accidental runtime dependencies.
- Module augmentation (adding to third-party module types) belongs in a `*.d.ts` file
  with a corresponding `declare module` block. Never modify `node_modules`.
