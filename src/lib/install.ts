// Download a registry tarball, re-verify SHA-512 against the SRI integrity
// from the (already-signature-verified) index, and untar into the kernel's
// pkgs dir. Mirrors the shell's Rust `pkg_install_from_registry` command,
// but written in TS for the CLI.
//
// Failure handling is the same: every error path cleans up the staging dir
// + tarball so a retry starts clean. Atomic swap promotes staging → final
// only after the manifest cross-check passes.

import { createHash } from 'node:crypto';
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import * as tar from 'tar';
import type { InstallStep } from '@ikenga/registry-client';
import { pkgsDir } from './paths.js';

export interface InstallOptions {
	/** If true, only print what would happen. */
	dryRun?: boolean;
	/** Called once per major phase. */
	onStep?: (msg: string) => void;
}

export async function installStep(
	step: InstallStep,
	opts: InstallOptions = {},
): Promise<{ installPath: string }> {
	const log = opts.onStep ?? (() => {});
	const dir = pkgsDir();
	mkdirSync(dir, { recursive: true });

	const finalDir = join(dir, step.pkgId);
	const stagingDir = join(dir, `.staging-${step.pkgId}`);
	const backupDir = join(dir, `.bak-${step.pkgId}`);
	const tarballPath = `${stagingDir}.tgz`;

	// Clean leftover staging/backup from a previously-aborted attempt.
	if (existsSync(stagingDir)) rmSync(stagingDir, { recursive: true, force: true });
	if (existsSync(backupDir)) rmSync(backupDir, { recursive: true, force: true });
	if (existsSync(tarballPath)) rmSync(tarballPath, { force: true });

	if (opts.dryRun) {
		log(`would install ${step.name}@${step.version} → ${finalDir}`);
		return { installPath: finalDir };
	}

	try {
		// 1. Download tarball.
		log(`downloading ${step.name}@${step.version}`);
		const bytes = await downloadTarball(step.tarball);
		writeFileSync(tarballPath, bytes);

		// 2. SHA-512 integrity check.
		log(`verifying integrity`);
		verifyIntegrity(bytes, step.integrity);

		// 3. Untar into staging.
		log(`extracting ${(bytes.length / 1024).toFixed(1)} KB`);
		mkdirSync(stagingDir, { recursive: true });
		await extractTarball(tarballPath, stagingDir);

		// 4. Cross-check the unpacked manifest's id vs requested pkgId.
		const unpackedManifest = readUnpackedManifest(stagingDir);
		if (unpackedManifest.id !== step.pkgId) {
			throw new Error(
				`manifest id mismatch: tarball declares "${unpackedManifest.id}", registry said "${step.pkgId}"`,
			);
		}

		// 5. Atomic-ish swap: backup existing → move staging → final.
		if (existsSync(finalDir)) {
			renameSync(finalDir, backupDir);
		}
		try {
			renameSync(stagingDir, finalDir);
		} catch (err) {
			if (existsSync(backupDir)) renameSync(backupDir, finalDir);
			throw err;
		}

		// 6. Success — drop backup + tarball.
		if (existsSync(backupDir)) rmSync(backupDir, { recursive: true, force: true });
		rmSync(tarballPath, { force: true });

		log(`installed ${step.name}@${step.version}`);
		return { installPath: finalDir };
	} catch (err) {
		// Roll back any partial state.
		if (existsSync(stagingDir)) rmSync(stagingDir, { recursive: true, force: true });
		if (existsSync(tarballPath)) rmSync(tarballPath, { force: true });
		// If we'd already moved final → backup, restore it so the previous
		// install survives a failed update.
		if (existsSync(backupDir) && !existsSync(finalDir)) {
			renameSync(backupDir, finalDir);
		} else if (existsSync(backupDir)) {
			rmSync(backupDir, { recursive: true, force: true });
		}
		throw err;
	}
}

/** Remove an installed pkg's directory. Does not touch the shell's SQLite. */
export function uninstallPkg(pkgId: string): boolean {
	const dir = join(pkgsDir(), pkgId);
	if (!existsSync(dir)) return false;
	rmSync(dir, { recursive: true, force: true });
	return true;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function downloadTarball(url: string): Promise<Uint8Array> {
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`tarball fetch failed: ${res.status} ${res.statusText} (${url})`);
	}
	const buf = await res.arrayBuffer();
	return new Uint8Array(buf);
}

function verifyIntegrity(bytes: Uint8Array, integritySri: string): void {
	const expectedB64 = integritySri.replace(/^sha512-/, '');
	if (expectedB64 === integritySri) {
		throw new Error(`unsupported integrity prefix: ${integritySri}`);
	}
	const actual = createHash('sha512').update(bytes).digest('base64');
	// Constant-time compare on equal-length strings. For unequal length we
	// can early-exit because that already indicates a clear mismatch.
	if (actual.length !== expectedB64.length) {
		throw new Error('tarball SHA-512 integrity mismatch');
	}
	let diff = 0;
	for (let i = 0; i < actual.length; i++) {
		diff |= actual.charCodeAt(i) ^ expectedB64.charCodeAt(i);
	}
	if (diff !== 0) {
		throw new Error('tarball SHA-512 integrity mismatch');
	}
}

async function extractTarball(src: string, dest: string): Promise<void> {
	await tar.x({
		file: src,
		cwd: dest,
		strip: 1, // drop the leading `package/` directory (npm convention)
		// Defense-in-depth: refuse entries that resolve outside dest. The tar
		// lib already rejects `..` paths by default in newer versions, but
		// being explicit here doesn't hurt.
		filter: (path) => {
			if (path.startsWith('..') || path.startsWith('/')) return false;
			return true;
		},
	});
}

function readUnpackedManifest(stagingDir: string): { id: string; version: string } {
	const path = join(stagingDir, 'manifest.json');
	if (!existsSync(path)) {
		throw new Error(`tarball missing manifest.json at ${path}`);
	}
	const json = JSON.parse(readFileSync(path, 'utf8'));
	if (typeof json?.id !== 'string') {
		throw new Error('manifest.json missing or invalid `id` field');
	}
	if (typeof json?.version !== 'string') {
		throw new Error('manifest.json missing or invalid `version` field');
	}
	return { id: json.id, version: json.version };
}
