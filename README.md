# @ikenga/cli

Command-line tool for managing Ikenga pkgs.

```bash
ikenga add <pkg>            # install from default registry
ikenga add @user/<pkg>      # install from namespaced registry
ikenga add <git-url>        # install from git URL (manifest at repo root)
ikenga add ./local-path     # dev install from local path

ikenga list                 # list installed pkgs + versions + update status
ikenga update <pkg>         # update one pkg
ikenga update --all         # update all pkgs (still per-pkg consent if non-stable)
ikenga remove <pkg>         # uninstall

ikenga dev <path>           # link a local pkg in dev mode (live reload)
ikenga publish              # publish a pkg from current dir to a registry
```

The CLI talks to a running Ikenga shell over a local Unix socket when one is up; otherwise it operates directly on the user's pkg directory.

## Status

`v0.0.0` — scaffold only. Subcommands stubbed.
