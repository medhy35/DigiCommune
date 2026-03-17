import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

function logSecurityEvent(type, acteur, details = {}) {
	if (!browser) return;
	fetch('/api/security-log', {
		method:  'POST',
		headers: { 'Content-Type': 'application/json' },
		body:    JSON.stringify({ type, acteur, details })
	}).catch(() => {});
}

const ROLE_KEY = 'civici_role'; // gardé pour compat avec les sessions existantes
const USER_KEY = 'civici_user'; // { role, userId } — source of truth

function readStoredUser() {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(USER_KEY);
		if (raw) return JSON.parse(raw);
	} catch {}
	// Fallback : ancienne session (role string seul)
	const role = localStorage.getItem(ROLE_KEY);
	return role ? { role, userId: null } : null;
}

function createAuthStore() {
	const initial = readStoredUser();

	// roleStore — rôle string, conservé pour la compat des 11 fichiers existants
	const roleStore = writable(initial?.role ?? null);
	// userStore — { role, userId } — utilisé pour les nouveaux filtres et la migration PG
	const userStore = writable(initial);

	function login(role, userId = null) {
		const user = { role, userId };
		if (browser) {
			localStorage.setItem(ROLE_KEY, role);
			localStorage.setItem(USER_KEY, JSON.stringify(user));
		}
		roleStore.set(role);
		userStore.set(user);
		logSecurityEvent('connexion', userId || role, { via: 'login_page' });
	}

	function logout() {
		const role = browser ? localStorage.getItem(ROLE_KEY) : null;
		if (browser) {
			localStorage.removeItem(ROLE_KEY);
			localStorage.removeItem(USER_KEY);
		}
		roleStore.set(null);
		userStore.set(null);
		if (role) logSecurityEvent('deconnexion', role, {});
	}

	return { roleStore, userStore, login, logout };
}

const _auth = createAuthStore();

// authRole — API inchangée, tous les fichiers existants continuent de fonctionner
export const authRole = {
	subscribe: _auth.roleStore.subscribe,
	login:     _auth.login,
	logout:    _auth.logout
};

// authUser — nouveau store { role, userId }
// Quand on passe à PG : login() sera appelé avec le userId renvoyé par l'API d'auth
export const authUser = {
	subscribe: _auth.userStore.subscribe,
	login:     _auth.login,
	logout:    _auth.logout
};

// Dérivés existants — inchangés
export const isAgent       = derived(_auth.roleStore, $r => $r === 'agent');
export const isSuperviseur = derived(_auth.roleStore, $r => $r === 'superviseur');
export const isMaire       = derived(_auth.roleStore, $r => $r === 'maire');
export const isSuperadmin  = derived(_auth.roleStore, $r => $r === 'superadmin');
export const isAuthenticated = derived(_auth.roleStore, $r => !!$r);

export const ROLE_LABELS = {
	agent:      'Agent',
	superviseur:'Superviseur',
	maire:      'Maire',
	superadmin: 'Super Admin'
};

export const ROLE_COLORS = {
	agent:      'bg-blue-100 text-blue-700',
	superviseur:'bg-violet-100 text-violet-700',
	maire:      'bg-primary-100 text-primary-700',
	superadmin: 'bg-red-100 text-red-700'
};
