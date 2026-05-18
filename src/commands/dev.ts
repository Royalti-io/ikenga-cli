// `ikenga dev <path>` — hot-mount a pkg into the running Ikenga shell.
//
// Talks to the iyke localhost bridge that the shell exposes on boot
// (port + bearer token discovered via control.json — see
// lib/iyke-bridge.ts). The kernel-side surface that handles this is in
// the shell's `commands/pkg_dev.rs` + `iyke/handlers.rs`; routes mount
// at `/iyke/pkg/dev/{register,unregister,reload}`.
//
// Behaviour:
//   1. Validate the manifest at <path> (basic shape only — the kernel
//      does full validation on its side).
//   2. POST /iyke/pkg/dev/register with the absolute path.
//   3. Print the registered routes + MCP tools + dev guidance.
//   4. Idle until Ctrl-C, then POST /iyke/pkg/dev/unregister.
//
// The reload itself is driven by the file watcher the kernel spawns on
// `register` — manifest edits trigger reload without the CLI doing
// anything. We don't currently stream events back to the terminal;
// `pkg-reloaded` is a Tauri event consumed by the shell's FE, and an
// SSE bridge isn't worth building until users ask for it.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import {
	connectOrThrow,
	type IykeClient,
} from '../lib/iyke-bridge.js';

interface Manifest {
	id: string;
	name: string;
	version: string;
	ikenga_api: string;
	mcp?: Array<{ name: string }>;
	sidecars?: Array<{ name: string }>;
	ui?: { routes?: Array<{ path: string; kind: string; source: string }> };
	engine?: { agentId: string };
}

interface RegisterResponse {
	installed: {
		id: string;
		version: string;
		install_path: string;
		source: { kind: string; path?: string };
	};
}

export async function devCommand(rawPath: string): Promise<number> {
	const path = resolve(rawPath);

	if (!existsSync(path)) {
		process.stderr.write(`error: ${path} does not exist\n`);
		return 1;
	}
	if (!statSync(path).isDirectory()) {
		process.stderr.write(`error: ${path} is not a directory\n`);
		return 1;
	}

	const manifestPath = `${path}/manifest.json`;
	if (!existsSync(manifestPath)) {
		process.stderr.write(`error: no manifest.json at ${manifestPath}\n`);
		return 1;
	}

	let manifest: Manifest;
	try {
		manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
	} catch (err) {
		process.stderr.write(`error: failed to parse manifest.json: ${(err as Error).message}\n`);
		return 1;
	}

	if (!manifest.id || !manifest.name || !manifest.version || !manifest.ikenga_api) {
		process.stderr.write(`error: manifest missing required fields (id, name, version, ikenga_api)\n`);
		return 1;
	}

	// Connect to the running shell.
	let client: IykeClient;
	try {
		client = connectOrThrow();
	} catch (err) {
		process.stderr.write(`error: ${(err as Error).message}\n`);
		return 1;
	}

	// Register.
	process.stdout.write(`→ registering ${manifest.id}@${manifest.version} from ${path}\n`);
	let registered: RegisterResponse;
	try {
		registered = await client.post<RegisterResponse>('/iyke/pkg/dev/register', {
			install_path: path,
		});
	} catch (err) {
		process.stderr.write(`error: ${(err as Error).message}\n`);
		return 1;
	}

	process.stdout.write(`\n✓ mounted as ${registered.installed.id} v${registered.installed.version}\n`);
	printPkgSurface(manifest);
	process.stdout.write(`\nWatching manifest.json + restart_when_changed globs.\n`);
	process.stdout.write(`  Edit the manifest to trigger a reload (250ms debounce).\n`);
	process.stdout.write(`  Sidecar / MCP code changes restart via the supervisor watcher.\n`);
	process.stdout.write(`  Iframe code changes flow through your dev server's HMR.\n`);
	process.stdout.write(`\n  Ctrl-C to unregister and exit.\n`);

	// Idle + handle Ctrl-C.
	const pkgId = registered.installed.id;
	return new Promise<number>((resolveExit) => {
		let unregistering = false;
		const cleanup = async () => {
			if (unregistering) return;
			unregistering = true;
			process.stdout.write(`\n→ unregistering ${pkgId}\n`);
			try {
				await client.post('/iyke/pkg/dev/unregister', { pkg_id: pkgId });
				process.stdout.write(`✓ done\n`);
				resolveExit(0);
			} catch (err) {
				process.stderr.write(`error: ${(err as Error).message}\n`);
				resolveExit(1);
			}
		};

		process.on('SIGINT', () => {
			void cleanup();
		});
		process.on('SIGTERM', () => {
			void cleanup();
		});
		// Without keeping the event loop alive, the process exits immediately.
		// A long-lived interval is the cheapest way to park; intentionally
		// no-op (the signal handlers do the real work).
		setInterval(() => {}, 60_000);
	});
}

function printPkgSurface(m: Manifest) {
	if (m.ui?.routes?.length) {
		process.stdout.write(`\n  Routes:\n`);
		for (const r of m.ui.routes) {
			process.stdout.write(`    /pkg/${m.id}${r.path}   (${r.kind}: ${r.source})\n`);
		}
	}
	if (m.mcp?.length) {
		process.stdout.write(`\n  MCP servers:\n`);
		for (const s of m.mcp) {
			process.stdout.write(`    ${s.name}\n`);
		}
	}
	if (m.sidecars?.length) {
		process.stdout.write(`\n  Sidecars:\n`);
		for (const s of m.sidecars) {
			process.stdout.write(`    ${s.name}\n`);
		}
	}
	if (m.engine?.agentId) {
		process.stdout.write(`\n  Engine: ${m.engine.agentId}\n`);
	}
}
