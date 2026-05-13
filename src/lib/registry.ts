// Thin wrapper around @ikenga/registry-client that hardcodes the official
// registry URL + minisign public key. Same constants the shell embeds — keep
// them in lockstep when rotating the signing key.

import {
	fetchIndex as fetchIndexLib,
	fetchPkgDetail as fetchPkgDetailLib,
	resolveInstallPlan as resolveInstallPlanLib,
	type FetchedIndex,
	type InstallStep,
	type PkgDetail,
	type RegistryEntry,
} from '@ikenga/registry-client';

export const REGISTRY_URL = 'https://royalti-io.github.io/ikenga-registry/index.json';
export const REGISTRY_PUBKEY = 'RWRTqugAYXnZRgZPMyuqRNB3G41wg+AhSU2yT8nmDNNQlWQPeCfRXAvI';

export type { FetchedIndex, InstallStep, PkgDetail, RegistryEntry };

export async function fetchIndex(): Promise<FetchedIndex> {
	return fetchIndexLib({
		indexUrl: REGISTRY_URL,
		publicKey: REGISTRY_PUBKEY,
	});
}

export async function fetchPkgDetail(
	indexUrl: string,
	entry: RegistryEntry | { name: string },
): Promise<PkgDetail> {
	return fetchPkgDetailLib({ indexUrl, entry });
}

/**
 * Build an install plan for `npmName` at `version` (or latest). The caller's
 * detail cache is what dedupes per-pkg fetches — for one-shot CLI runs we
 * just use a fresh Map.
 */
export async function resolveInstallPlan(
	indexUrl: string,
	root: PkgDetail,
	version?: string,
): Promise<InstallStep[]> {
	const cache = new Map<string, PkgDetail>();
	const getDetail = async (name: string): Promise<PkgDetail> => {
		const cached = cache.get(name);
		if (cached) return cached;
		const fresh = await fetchPkgDetail(indexUrl, { name });
		cache.set(name, fresh);
		return fresh;
	};
	return resolveInstallPlanLib({ root, version, fetchDetail: getDetail });
}
