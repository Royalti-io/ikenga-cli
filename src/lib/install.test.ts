import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { materializeNpmDeps } from './install.js';

describe('materializeNpmDeps', () => {
	test('skips if package.json does not exist', async () => {
		const testDir = join(tmpdir(), `test-no-pkgjson-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		try {
			await materializeNpmDeps(testDir);
			expect(existsSync(join(testDir, 'node_modules'))).toBe(false);
		} finally {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	test('skips if package.json has no dependencies', async () => {
		const testDir = join(tmpdir(), `test-empty-deps-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		writeFileSync(join(testDir, 'package.json'), JSON.stringify({ name: 'test-pkg', version: '0.1.0' }));
		try {
			await materializeNpmDeps(testDir);
			expect(existsSync(join(testDir, 'node_modules'))).toBe(false);
		} finally {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	test('materializes npm dependencies when package.json has dependencies', async () => {
		const testDir = join(tmpdir(), `test-deps-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		writeFileSync(
			join(testDir, 'package.json'),
			JSON.stringify({
				name: 'test-pkg-with-deps',
				version: '0.1.0',
				dependencies: {
					zod: '^3.23.0',
				},
			}),
		);
		try {
			const logs: string[] = [];
			await materializeNpmDeps(testDir, (msg) => logs.push(msg));
			expect(existsSync(join(testDir, 'node_modules', 'zod'))).toBe(true);
			expect(logs.some((l) => l.includes('materializing 1 npm dependency'))).toBe(true);
		} finally {
			rmSync(testDir, { recursive: true, force: true });
		}
	});
});
