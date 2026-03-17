/**
 * /api/users — couche d'abstraction utilisateurs.
 *
 * Aujourd'hui : lit depuis utilisateurs.json
 * Migration PG : remplacer readUsers() par une requête SQL ici,
 *                le reste de l'appli ne change pas.
 */
import { json } from '@sveltejs/kit';
import { readUsers } from '$lib/server/data.js';

export function GET({ url }) {
	const role = url.searchParams.get('role');
	const users = readUsers();

	// Aplatit tous les utilisateurs en une liste uniforme
	const all = [
		...(users.agents       || []),
		...(users.superviseurs || []),
		...(users.maire        ? [users.maire]        : []),
		...(users.superadmin   ? [users.superadmin]   : [])
	];

	const result = role ? all.filter(u => u.role === role) : all;

	// Ne jamais exposer de données sensibles (mdp, tokens…) côté client
	return json(result.map(({ id, nom, prenom, role, email, avatar, actif }) =>
		({ id, nom, prenom, role, email, avatar, actif })
	));
}
