# Playwright E2E Testing Guidelines

## Page Object Model

- Encapsulate every page or significant component in a Page Object class. The test file
  should read like a user story; the page object handles all DOM interaction.
- Page objects expose actions (`login()`, `submitForm()`) and assertions (`expectErrorVisible()`)
  — not raw locators. Tests call methods, not `.locator()`.
- Keep one page object per route or major UI region. Shared widgets (modals, navbars) get
  their own class and are composed into page objects as properties.
- Page objects should not contain assertions about business logic. Assertions belong in
  the test. Page objects can expose `waitForVisible()` helpers but not `expect()` calls.

## Selectors

- Use `data-testid` attributes for anything not expressible through semantic locators.
  CSS classes and implementation-specific selectors break when the UI is restyled.
- Prefer semantic/user-facing locators in this priority order:
  1. `getByRole` — reflects ARIA semantics, survives implementation changes
  2. `getByLabel` — for form fields, ties to the visible label
  3. `getByPlaceholder` — for unlabelled inputs as fallback
  4. `getByText` — for buttons and links where text is stable
  5. `getByTestId` — last resort when no semantic anchor exists
- Never select by class name, element tag, or XPath unless there is no alternative and
  you document why.

## Avoiding Hard-Coded Waits

- Never use `page.waitForTimeout()` in tests. It is a red flag in every code review.
- Use `waitFor` on locators: `await locator.waitFor({ state: 'visible' })`.
- Use `expect(locator).toBeVisible()` — Playwright auto-waits on expect assertions.
- For network-driven transitions, use `page.waitForResponse()` or `page.waitForURL()`.
- If a test requires a sleep to be reliable, the application has a timing bug — surface it
  rather than working around it.

## Test Isolation

- Each test must set up its own state and clean up after itself. No test should depend on
  execution order or data created by another test.
- Seed test data through the API or database layer, not through UI flows. UI-based setup
  is slow and fragile. Use `request` fixture for API calls in `beforeEach`.
- Reset application state (DB, session) before each test using test hooks or a dedicated
  reset endpoint in your test environment.
- Never share mutable state between tests via module-level variables or `global`.

## Auth State Reuse

- Authenticating through the UI in every test is the single biggest E2E performance killer.
- Use Playwright's `storageState` to save authenticated browser state once per test run
  and reuse it across tests in the same role.
- Define a `globalSetup` that authenticates and saves state to a file. Reference it with
  `storageState` in `playwright.config.ts`.
- For multi-role tests (admin/user), maintain a separate state file per role.

## Parallel Execution

- Playwright runs tests in parallel by default. Write every test as if it runs concurrently
  with all others.
- Isolate test data by generating unique identifiers per test (`test.info().testId`).
- Do not share ports, files, or database rows between parallel tests.
- Set `workers` in `playwright.config.ts` to match CI machine capacity, not dev machine.

## CI Configuration

- Enable retries for CI only: `retries: process.env.CI ? 2 : 0`. Do not retry locally —
  flakiness should be visible during development.
- Capture screenshots and traces on failure: set `screenshot: 'only-on-failure'` and
  `trace: 'on-first-retry'` in the project config.
- Upload the `playwright-report` and `test-results` directories as CI artifacts so trace
  viewer is accessible without re-running locally.
- Use `--shard` flag to split the test suite across multiple CI runners for large suites.

## Debugging

- The trace viewer (`npx playwright show-trace`) records every action, network request,
  and screenshot. It is the first tool to reach for when investigating CI failures.
- Use `page.pause()` in `--headed` mode to step through a test interactively. Remove
  before committing.
- `PWDEBUG=1` launches the inspector automatically without modifying test code.
