# @ikenga/cli

## 0.5.0

### Minor Changes

- 5f06fa7: Add `ikenga --help --json`, which prints the command reference as JSON. The published package now includes the same document as `dist/cli.json`. The help text itself is unchanged, byte for byte; it is now rendered from the same command table.

## 0.4.2

### Patch Changes

- 78e2a03: fix(install): materialize npm dependencies on package install (#9); test webview-kind installs against a local signed index (#10)

## 0.4.1

### Patch Changes

- 30c7130: Point the registry at `registry.ikenga.dev` instead of the GitHub-hosted
  `royalti-io.github.io` URL. Same content, same signing key — a hostname we own,
  so the registry no longer depends on which GitHub org holds the repo.

## 0.4.0

### Minor Changes

- 793fa56: Add `ikenga doctor [--fix]` — a bridge-first health check for package installs. Detects broken/orphaned installs by driving the running shell's iyke health routes, and optionally repairs them with `--fix`.

## 0.3.3

### Patch Changes

- 6676222: Adopt Changesets for versioning + release. Version and CHANGELOG are now
  derived from per-PR changeset entries and applied by CI on merge of the
  "Version Packages" PR, replacing the previous tag-triggered flow.
