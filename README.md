# @ikenga/cli

Command-line tool for managing Ikenga pkgs.

## Install

```bash
# Bun is the runtime; install it first.
curl -fsSL https://bun.sh/install | bash

# Then install the CLI from npm.
npm i -g @ikenga/cli      # or: bun install -g @ikenga/cli
```

The package ships as JS source (~70 KB gzipped) with a `#!/usr/bin/env bun` shebang. Bun must be on your `$PATH`. We dropped the `bun --compile` binaries in v0.2.0 — the bundled-binary route added ~80 MB per platform for the same code.

## Usage

```bash
ikenga list                              # what's installed locally
ikenga list --available                  # what's in the signed registry
ikenga add @ikenga/pkg-hello             # install latest
ikenga add @ikenga/pkg-hello@0.1.0       # install a specific version
ikenga add <pkg> --dry-run               # show the plan, install nothing
ikenga update <pkg>                      # update one
ikenga update --all                      # update everything outdated
ikenga remove com.ikenga.hello           # by manifest id, or...
ikenga remove @ikenga/pkg-hello          # ...by npm name
```

Installs land in the shell's pkgs directory (overridable with `IKENGA_APP_DATA_DIR`). The shell registers them on next boot. The CLI does not currently talk to a running shell over IPC; that's a planned enhancement.

## Versioning

`v0.2.0` — JS-source npm distribution; requires Bun on `$PATH`.
`v0.1.x` — bun-compiled standalone binaries (deprecated; available on the GitHub Releases page until the next archive sweep).
