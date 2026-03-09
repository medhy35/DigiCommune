import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

function createAuthStore() {
	const STORAGE_KEY = 'civici_role';

	const initialRole = browser ? localStorage.getItem(STORAGE_KEY) : null;

	const { subscribe, set } = writable(initialRole);

	return {
		subscribe,
		login(role) {
			if (browser) localStorage.setItem(STORAGE_KEY, role);
			set(role);
		},
		logout() {
			if (browser) localStorage.removeItem(STORAGE_KEY);
			set(null);
		}
	};
}

export const authRole = createAuthStore();

export const isAgent = derived(authRole, $role => $role === 'agent');
export const isSuperviseur = derived(authRole, $role => $role === 'superviseur');
export const isMaire = derived(authRole, $role => $role === 'maire');
export const isAuthenticated = derived(authRole, $role => !!$role);

export const ROLE_LABELS = {
	agent: 'Agent',
	superviseur: 'Superviseur',
	maire: 'Maire'
};

export const ROLE_COLORS = {
	agent: 'bg-blue-100 text-blue-700',
	superviseur: 'bg-violet-100 text-violet-700',
	maire: 'bg-primary-100 text-primary-700'
};
