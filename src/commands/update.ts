// `ikenga update [<pkg>|--all]` — bring installed pkgs to the latest version
// in the registry. With no args, defaults to --all.

import { semverCompare } from '@ikenga/registry-client';
import { fetchIndex, fetchPkgDetail, resolveInstallPlan } from '../lib/registry.js';
import { listInstalled } from '../lib/installed.js';
import { installStep } from '../lib/install.js';

export interface UpdateOptions {
	all?: boolean;
	dryRun?: boolean;
}

export async function updateCommand(
	target: string | null,
	opts: UpdateOptions,
): Promise<number> {
	if (!target && !opts.all) {
		// Default to --all when no explicit target.
		opts = { ...opts, all: true };
	}

	try {
		const { index, indexUrl } = await fetchIndex();
		const installed = listInstalled();
		const installedById = new Map(installed.map((p) => [p.id, p]));

		// Map registry entries to installed pkgs, find anything outdated.
		const candidates: Array<{ name: string; from: string; to: string }> = [];
		for (const entry of index.pkgs) {
			const id = npmNameToPkgId(entry.name);
			const inst = installedById.get(id);
			if (!inst) continue;
			if (target && entry.name !== target && id !== target) continue;
			if (semverCompare(inst.version, entry.latest) >= 0) continue;
			candidates.push({ name: entry.name, from: inst.version, to: entry.latest });
		}

		if (candidates.length === 0) {
			if (target) {
				process.stdout.write(`Already up to date or not installed: ${target}\n`);
			} else {
				process.stdout.write('All installed pkgs are at the latest registry version.\n');
			}
			return 0;
		}

		process.stdout.write(`updating ${candidates.length} pkg(s):\n`);
		for (const c of candidates) {
			process.stdout.write(`  ${c.name}  ${c.from} → ${c.to}\n`);
		}
		if (opts.dryRun) {
			process.stdout.write('\n(dry-run, nothing changed)\n');
			return 0;
		}

		for (const c of candidates) {
			const entry = index.pkgs.find((p) => p.name === c.name);
			if (!entry) continue; // shouldn't happen — we built the list from index
			const detail = await fetchPkgDetail(indexUrl, entry);
			const plan = await resolveInstallPlan(indexUrl, detail);
			process.stdout.write(`\n→ ${c.name}\n`);
			for (const step of plan) {
				await installStep(step, {
					onStep: (msg) => process.stdout.write(`  ${msg}\n`),
				});
			}
		}
		process.stdout.write('\n✓ done\n');
		process.stdout.write(
			'   (restart the Ikenga shell to pick up the new versions)\n',
		);
		return 0;
	} catch (err) {
		process.stderr.write(`error: ${(err as Error).message}\n`);
		return 1;
	}
}

function npmNameToPkgId(npmName: string): string {
	const short = npmName.replace(/^@ikenga\//, '').replace(/^pkg-/, '');
	return `com.ikenga.${short}`;
}
