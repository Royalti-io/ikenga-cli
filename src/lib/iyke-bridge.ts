// Iyke bridge discovery + HTTP client.
//
// The Ikenga shell binds the iyke axum server on `127.0.0.1:<port>` with a
// per-launch bearer token. Both are written to `control.json` in the
// shell's `app_local_data_dir`, which Tauri computes from the
// `app.ikenga` bundle identifier. This module mirrors the discovery
// logic that the Rust iyke-cli uses (iyke-cli/src/control.rs) so the
// TS-side `ikenga dev` command can talk to the shell without a Tauri
// runtime.
//
// The bridge writes control.json on shell boot and the file persists
// across process death — `is_pid_alive` filtering is how we detect a
// crashed shell. Five minutes is the threshold for auto-removing a
// stale file (same as iyke-cli).

import { existsSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

const APP_IDENTIFIER = 'app.ikenga';
const STALE_THRESHOLD_SECS = 5 * 60;

export interface ControlFile {
	schema_version: 1;
	port: number;
	token: string;
	pid: number;
	started_at_unix_ms: number;
	identifier: string;
}

export type LoadOutcome =
	| { kind: 'ok'; cf: ControlFile }
	| { kind: 'missing' }
	| { kind: 'stale_removed' }
	| { kind: 'stale_young'; age_secs: number };

/** Tauri's `app_local_data_dir` for the shell's bundle identifier. Differs
 *  from `appDataDir()` in paths.ts only on Windows (LOCALAPPDATA vs APPDATA). */
function appLocalDataDir(): string {
	const override = process.env.IKENGA_APP_LOCAL_DATA_DIR;
	if (override) return override;
	const home = homedir();
	switch (platform()) {
		case 'darwin':
			return join(home, 'Library', 'Application Support', APP_IDENTIFIER);
		case 'win32': {
			const local = process.env.LOCALAPPDATA;
			if (local) return join(local, APP_IDENTIFIER);
			return join(home, 'AppData', 'Local', APP_IDENTIFIER);
		}
		default: {
			const xdg = process.env.XDG_DATA_HOME;
			if (xdg) return join(xdg, APP_IDENTIFIER);
			return join(home, '.local', 'share', APP_IDENTIFIER);
		}
	}
}

export function controlPath(): string {
	return join(appLocalDataDir(), 'control.json');
}

/** PID liveness check. Unix-only — Windows isn't a v1 CLI target. */
function isPidAlive(pid: number): boolean {
	if (platform() === 'win32') return true;
	try {
		// process.kill with signal 0 is the POSIX "does this PID exist?" probe.
		// Throws ESRCH when the PID is dead, EPERM when alive but not signalable.
		process.kill(pid, 0);
		return true;
	} catch (e) {
		const err = e as NodeJS.ErrnoException;
		return err.code === 'EPERM';
	}
}

export function loadControl(): LoadOutcome {
	const path = controlPath();
	if (!existsSync(path)) {
		return { kind: 'missing' };
	}
	const raw = readFileSync(path, 'utf8');
	const cf = JSON.parse(raw) as ControlFile;
	if (cf.schema_version !== 1) {
		throw new Error(`unsupported control.json schema_version: ${cf.schema_version} (CLI built for v1)`);
	}
	if (isPidAlive(cf.pid)) {
		return { kind: 'ok', cf };
	}
	const nowMs = Date.now();
	const ageMs = Math.max(0, nowMs - cf.started_at_unix_ms);
	const ageSecs = Math.floor(ageMs / 1000);
	if (ageSecs >= STALE_THRESHOLD_SECS) {
		try {
			unlinkSync(path);
		} catch {
			// best-effort — next launch overwrites it
		}
		return { kind: 'stale_removed' };
	}
	return { kind: 'stale_young', age_secs: ageSecs };
}

/** HTTP wrapper around `127.0.0.1:<port>` + bearer auth. Uses native fetch
 *  (Bun + Node 18+ both ship it). */
export class IykeClient {
	private readonly base: string;
	private readonly token: string;

	constructor(cf: ControlFile) {
		this.base = `http://127.0.0.1:${cf.port}`;
		this.token = cf.token;
	}

	async post<T = unknown>(path: string, body: unknown): Promise<T> {
		const res = await fetch(`${this.base}${path}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.token}`,
			},
			body: JSON.stringify(body),
		});
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			throw new Error(`POST ${path} failed: ${res.status} ${text}`);
		}
		// Some write endpoints return empty bodies — treat as `{}`.
		const text = await res.text();
		return text ? (JSON.parse(text) as T) : ({} as T);
	}

	async get<T = unknown>(path: string): Promise<T> {
		const res = await fetch(`${this.base}${path}`, {
			method: 'GET',
			headers: { Authorization: `Bearer ${this.token}` },
		});
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			throw new Error(`GET ${path} failed: ${res.status} ${text}`);
		}
		return (await res.json()) as T;
	}
}

/** One-shot helper: discover + connect or throw a user-readable error. */
export function connectOrThrow(): IykeClient {
	const outcome = loadControl();
	switch (outcome.kind) {
		case 'ok':
			return new IykeClient(outcome.cf);
		case 'missing':
			throw new Error(
				`Ikenga shell is not running.\n  Expected control.json at ${controlPath()}\n  Start the shell, then re-run this command.`,
			);
		case 'stale_removed':
			throw new Error(
				`Ikenga shell control file was stale (crashed shell) — cleaned up.\n  Start the shell and re-run this command.`,
			);
		case 'stale_young':
			throw new Error(
				`Ikenga shell control file is ${outcome.age_secs}s old but the PID is dead.\n  Likely a launch race. Retry in a moment or remove ${controlPath()} manually.`,
			);
	}
}

/** Sanity: drop a debug flag for tests / scripts. */
export function _statHint(path: string): { mtime_ms: number } | null {
	try {
		const s = statSync(path);
		return { mtime_ms: s.mtimeMs };
	} catch {
		return null;
	}
}
