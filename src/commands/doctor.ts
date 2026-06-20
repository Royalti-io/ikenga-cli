// `ikenga doctor` — check for broken / orphaned package install records and
// optionally remove them.
//
// Bridge-first: drives the running shell's iyke routes (POST
// /iyke/pkg/health/{scan,remove-all}) so the kernel stays the only writer of
// `pkg_installed`. Requires the shell to be running — the CLI's disk-side path
// "trusts only files" and never reads the kernel DB, so cleanup must route
// through the live kernel.
//
//   ikenga doctor          — scan + report
//   ikenga doctor --fix    — scan, then remove every broken record + orphan row

import { connectOrThrow } from '../lib/iyke-bridge.js';

interface HealthIssueKind {
	kind: string;
	ikenga_api?: string;
	table?: string;
}

interface HealthIssue {
	id: string;
	install_path: string;
	enabled: boolean;
	issue: HealthIssueKind;
	detail: string;
}

function kindLabel(k: HealthIssueKind): string {
	switch (k.kind) {
		case 'manifest_missing':
			return 'missing manifest';
		case 'manifest_unreadable':
			return 'unreadable';
		case 'manifest_unparseable':
			return 'invalid manifest';
		case 'api_incompatible':
			return `api ${k.ikenga_api}`;
		case 'orphan_row':
			return `orphan:${k.table}`;
		default:
			return k.kind;
	}
}

export async function doctorCommand(opts: { fix: boolean }): Promise<number> {
	let client;
	try {
		client = connectOrThrow();
	} catch (e) {
		process.stderr.write(`${(e as Error).message}\n`);
		return 1;
	}

	let issues: HealthIssue[];
	try {
		const res = await client.post<{ issues: HealthIssue[] }>('/iyke/pkg/health/scan', {});
		issues = res.issues ?? [];
	} catch (e) {
		process.stderr.write(`health scan failed: ${(e as Error).message}\n`);
		return 1;
	}

	if (issues.length === 0) {
		process.stdout.write('✓ All package installs healthy — no broken or orphaned records.\n');
		return 0;
	}

	process.stdout.write(
		`Found ${issues.length} unhealthy record${issues.length === 1 ? '' : 's'}:\n\n`,
	);
	for (const i of issues) {
		const path = i.install_path ? `\n    ${i.install_path}` : '';
		const disabled = i.enabled ? '' : ' (disabled)';
		process.stdout.write(`  • ${i.id}${disabled}  [${kindLabel(i.issue)}]${path}\n    ${i.detail}\n`);
	}
	process.stdout.write('\n');

	if (!opts.fix) {
		process.stdout.write(
			'Run `ikenga doctor --fix` to remove these records (database rows only — files are never touched).\n',
		);
		return 0;
	}

	try {
		const res = await client.post<{ removed_records: number; removed_orphans: number }>(
			'/iyke/pkg/health/remove-all',
			{},
		);
		process.stdout.write(
			`✓ Removed ${res.removed_records} broken record${res.removed_records === 1 ? '' : 's'} + ${res.removed_orphans} orphan row${res.removed_orphans === 1 ? '' : 's'}.\n`,
		);
		return 0;
	} catch (e) {
		process.stderr.write(`removal failed: ${(e as Error).message}\n`);
		return 1;
	}
}
