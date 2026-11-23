# Notes for Claude

Start with docs/BRIEF.md and keep it current. Keep every useful script, spec and prompt in the repo, never only in the project folder.

## Commits, pushes and CI minutes

GitHub Actions minutes are limited each month, so:

- **Fewer, larger commits.** Commit once per finished piece of work, not after every small step. Squash work-in-progress commits before pushing.
- **Push once, at the end of a task.** Every push to `main` or to a branch with an open pull request starts CI, so don't push after each commit.
- **Skip CI when it isn't needed.** For changes that don't affect the build or tests (docs, comments, notes), put `[skip ci]` in the commit message.
- **Linux runners only.** Workflow jobs use `runs-on: ubuntu-latest`. Never macOS or Windows runners: they use minutes 10× and 2× faster.
- **Don't add new workflows or triggers** (for example on every branch push, or on a schedule) without asking first.
- This repo has no GitHub Actions, but **Cloudflare rebuilds the website on every push to `main`**. Push to `main` once per finished change.
