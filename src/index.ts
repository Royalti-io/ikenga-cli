#!/usr/bin/env bun
// `ikenga` — disk-side pkg manager for the Ikenga shell. Installs into the
// same <app_data_dir>/pkgs/ directory the shell's kernel scans at boot, so
// a CLI install becomes visible to the shell after restart.
//
// We deliberately don't talk to a running shell over IPC today; that's a
// future enhancement (the README hints at a localhost socket). Today the
// flow is: CLI mutates disk → user restarts shell → kernel registers.

import { addCommand } from './commands/add.js';
import { devCommand } from './commands/dev.js';
import { listCommand } from './commands/list.js';
import { removeCommand } from './commands/remove.js';
import { updateCommand } from './commands/update.js';

const SUBCOMMANDS = ['list', 'add', 'update', 'remove', 'dev'] as const;
type Subcommand = (typeof SUBCOMMANDS)[number];

function usage(): string {
	return `ikenga — pkg manager for the Ikenga shell

Usage:
  ikenga list [--available] [--json]
  ikenga add <pkg>[@<version>] [--dry-run]
  ikenga update [<pkg> | --all] [--dry-run]
  ikenga remove <pkg>
  ikenga dev <path>

Examples:
  ikenga list                              # what's installed locally
  ikenga list --available                  # what's in the registry
  ikenga add @ikenga/pkg-hello             # install latest
  ikenga add @ikenga/pkg-hello@0.1.0       # install a specific version
  ikenga update --all                      # update everything outdated
  ikenga remove com.ikenga.hello           # by manifest id, or...
  ikenga remove @ikenga/pkg-hello          # ...by npm name
  ikenga dev ./my-pkg                      # hot-mount into running shell

Installs land in the shell's pkgs directory (overridable with
IKENGA_APP_DATA_DIR). The shell registers them on next boot.

\`ikenga dev <path>\` is different — it talks to a running shell over its
localhost iyke bridge, registers the pkg with hot-reload semantics
(manifest edits trigger an in-place reload, no shell restart), and
unregisters cleanly on Ctrl-C. Requires the shell to be running.
`;
}

async function main(): Promise<number> {
	const argv = process.argv.slice(2);
	const sub = argv[0];

	if (!sub || sub === '--help' || sub === '-h') {
		process.stdout.write(usage());
		return 0;
	}
	if (sub === '--version' || sub === '-V') {
		process.stdout.write(`ikenga ${process.env.IKENGA_CLI_VERSION ?? 'dev'}\n`);
		return 0;
	}

	if (!(SUBCOMMANDS as readonly string[]).includes(sub)) {
		process.stderr.write(`unknown command: ${sub}\n\n`);
		process.stdout.write(usage());
		return 1;
	}

	const rest = argv.slice(1);
	switch (sub as Subcommand) {
		case 'list': {
			const available = rest.includes('--available') || rest.includes('-a');
			const json = rest.includes('--json');
			return listCommand({ available, json });
		}
		case 'add': {
			const spec = rest.find((a) => !a.startsWith('-'));
			if (!spec) {
				process.stderr.write('usage: ikenga add <pkg>[@<version>] [--dry-run]\n');
				return 1;
			}
			return addCommand(spec, { dryRun: rest.includes('--dry-run') });
		}
		case 'update': {
			const all = rest.includes('--all');
			const target = rest.find((a) => !a.startsWith('-')) ?? null;
			return updateCommand(target, { all, dryRun: rest.includes('--dry-run') });
		}
		case 'remove': {
			const spec = rest.find((a) => !a.startsWith('-'));
			if (!spec) {
				process.stderr.write('usage: ikenga remove <pkg>\n');
				return 1;
			}
			return removeCommand(spec);
		}
		case 'dev': {
			const path = rest.find((a) => !a.startsWith('-'));
			if (!path) {
				process.stderr.write('usage: ikenga dev <path>\n');
				return 1;
			}
			return devCommand(path);
		}
	}
}

const code = await main();
process.exit(code);
