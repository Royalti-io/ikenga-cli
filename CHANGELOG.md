# @ikenga/cli

## 0.4.0

### Minor Changes

- 793fa56: Add `ikenga doctor [--fix]` — a bridge-first health check for package installs. Detects broken/orphaned installs by driving the running shell's iyke health routes, and optionally repairs them with `--fix`.

## 0.3.3

### Patch Changes

- 6676222: Adopt Changesets for versioning + release. Version and CHANGELOG are now
  derived from per-PR changeset entries and applied by CI on merge of the
  "Version Packages" PR, replacing the previous tag-triggered flow.
