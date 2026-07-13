# GitHub Skill

This skill activates when a `.github` directory is present. Apply these rules for all
GitHub operations — always use `gh` CLI over raw `git` or the API directly.

## Core Principle

`gh` is the right tool for anything GitHub-specific. Raw `git` handles local repo
operations (commits, branches, diffs). `gh` handles remote GitHub objects (PRs, issues,
CI, releases, reviews). Do not use `curl` against the GitHub REST API when `gh` can do
the same operation.

## Pull Request Management

```bash
# Create a PR — always include a body, never leave it empty
gh pr create --title "feat: add rate limiting" --body "$(cat <<'EOF'
## Summary
- Adds token bucket rate limiter to the API gateway
- Configurable per-route via middleware

## Test plan
- [ ] Unit tests pass
- [ ] Manual test: hit endpoint 100 times, verify 429 after limit
EOF
)"

gh pr view 42                # view PR details
gh pr view 42 --web          # open in browser
gh pr list --state open      # list open PRs
gh pr merge 42 --squash      # merge (prefer --squash for clean history)
gh pr close 42               # close without merging
gh pr checkout 42            # check out PR branch locally
```

## Issue Management

```bash
gh issue create --title "Bug: login fails on Safari" --body "..." --label bug
gh issue list --state open --label "bug"
gh issue view 17
gh issue close 17 --comment "Fixed in #42"
gh issue edit 17 --add-label "priority:high" --remove-label "triage"
```

## CI Status and Logs

```bash
gh run list                        # list recent workflow runs
gh run list --workflow=ci.yml      # filter by workflow file
gh run view 1234567890             # view run summary
gh run view 1234567890 --log       # stream full logs
gh run watch 1234567890            # block until run finishes
gh run download 1234567890         # download artifacts locally
gh run rerun 1234567890 --failed   # rerun only failed jobs
```

Always check CI status before merging. If CI is red, investigate with `gh run view`
before asking a human to look at it.

## Review Workflows

```bash
gh pr review 42 --approve
gh pr review 42 --request-changes --body "Needs tests for the error path"
gh pr review 42 --comment --body "Nit: rename this variable to be clearer"
gh pr checks 42                    # show all check statuses for a PR
```

When posting a review, always include a body — empty approvals or rejections are
not useful to the team.

## Release Management

```bash
# Tag must match package.json version — check before creating
gh release create v1.2.0 \
  --title "v1.2.0 — Add rate limiting" \
  --notes "$(cat CHANGELOG.md | head -50)" \
  --draft                          # draft first, publish after review

gh release view v1.2.0
gh release list
gh release edit v1.2.0 --draft=false   # publish draft
gh release upload v1.2.0 dist/app.tar.gz  # attach binary artifact
```

## Repository Operations

```bash
gh repo view                       # view current repo summary
gh repo clone owner/repo           # clone via gh (sets up gh auth)
gh repo fork owner/repo            # fork to your account
gh repo view owner/repo --web      # open in browser
```

## GitHub Actions — Manual Triggers

```bash
gh workflow run deploy.yml                          # trigger workflow
gh workflow run deploy.yml --field env=staging      # with inputs
gh workflow list                                    # list all workflows
gh workflow view ci.yml                             # view workflow details
```

## Search

```bash
gh search prs "is:open label:bug" --repo owner/repo
gh search issues "auth error" --repo owner/repo --state open
gh search repos "language:typescript stars:>1000" --sort stars
```

## Secrets and Variables

```bash
gh secret set API_KEY              # prompts for value
gh secret set API_KEY --body "abc" # set inline
gh secret list
gh variable set DEPLOY_ENV --body "production"
```

## Output Formatting

For scripted use, prefer `--json` with `--jq` to extract fields:

```bash
gh pr list --json number,title,state --jq '.[] | select(.state == "OPEN") | .number'
gh run list --json status,conclusion,headSha --jq '.[] | select(.status == "completed")'
```
