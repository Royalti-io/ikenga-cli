// Read the on-disk state of installed pkgs. The shell maintains its own
// SQLite-backed view (pkg_installed) plus the actual files in pkgs_dir; the
// CLI runs without a kernel and trusts only the files. A pkg is "installed"
// iff `<pkgs_dir>/<id>/manifest.json` parses and its `id` matches the dir
// name.
//
// We don't reach into the shell's SQLite — that's the kernel's invariant and
// reaching into it would create a two-writer split-brain. The shell discovers
// CLI-installed pkgs at next boot.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pkgsDir } from './paths.js';

export interface InstalledPkg {
	id: string;
	name?: string;
	version: string;
	ikenga_api?: string;
	kind?: string;
	installPath: string;
}

/** List every installable pkg dir under `<pkgs_dir>/`. */
export function listInstalled(): InstalledPkg[] {
	const root = pkgsDir();
	if (!existsSync(root)) return [];
	const out: InstalledPkg[] = [];
	for (const name of readdirSync(root)) {
		if (name.startsWith('.')) continue; // skip .staging-* / .bak-*
		const dir = join(root, name);
		try {
			if (!statSync(dir).isDirectory()) continue;
		} catch {
			continue;
		}
		const m = readManifest(dir);
		if (!m) continue;
		if (m.id !== name) {
			// Dir name and manifest id disagree. Could be a partially-renamed
			// install — skip rather than guess which is authoritative.
			continue;
		}
		out.push({
			id: m.id,
			name: m.name,
			version: m.version,
			ikenga_api: m.ikenga_api,
			kind: m.kind,
			installPath: dir,
		});
	}
	return out.sort((a, b) => a.id.localeCompare(b.id));
}

export function findInstalled(pkgId: string): InstalledPkg | null {
	return listInstalled().find((p) => p.id === pkgId) ?? null;
}

interface RawManifest {
	id: string;
	name?: string;
	version: string;
	ikenga_api?: string;
	kind?: string;
}

function readManifest(dir: string): RawManifest | null {
	const path = join(dir, 'manifest.json');
	if (!existsSync(path)) return null;
	try {
		const json = JSON.parse(readFileSync(path, 'utf8'));
		if (typeof json?.id !== 'string' || typeof json?.version !== 'string') {
			return null;
		}
		return json as RawManifest;
	} catch {
		return null;
	}
}
