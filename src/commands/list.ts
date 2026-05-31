// `ikenga list` — prints installed pkgs by default; `--available` switches
// to the remote registry index.
//
// Output format is plain text optimized for grepping: one pkg per line,
// columns separated by two spaces. JSON output (--json) supported for
// scripts.

import { fetchIndex } from '../lib/registry.js';
import { listInstalled } from '../lib/installed.js';
import { semverCompare } from '@ikenga/registry-client';

interface ListOptions {
	available?: boolean;
	json?: boolean;
}

export async function listCommand(opts: ListOptions): Promise<number> {
	if (opts.available) {
		return listAvailable(opts);
	}
	return listInstalledLocal(opts);
}

async function listAvailable(opts: ListOptions): Promise<number> {
	try {
		const { index } = await fetchIndex();
		const installed = new Map(listInstalled().map((p) => [p.id, p.version]));
		// Hide dev/test fixtures + scaffolds from the browse listing. They remain
		// installable by exact name via `ikenga add`/`update`, which don't filter.
		const visiblePkgs = index.pkgs.filter(
			(entry) => (entry as { visibility?: string }).visibility !== 'hidden',
		);
		const rows = visiblePkgs.map((entry) => {
			const installedVersion = installed.get(npmNameToPkgId(entry.name));
			let state: 'installed' | 'outdated' | 'available' = 'available';
			if (installedVersion) {
				state = semverCompare(installedVersion, entry.latest) < 0 ? 'outdated' : 'installed';
			}
			return {
				name: entry.name,
				latest: entry.latest,
				kind: entry.kind ?? 'pkg',
				state,
				installedVersion: installedVersion ?? null,
				description: entry.description ?? '',
			};
		});
		if (opts.json) {
			process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
			return 0;
		}
		process.stdout.write(`${visiblePkgs.length} pkg(s) in registry · signed by minisign key on disk\n\n`);
		for (const r of rows) {
			const marker =
				r.state === 'outdated'
					? `${r.installedVersion} → ${r.latest}`
					: r.state === 'installed'
						? `installed ${r.latest}`
						: `available ${r.latest}`;
			process.stdout.write(`${r.name.padEnd(36)}  ${marker.padEnd(20)}  ${r.kind}\n`);
			if (r.description) process.stdout.write(`  ${r.description}\n`);
		}
		return 0;
	} catch (err) {
		process.stderr.write(`error: ${(err as Error).message}\n`);
		return 1;
	}
}

function listInstalledLocal(opts: ListOptions): number {
	const installed = listInstalled();
	if (opts.json) {
		process.stdout.write(JSON.stringify(installed, null, 2) + '\n');
		return 0;
	}
	if (installed.length === 0) {
		process.stdout.write('No pkgs installed.\n');
		return 0;
	}
	process.stdout.write(`${installed.length} installed pkg(s)\n\n`);
	for (const p of installed) {
		const label = p.name ?? p.id;
		process.stdout.write(
			`${p.id.padEnd(32)}  ${`v${p.version}`.padEnd(10)}  ${(p.kind ?? 'pkg').padEnd(8)}  ${label}\n`,
		);
	}
	return 0;
}

/** Best-effort mapper from npm name → manifest id. Mirrors the shell's
 *  use-updates-available logic; works for today's `@ikenga/pkg-<short>` ↔
 *  `com.ikenga.<short>` convention. */
function npmNameToPkgId(npmName: string): string {
	const short = npmName.replace(/^@ikenga\//, '').replace(/^pkg-/, '');
	return `com.ikenga.${short}`;
}
