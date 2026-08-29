// WP-03 DoD, made reproducible (Round 5 · G-31, G-32).
//
// The original fixture declared root `kind: "webview"` and a `window` block —
// the discriminator G-06 proved the kernel never dispatches on. It therefore
// proved only that `ikenga add` tolerates an arbitrary root-kind string, which
// was already true. These tests assert the fixture describes a package that
// would actually mount: the real route discriminator, a webview capability,
// and an origin boundary whose patterns match the source it declares.
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURE = join(import.meta.dir, 'fixtures', 'webview-registry');
const manifest = () =>
	JSON.parse(readFileSync(join(FIXTURE, 'dummy-webview', 'manifest.json'), 'utf8'));

/** Mirrors `origin_allowed` / `origin_matches` in shell/src-tauri/src/pkg/webview.rs. */
function originMatches(origin: string, pat: string): boolean {
	if (pat === '*' || pat === origin) return true;
	const [patScheme, patRest] = pat.split('://');
	if (!patRest?.startsWith('*.')) return false;
	const suffix = patRest.slice(2);
	if (!suffix || suffix.includes('/')) return false;
	const [originScheme, host] = origin.split('://');
	if (originScheme !== patScheme || !host) return false;
	return host.length > suffix.length + 1 && host.endsWith(suffix) && host[host.length - suffix.length - 1] === '.';
}

describe('webview-registry fixture', () => {
	test('the local index exists and is signed', () => {
		expect(existsSync(join(FIXTURE, 'index.json'))).toBe(true);
		expect(existsSync(join(FIXTURE, 'index.json.minisig'))).toBe(true);
		expect(existsSync(join(FIXTURE, 'minising.pub'))).toBe(true);
	});

	test('no minisign secret key is left in the tree (G-33)', () => {
		expect(existsSync(join(FIXTURE, 'minising.key'))).toBe(false);
	});

	test('the index entry is resolvable and points at a detail doc', () => {
		const idx = JSON.parse(readFileSync(join(FIXTURE, 'index.json'), 'utf8'));
		const entry = idx.pkgs.find((p: { name: string }) => p.name === 'com.example.webview');
		expect(entry).toBeDefined();
		expect(entry.latest).toBe('1.0.0');
		expect(entry.detail).toContain('com.example.webview.json');
	});

	test('the fixture mounts via the REAL discriminator, not the root kind hint (G-31)', () => {
		const m = manifest();
		const route = m.ui?.routes?.[0];
		expect(route?.kind).toBe('webview');
		expect(m.capabilities?.webview?.child_webviews).toBe(true);
		// root `kind` is a catalog hint and must not be what carries the meaning
		expect(m.kind).not.toBe('webview');
	});

	test('the route declares a partition that the capability also declares (G-16)', () => {
		const m = manifest();
		const part = m.ui.routes[0].partition;
		expect(part).toBeDefined();
		expect(m.capabilities.webview.partitions).toContain(part);
	});

	test('declared allowed_origins actually admit the route source (G-35)', () => {
		const m = manifest();
		const origin = new URL(m.ui.routes[0].source).origin;
		const allowed: string[] = m.capabilities.webview.allowed_origins;
		expect(allowed.length).toBeGreaterThan(0);
		// this is the assertion that would have caught the unmountable PoC packages
		expect(allowed.some((p) => originMatches(origin, p))).toBe(true);
	});

	test('the fixture targets the shipped manifest API version', () => {
		expect(manifest().ikenga_api).toBe('4');
	});
});
