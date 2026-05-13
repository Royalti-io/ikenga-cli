// `ikenga remove <pkg>` — delete the pkg's install dir. Accepts either the
// manifest id (`com.ikenga.hello`) or the npm name (`@ikenga/pkg-hello`).
//
// We don't try to call into a running shell's kernel; the shell discovers
// removals at next boot. This means a running shell may still have the pkg
// loaded until restart — print a hint so the user knows.

import { findInstalled } from '../lib/installed.js';
import { uninstallPkg } from '../lib/install.js';

export async function removeCommand(spec: string): Promise<number> {
	const pkgId = resolveToPkgId(spec);
	const inst = findInstalled(pkgId);
	if (!inst) {
		process.stderr.write(`error: ${spec} is not installed (looked up ${pkgId})\n`);
		return 1;
	}
	const ok = uninstallPkg(pkgId);
	if (!ok) {
		process.stderr.write(`error: failed to remove ${inst.installPath}\n`);
		return 1;
	}
	process.stdout.write(`removed ${pkgId} (was v${inst.version})\n`);
	process.stdout.write(
		'   (restart the Ikenga shell to unregister it from the kernel)\n',
	);
	return 0;
}

/** Accept either `com.ikenga.<short>` or `@ikenga/pkg-<short>`. */
function resolveToPkgId(spec: string): string {
	if (spec.startsWith('com.ikenga.')) return spec;
	const short = spec.replace(/^@ikenga\//, '').replace(/^pkg-/, '');
	return `com.ikenga.${short}`;
}
