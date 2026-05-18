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
ikenga dev ./my-pkg                      # hot-mount into running shell
```

`list / add / update / remove` mutate the shell's pkgs directory (overridable with `IKENGA_APP_DATA_DIR`); the shell registers them on next boot.

### `ikenga dev <path>` — hot-mount for development

Different shape: `dev` talks to a **running** shell over its localhost iyke bridge instead of touching disk. Registers the pkg with `source.kind = "dev"` (auto-trusted, regardless of id namespace) and spawns a manifest watcher in the kernel so edits to `manifest.json` or any `restart_when_changed` glob trip an in-place reload — no shell restart.

Requires the shell to be running. The CLI discovers its port + bearer token from `control.json` in the shell's local data dir.

```bash
ikenga dev /home/me/code/my-pkg
# → mounted as com.example.my-pkg v0.1.0
# →   Routes: /pkg/com.example.my-pkg/
# Edit manifest.json or watched src/ files; reload fires automatically.
# Ctrl-C to unregister.
```

Iframe code changes flow through your dev server's HMR (Vite, Next, …); sidecar / MCP source edits respawn via the supervisor watcher; manifest edits trigger a full pkg reload that emits a `pkg-reloaded` event the shell's iframe + webview hosts listen for. See [`docs/pkg-patterns/07-dev-mode.md`](https://github.com/Royalti-io/ikenga/blob/main/docs/pkg-patterns/07-dev-mode.md) for the kernel semantics.

## Versioning

`v0.3.0` — adds `ikenga dev <path>` for hot-mounting pkgs into a running shell via the iyke localhost bridge. Watcher-driven manifest reload + clean `Ctrl-C` unregister. Requires the corresponding shell-side dev-mode kernel (lands in shell `v0.0.5+`).
`v0.2.0` — JS-source npm distribution; requires Bun on `$PATH`.
`v0.1.x` — bun-compiled standalone binaries (deprecated; available on the GitHub Releases page until the next archive sweep).
