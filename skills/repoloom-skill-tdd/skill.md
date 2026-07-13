# TDD Skill Instructions

You are practicing test-driven development. Follow the red-green-refactor cycle rigorously.

## The Red-Green-Refactor Cycle

1. **Red**: Write a failing test that describes the behavior you want. Run it. Confirm it fails
   for the right reason — not a compilation error, but a genuine assertion failure.
2. **Green**: Write the minimum code to make the test pass. Do not over-engineer. Hardcoding
   is acceptable at this stage if it makes the test green.
3. **Refactor**: Clean up the implementation without changing behavior. The tests are your
   safety net. Rename, extract, simplify — then run the tests again.

Never skip step 1. A test written after the implementation is a verification, not a design tool.
The value of TDD is in the thinking that happens while writing the test.

## Write the Failing Test First

Before opening the implementation file, write the test:

```typescript
// Step 1: RED — write this first
it("should return an empty cart when no items have been added", () => {
    const cart = new ShoppingCart();
    expect(cart.total()).toBe(0);
    expect(cart.items()).toHaveLength(0);
});
```

Run it. See it fail. Now open the implementation file.

## Minimal Implementation to Pass

Write only what is needed to make the current failing test pass:

```typescript
// Step 2: GREEN — simplest possible implementation
class ShoppingCart {
    total() { return 0; }
    items() { return []; }
}
```

Resist the urge to implement the full feature. The next test will drive the next behavior.

## One Assertion Per Test Concept

Each test asserts one logical thing. "One assertion" does not mean literally one
`expect()` call — it means one conceptual behavior:

```typescript
// Bad — two independent behaviors in one test
it("should add an item and update the total", () => {
    cart.add({ name: "Book", price: 10 });
    expect(cart.items()).toHaveLength(1);  // behavior 1
    expect(cart.total()).toBe(10);          // behavior 2 (related — acceptable)
});

// Better — split if failures of each need different diagnosis
it("should include the item in the cart after adding", () => { ... });
it("should reflect the item price in the total after adding", () => { ... });
```

When a test fails, the name should tell you exactly what broke.

## Test Behavior, Not Implementation

Tests should not know how the implementation works internally. They test what the code
does, not how it does it:

```typescript
// Bad — tests internal structure
expect(cart._items.length).toBe(1);
expect(cart._calculateTotal).toHaveBeenCalled();

// Good — tests observable behavior
expect(cart.items()).toHaveLength(1);
expect(cart.total()).toBe(10);
```

If refactoring the implementation (without changing behavior) breaks a test, the test
is testing implementation, not behavior. Fix the test.

## Descriptive Test Names

Test names are documentation. A failing test name should tell you what is broken
without reading the test body:

```typescript
// Bad
it("works", ...)
it("test 1", ...)
it("handles edge case", ...)

// Good — should / given-when-then style
it("should return 0 when no items are in the cart")
it("should apply the discount when the coupon code is valid")
it("should throw InvalidCouponError when the coupon is expired")
```

describe blocks add context: `describe("ShoppingCart")`, `describe("when the cart is empty")`.

## Mock at System Boundaries Only

Mock external dependencies — network calls, databases, file system, clocks. Do not mock
internal collaborators:

```typescript
// Correct — mock the DB at the boundary
const mockRepo = { findById: jest.fn().mockResolvedValue(user) };
const service = new UserService(mockRepo);

// Wrong — mocking an internal method of the unit under test
jest.spyOn(service, "_formatUser").mockReturnValue(formatted);
```

If you find yourself mocking the internals of the unit you are testing, the design
probably needs to be split into smaller, independently testable units.

## Test the Full Scenario Matrix

For every function, cover:
1. **Happy path**: correct input, expected output.
2. **Error cases**: invalid input, missing dependencies, external failures.
3. **Edge cases**: empty collections, zero values, boundary conditions, concurrent access.

```typescript
describe("divide(a, b)")
    it("should return the quotient for positive integers")
    it("should return a float when division is not exact")
    it("should throw DivisionByZeroError when b is 0")
    it("should handle negative dividends correctly")
    it("should handle negative divisors correctly")
```

If you cannot enumerate these cases, you do not understand the requirement well enough to implement it.

## Never Skip or Comment Out Failing Tests

A commented-out or skipped test is a lie — it tells the CI system the behavior is covered when it is not.

```typescript
// NEVER do this
it.skip("should handle concurrent modifications", ...)
xit("should reject duplicate submissions", ...)
```

If a test is failing, there are two valid responses:
1. Fix the implementation.
2. Delete the test if the behavior it tests is no longer a requirement — and document why.

Keeping `skip` tests is technical debt that compounds.

## Coverage Target: 80%, Not 100%

Aim for 80%+ line and branch coverage. The last 20% (trivial getters, logging statements,
defensive type assertions) costs more in test maintenance than it provides in safety.

Do not write tests purely to hit a coverage number. A test that exists only to execute
lines, with no meaningful assertion, is worse than no test — it gives false confidence.

Focus coverage efforts on:
- Business logic with branching
- Error handling paths
- Data transformation functions
- Public API contracts

## Mutation Testing for Critical Paths

Unit test coverage tells you which lines ran, not whether the tests would catch a bug.
Use mutation testing to verify your tests actually detect regressions:

```bash
# JavaScript
npx stryker run

# Python
mutmut run
```

A surviving mutant means a bug could be introduced on that line without any test failing.
Run mutation testing on payment logic, authorization checks, and data validation — the
paths where a bug has the highest cost.
