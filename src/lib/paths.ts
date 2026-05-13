// Resolve the on-disk pkgs directory the CLI installs into. Must match what
// the Ikenga shell scans at boot — otherwise CLI-installed pkgs are invisible
// to the shell and vice versa.
//
// Tauri's `app_data_dir` resolution rules per OS, parameterized by the
// shell's bundle identifier (`app.ikenga`):
//
//   - Linux:   $XDG_DATA_HOME/app.ikenga    (fallback ~/.local/share/app.ikenga)
//   - macOS:   ~/Library/Application Support/app.ikenga
//   - Windows: %APPDATA%/app.ikenga         (Roaming)
//
// This intentionally hardcodes the identifier; users running a forked or
// dev-renamed shell would need to override via the IKENGA_APP_DATA_DIR
// env var, which short-circuits the per-OS path.

import { homedir, platform } from 'node:os';
import { join } from 'node:path';

const BUNDLE_IDENTIFIER = 'app.ikenga';

export function appDataDir(): string {
	const override = process.env.IKENGA_APP_DATA_DIR;
	if (override) return override;
	const home = homedir();
	switch (platform()) {
		case 'darwin':
			return join(home, 'Library', 'Application Support', BUNDLE_IDENTIFIER);
		case 'win32': {
			const appData = process.env.APPDATA;
			if (appData) return join(appData, BUNDLE_IDENTIFIER);
			return join(home, 'AppData', 'Roaming', BUNDLE_IDENTIFIER);
		}
		default: {
			const xdg = process.env.XDG_DATA_HOME;
			if (xdg) return join(xdg, BUNDLE_IDENTIFIER);
			return join(home, '.local', 'share', BUNDLE_IDENTIFIER);
		}
	}
}

/** `<app_data_dir>/pkgs/` — same as the shell kernel's `pkgs_dir()`. */
export function pkgsDir(): string {
	return join(appDataDir(), 'pkgs');
}

/** Install dir for a given pkg id (matches the manifest's `id` field). */
export function pkgInstallDir(pkgId: string): string {
	return join(pkgsDir(), pkgId);
}
