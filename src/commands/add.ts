// `ikenga add <pkg>[@version]` — fetch the registry index, verify its sig,
// fetch per-pkg detail, resolve a linear depth-first install plan, then
// download + verify + untar each step into the kernel's pkgs dir.
//
// The CLI runs without a Tauri kernel, so it doesn't register the pkg in
// the shell's SQLite. The shell will discover it at next boot via the
// kernel's pkg_installed replay (which scans pkgs_dir).

import { fetchIndex, fetchPkgDetail, resolveInstallPlan } from '../lib/registry.js';
import { installStep } from '../lib/install.js';

export interface AddOptions {
	dryRun?: boolean;
}

export async function addCommand(spec: string, opts: AddOptions = {}): Promise<number> {
	const { name, version } = parseSpec(spec);

	try {
		const { index, indexUrl } = await fetchIndex();
		const entry = index.pkgs.find((p) => p.name === name);
		if (!entry) {
			process.stderr.write(
				`error: ${name} is not in the registry (have ${index.pkgs.length} pkg${index.pkgs.length === 1 ? '' : 's'})\n`,
			);
			return 1;
		}

		const detail = await fetchPkgDetail(indexUrl, entry);
		const plan = await resolveInstallPlan(indexUrl, detail, version);

		process.stdout.write(`install plan: ${plan.length} step(s)\n`);
		for (const step of plan) {
			process.stdout.write(
				`  ${step.isDep ? '↳ dep' : '  pkg'}  ${step.name}@${step.version}\n`,
			);
		}
		if (opts.dryRun) {
			process.stdout.write('\n(dry-run, nothing installed)\n');
			return 0;
		}

		for (const step of plan) {
			process.stdout.write(`\n→ ${step.name}@${step.version}\n`);
			await installStep(step, {
				onStep: (msg) => process.stdout.write(`  ${msg}\n`),
			});
		}
		process.stdout.write('\n✓ done\n');
		process.stdout.write(
			'   (restart the Ikenga shell to register new pkgs with its kernel)\n',
		);
		return 0;
	} catch (err) {
		process.stderr.write(`error: ${(err as Error).message}\n`);
		return 1;
	}
}

/**
 * Parse `name[@version]` where name may itself contain `@` (npm scope).
 * `@ikenga/pkg-hello@0.1.0` → name=`@ikenga/pkg-hello`, version=`0.1.0`.
 * `@ikenga/pkg-hello`       → name=`@ikenga/pkg-hello`, version=undefined.
 */
function parseSpec(spec: string): { name: string; version?: string } {
	if (spec.startsWith('@')) {
		const lastAt = spec.lastIndexOf('@');
		if (lastAt === 0) {
			return { name: spec };
		}
		return {
			name: spec.slice(0, lastAt),
			version: spec.slice(lastAt + 1) || undefined,
		};
	}
	const idx = spec.indexOf('@');
	if (idx < 0) return { name: spec };
	return { name: spec.slice(0, idx), version: spec.slice(idx + 1) || undefined };
}
