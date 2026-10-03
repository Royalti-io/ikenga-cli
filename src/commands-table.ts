// One table that describes every `ikenga` command. Both the text shown by
// `ikenga --help` and the JSON shown by `ikenga --help --json` are rendered
// from it, so the two cannot drift apart. The build writes the JSON to
// `dist/cli.json`, which ships in the npm package for the documentation site.

export interface CliArg {
	name: string;
	kind: 'positional' | 'flag' | 'option';
	long?: string;
	short?: string;
	/** Value placeholder, e.g. `<pkg>`. */
	value?: string;
	required: boolean;
	repeatable: boolean;
	default?: string;
	env?: string;
	possible_values?: string[];
	help: string;
}

export interface CliExample {
	command: string;
	note?: string;
}

export interface CliCommand {
	name: string;
	path: string[];
	about: string;
	usage: string;
	args: CliArg[];
	subcommands: CliCommand[];
	examples?: CliExample[];
}

export interface CliDoc {
	$schemaVersion: 1;
	kind: 'ikenga.cli';
	stability: 'stable' | 'unstable';
	source: { repo: string; version: string; producer: string };
	command: CliCommand;
}

export const CLI_REPO = 'ikenga-hq/ikenga-cli';
export const CLI_PRODUCER = 'ikenga --help --json';

export const ROOT_ABOUT = 'pkg manager for the Ikenga shell';

/** Flags that apply to the whole tool. */
const GLOBAL_ARGS: CliArg[] = [
	{
		name: 'help',
		kind: 'flag',
		long: '--help',
		short: '-h',
		required: false,
		repeatable: false,
		help: 'print help; with --json, print this command reference as JSON',
	},
	{
		name: 'version',
		kind: 'flag',
		long: '--version',
		short: '-V',
		required: false,
		repeatable: false,
		help: 'print the version',
	},
];

const DRY_RUN: CliArg = {
	name: 'dry-run',
	kind: 'flag',
	long: '--dry-run',
	required: false,
	repeatable: false,
	help: 'show what would happen without changing anything',
};

type Spec = Omit<CliCommand, 'path' | 'subcommands'>;

/** The commands, in the order `ikenga --help` lists them. */
const SPECS: Spec[] = [
	{
		name: 'list',
		about: "what's installed locally",
		usage: 'ikenga list [--available] [--json]',
		args: [
			{
				name: 'available',
				kind: 'flag',
				long: '--available',
				short: '-a',
				required: false,
				repeatable: false,
				help: "list what's in the registry instead of what's installed",
			},
			{
				name: 'json',
				kind: 'flag',
				long: '--json',
				required: false,
				repeatable: false,
				help: 'print JSON',
			},
		],
		examples: [
			{ command: 'ikenga list', note: "what's installed locally" },
			{ command: 'ikenga list --available', note: "what's in the registry" },
		],
	},
	{
		name: 'add',
		about: 'install a pkg from the registry',
		usage: 'ikenga add <pkg>[@<version>] [--dry-run]',
		args: [
			{
				name: 'pkg',
				kind: 'positional',
				value: '<pkg>[@<version>]',
				required: true,
				repeatable: false,
				help: 'npm name of the pkg, optionally with a version',
			},
			DRY_RUN,
		],
		examples: [
			{ command: 'ikenga add @ikenga/pkg-hello', note: 'install latest' },
			{ command: 'ikenga add @ikenga/pkg-hello@0.1.0', note: 'install a specific version' },
		],
	},
	{
		name: 'update',
		about: 'update one pkg or every outdated pkg',
		usage: 'ikenga update [<pkg> | --all] [--dry-run]',
		args: [
			{
				name: 'pkg',
				kind: 'positional',
				value: '<pkg>',
				required: false,
				repeatable: false,
				help: 'the pkg to update',
			},
			{
				name: 'all',
				kind: 'flag',
				long: '--all',
				required: false,
				repeatable: false,
				help: 'update every outdated pkg',
			},
			DRY_RUN,
		],
		examples: [{ command: 'ikenga update --all', note: 'update everything outdated' }],
	},
	{
		name: 'remove',
		about: 'remove an installed pkg',
		usage: 'ikenga remove <pkg>',
		args: [
			{
				name: 'pkg',
				kind: 'positional',
				value: '<pkg>',
				required: true,
				repeatable: false,
				help: 'manifest id or npm name of the installed pkg',
			},
		],
		examples: [
			{ command: 'ikenga remove com.ikenga.hello', note: 'by manifest id, or...' },
			{ command: 'ikenga remove @ikenga/pkg-hello', note: '...by npm name' },
		],
	},
	{
		name: 'dev',
		about: 'hot-mount a local pkg into a running shell',
		usage: 'ikenga dev <path>',
		args: [
			{
				name: 'path',
				kind: 'positional',
				value: '<path>',
				required: true,
				repeatable: false,
				help: 'folder of the pkg to mount',
			},
		],
		examples: [{ command: 'ikenga dev ./my-pkg', note: 'hot-mount into running shell' }],
	},
	{
		name: 'doctor',
		about: 'health-check pkg installs, and repair them with --fix',
		usage: 'ikenga doctor [--fix]',
		args: [
			{
				name: 'fix',
				kind: 'flag',
				long: '--fix',
				required: false,
				repeatable: false,
				help: 'repair broken or orphaned installs',
			},
		],
		examples: [],
	},
];

/** Names of the subcommands, in help order. */
export const SUBCOMMANDS = SPECS.map((s) => s.name);

/** Text after the examples in `ikenga --help`. */
const FOOTER = `Installs land in the shell's pkgs directory (overridable with
IKENGA_APP_DATA_DIR). The shell registers them on next boot.

\`ikenga dev <path>\` is different — it talks to a running shell over its
localhost iyke bridge, registers the pkg with hot-reload semantics
(manifest edits trigger an in-place reload, no shell restart), and
unregisters cleanly on Ctrl-C. Requires the shell to be running.
`;

/** Width of the command column in the examples block. */
const EXAMPLE_COLUMN = 41;

/** The root command with every subcommand. */
export function buildCommandTree(): CliCommand {
	return {
		name: 'ikenga',
		path: ['ikenga'],
		about: ROOT_ABOUT,
		usage: 'ikenga <command>',
		args: GLOBAL_ARGS,
		subcommands: SPECS.map((s) => ({
			name: s.name,
			path: ['ikenga', s.name],
			about: s.about,
			usage: s.usage,
			args: s.args,
			subcommands: [],
			...(s.examples && s.examples.length > 0 ? { examples: s.examples } : {}),
		})),
	};
}

/** The text printed by `ikenga --help`. */
export function renderUsage(): string {
	const usageLines = SPECS.map((s) => `  ${s.usage}`).join('\n');
	const exampleLines = SPECS.flatMap((s) => s.examples ?? [])
		.map((e) => `  ${e.command.padEnd(EXAMPLE_COLUMN)}# ${e.note ?? ''}`.trimEnd())
		.join('\n');
	return `ikenga — ${ROOT_ABOUT}

Usage:
${usageLines}

Examples:
${exampleLines}

${FOOTER}`;
}

/** The document printed by `ikenga --help --json`. */
export function buildCliDoc(version: string): CliDoc {
	return {
		$schemaVersion: 1,
		kind: 'ikenga.cli',
		stability: 'stable',
		source: { repo: CLI_REPO, version, producer: CLI_PRODUCER },
		command: buildCommandTree(),
	};
}

/** Two-space JSON with a final newline. */
export function renderCliJson(version: string): string {
	return `${JSON.stringify(buildCliDoc(version), null, 2)}\n`;
}
