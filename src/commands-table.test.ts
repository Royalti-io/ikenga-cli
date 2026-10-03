import { describe, expect, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	buildCliDoc,
	buildCommandTree,
	type CliCommand,
	renderCliJson,
	renderUsage,
	SUBCOMMANDS,
} from './commands-table.js';

// The help text exactly as it was before it was rendered from a table.
const GOLDEN_USAGE = `ikenga — pkg manager for the Ikenga shell

Usage:
  ikenga list [--available] [--json]
  ikenga add <pkg>[@<version>] [--dry-run]
  ikenga update [<pkg> | --all] [--dry-run]
  ikenga remove <pkg>
  ikenga dev <path>
  ikenga doctor [--fix]

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

const ENTRY = join(dirname(fileURLToPath(import.meta.url)), 'index.ts');

function run(args: string[]) {
	const res = Bun.spawnSync([process.execPath, ENTRY, ...args], {
		env: { ...process.env, IKENGA_CLI_VERSION: '9.8.7' },
	});
	return {
		code: res.exitCode,
		out: res.stdout.toString(),
		err: res.stderr.toString(),
	};
}

describe('usage text', () => {
	test('renders byte for byte what the hand-written text printed', () => {
		expect(renderUsage()).toBe(GOLDEN_USAGE);
	});

	test('every subcommand usage line and example comes from the same table as the JSON', () => {
		const text = renderUsage();
		const tree = buildCommandTree();
		for (const sub of tree.subcommands) {
			expect(text).toContain(`  ${sub.usage}\n`);
			for (const ex of sub.examples ?? []) expect(text).toContain(ex.command);
		}
	});

	test('`ikenga --help`, `-h` and no arguments all print it', () => {
		for (const args of [['--help'], ['-h'], []]) {
			const r = run(args);
			expect(r.code).toBe(0);
			expect(r.out).toBe(GOLDEN_USAGE);
		}
	});

	test('an unknown command still prints the error then the usage, and exits 1', () => {
		const r = run(['nosuch']);
		expect(r.code).toBe(1);
		expect(r.err).toBe('unknown command: nosuch\n\n');
		expect(r.out).toBe(GOLDEN_USAGE);
	});
});

describe('--help --json', () => {
	const doc = buildCliDoc('1.2.3');

	test('has the shared CLI document shape', () => {
		expect(Object.keys(doc)).toEqual(['$schemaVersion', 'kind', 'stability', 'source', 'command']);
		expect(doc.$schemaVersion).toBe(1);
		expect(doc.kind).toBe('ikenga.cli');
		expect(doc.stability).toBe('stable');
		expect(doc.source).toEqual({
			repo: 'ikenga-hq/ikenga-cli',
			version: '1.2.3',
			producer: 'ikenga --help --json',
		});
		expect(doc.command.name).toBe('ikenga');
		expect(doc.command.path).toEqual(['ikenga']);
	});

	test('lists the six subcommands in help order', () => {
		expect(doc.command.subcommands.map((c) => c.name)).toEqual([
			'list',
			'add',
			'update',
			'remove',
			'dev',
			'doctor',
		]);
		expect(SUBCOMMANDS).toEqual(doc.command.subcommands.map((c) => c.name));
	});

	test('every command and arg has the required fields', () => {
		const walk = (c: CliCommand) => {
			expect(typeof c.name).toBe('string');
			expect(c.path.at(-1)).toBe(c.name);
			expect(c.about.length).toBeGreaterThan(0);
			expect(c.usage.startsWith('ikenga ')).toBe(true);
			for (const a of c.args) {
				expect(['positional', 'flag', 'option']).toContain(a.kind);
				expect(typeof a.required).toBe('boolean');
				expect(typeof a.repeatable).toBe('boolean');
				expect(a.help.length).toBeGreaterThan(0);
				if (a.kind === 'positional') expect(a.value).toBeDefined();
				else expect(a.long?.startsWith('--')).toBe(true);
			}
			for (const s of c.subcommands) {
				expect(s.path.slice(0, -1)).toEqual(c.path);
				walk(s);
			}
		};
		walk(doc.command);
	});

	test('records the real flags: --available (-a), --json, --dry-run, --all, --fix', () => {
		const by = (name: string) => doc.command.subcommands.find((c) => c.name === name);
		const list = by('list');
		expect(list?.args.map((a) => a.long)).toEqual(['--available', '--json']);
		expect(list?.args[0]?.short).toBe('-a');
		expect(by('add')?.args.map((a) => a.name)).toEqual(['pkg', 'dry-run']);
		expect(by('add')?.args[0]?.required).toBe(true);
		expect(by('update')?.args.map((a) => a.name)).toEqual(['pkg', 'all', 'dry-run']);
		expect(by('update')?.args[0]?.required).toBe(false);
		expect(by('doctor')?.args.map((a) => a.long)).toEqual(['--fix']);
	});

	test('rendering is stable and ends with a newline', () => {
		const a = renderCliJson('1.2.3');
		expect(a).toBe(renderCliJson('1.2.3'));
		expect(a.endsWith('}\n')).toBe(true);
		expect(JSON.parse(a)).toEqual(JSON.parse(JSON.stringify(doc)));
	});

	test('the command line prints the document with the baked-in version', () => {
		for (const args of [['--help', '--json'], ['-h', '--json']]) {
			const r = run(args);
			expect(r.code).toBe(0);
			expect(r.out).toBe(renderCliJson('9.8.7'));
		}
	});
});
