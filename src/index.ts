#!/usr/bin/env bun

const SUBCOMMANDS = ['add', 'list', 'update', 'remove', 'dev', 'publish'] as const;
type Subcommand = (typeof SUBCOMMANDS)[number];

function isSubcommand(s: string | undefined): s is Subcommand {
  return !!s && (SUBCOMMANDS as readonly string[]).includes(s);
}

function usage(): string {
  return `ikenga — pkg manager for the Ikenga shell

Usage:
  ikenga add <pkg | @user/pkg | git-url | ./path>
  ikenga list
  ikenga update [<pkg> | --all]
  ikenga remove <pkg>
  ikenga dev <path>
  ikenga publish

(All subcommands are stubs in v0.0.0.)
`;
}

const [, , sub, ...rest] = process.argv;

if (!sub || sub === '--help' || sub === '-h') {
  process.stdout.write(usage());
  process.exit(0);
}

if (!isSubcommand(sub)) {
  process.stderr.write(`unknown subcommand: ${sub}\n\n${usage()}`);
  process.exit(2);
}

process.stderr.write(`[ikenga] ${sub} ${rest.join(' ')} — not implemented yet (v0.0.0 scaffold)\n`);
process.exit(0);
