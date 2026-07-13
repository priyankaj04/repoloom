# Git Workflow Guidelines

## Commit Message Conventions

- Use Conventional Commits format: `<type>(<scope>): <subject>`.
  Valid types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`.
- Subject line must be ≤ 72 characters, written in imperative mood:
  "add user authentication" not "added user authentication" or "adds user authentication".
- The subject answers: "If applied, this commit will..." — complete that sentence.
- Use the body (separated from subject by a blank line) to explain WHY the change was made,
  not what changed. What is visible in the diff. Why is not.
- Reference issue numbers in the footer: `Closes #123` or `Refs #456`.
- Breaking changes go in the footer: `BREAKING CHANGE: <description>`.

## Atomic Commits

- One logical change per commit. A commit should be independently revertable without
  breaking unrelated functionality.
- Do not bundle a refactor with a feature. Do not bundle a bug fix with formatting changes.
  Split them — this makes bisect, revert, and code review tractable.
- If you find yourself writing "and" in a commit message subject, it probably needs to
  be two commits.

## Branch Naming

- Use a consistent prefix: `feature/`, `fix/`, `chore/`, `docs/`, `refactor/`.
- Follow with a short, kebab-case description: `feature/user-auth`, `fix/null-pointer-login`.
- Include a ticket/issue number when one exists: `feature/AUTH-42-oauth-integration`.
- Delete branches after merging. Stale branches accumulate into noise.

## Rebase Over Merge for Feature Branches

- Rebase feature branches onto the main branch before merging to maintain a linear history.
  `git rebase origin/main` from the feature branch.
- Linear history makes `git log`, `git bisect`, and `git blame` significantly more useful.
- Resolve conflicts during rebase interactively. This forces you to understand each
  conflict in context rather than creating a single massive merge commit.

## Squashing Before Merge

- Squash "WIP", "fixup", and intermediate commits before merging a feature branch.
  The main branch history should tell the story of features, not the story of your
  development process.
- Use `git rebase -i origin/main` to interactively squash. Squash into the first
  meaningful commit, not into a single monolithic commit unless the feature is truly atomic.
- Do not squash when merging multiple independent commits that are each meaningful —
  preserve them.

## Pull Request Best Practices

- PR description explains WHY the change exists and WHAT decision was made, not just a
  list of changed files. The diff shows what changed; the description explains the reasoning.
- Include: problem statement, approach taken, alternatives considered if non-obvious,
  testing notes, and any follow-up items.
- Keep PRs small: under 400 lines of meaningful change is a useful guideline. Large PRs
  get rubber-stamped; small PRs get reviewed. If a PR is large, consider whether it can
  be split into a stack.
- Link to the relevant ticket. Do not make reviewers search for context.
- Resolve your own comments before marking a PR ready for review. Do not leave
  TODO comments in code unless they include a ticket reference.

## Protecting Shared Branches

- Never force-push `main`, `master`, or any shared branch. Force-push rewrites history
  that others have already pulled, causing divergence and data loss.
- Branch protection rules should require: at least one approval, passing CI, and
  up-to-date with base branch before merging.
- Force-push is acceptable only on your own unshared feature branches
  (`git push --force-with-lease` — always prefer this over `--force`).

## Tagging and Releases

- Tag releases using semantic versioning: `v1.2.3`. Use annotated tags (`git tag -a`)
  so the tagger and timestamp are recorded.
- `MAJOR` bumps for breaking changes, `MINOR` for new backwards-compatible features,
  `PATCH` for backwards-compatible bug fixes.
- Write release notes that summarize user-facing changes. Automated changelogs from
  Conventional Commits work well for this.

## .gitignore

- Commit a `.gitignore` that excludes: `node_modules/`, `dist/`, `build/`, `.env`,
  `*.local`, `*.log`, IDE-specific directories (`.idea/`, `.vscode/`), OS files
  (`.DS_Store`, `Thumbs.db`), and any generated files that should not be in version control.
- Never commit secrets, credentials, or `.env` files. Add them to `.gitignore` and
  document the required variables in a `.env.example` file that is committed.

## Signed Commits

- Sign commits with a GPG or SSH key for public repositories and any repository with
  regulated data. Unsigned commits in a shared repo cannot be attributed with certainty.
- Configure signing once: `git config --global commit.gpgsign true`.
- GitHub's Vigilant Mode marks unsigned commits as unverified — a visible signal to reviewers.
