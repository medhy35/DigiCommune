/**
 * Store d'authentification — basé sur sessions BDD (cookie httpOnly).
 * L'état est chargé via GET /api/auth/session au démarrage.
 */
import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';

function createAuthStore() {
	// { id, nom, prenom, role, email, avatar } ou null
	const { subscribe, set } = writable(null);

	return {
		subscribe,

		/** Appelé après un login réussi — reçoit l'objet user depuis l'API */
		setUser(user) {
			set(user);
		},

		/** Charge la session depuis le serveur (au démarrage) */
		async load() {
			if (!browser) return;
			try {
				const res = await fetch('/api/auth/session');
				if (res.ok) {
					const { user } = await res.json();
					set(user);
				} else {
					set(null);
				}
			} catch {
				set(null);
			}
		},

		/** Connexion via l'API */
		async login(email, password) {
			const res = await fetch('/api/auth/login', {
				method:  'POST',
				headers: { 'Content-Type': 'application/json' },
				body:    JSON.stringify({ email, password })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Erreur de connexion');
			set(data.user);
			return data.user;
		},

		/** Déconnexion */
		async logout() {
			try {
				await fetch('/api/auth/logout', { method: 'POST' });
			} catch {}
			set(null);
			if (browser) goto('/login');
		}
	};
}

export const authUser = createAuthStore();

// Stores dérivés — compatibles avec le code existant via authRole
export const authRole      = derived(authUser, $u => $u?.role ?? null);
export const isAgent       = derived(authUser, $u => $u?.role === 'agent');
export const isSuperviseur = derived(authUser, $u => $u?.role === 'superviseur');
export const isMaire       = derived(authUser, $u => $u?.role === 'maire');
export const isSuperadmin  = derived(authUser, $u => $u?.role === 'superadmin');
export const isAuthenticated = derived(authUser, $u => !!$u);

export const ROLE_LABELS = {
	agent:       'Agent',
	superviseur: 'Superviseur',
	maire:       'Maire',
	superadmin:  'Super Admin'
};

export const ROLE_COLORS = {
	agent:       'bg-blue-100 text-blue-700',
	superviseur: 'bg-violet-100 text-violet-700',
	maire:       'bg-primary-100 text-primary-700',
	superadmin:  'bg-red-100 text-red-700'
};
