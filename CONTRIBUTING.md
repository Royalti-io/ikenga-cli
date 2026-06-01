# Contributing to @ikenga/cli

## Releases — Changesets

This repo uses [Changesets](https://github.com/changesets/changesets). **Every PR
that changes published behaviour must include a changeset.**

```bash
npx changeset          # pick patch / minor / major + write a summary
git add .changeset
```

- **patch** — bug fixes, internal-only changes
- **minor** — new backward-compatible features
- **major** — breaking changes

On merge to `main`, CI opens a **"chore: version packages"** PR that applies the
changesets (bumps the version + updates `CHANGELOG.md`). Merging that PR publishes
the new version to npm with provenance and creates a GitHub Release. Don't
hand-edit `version` or push `v*` tags manually — Changesets owns that now.
