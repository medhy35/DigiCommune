/**
 * Hook serveur SvelteKit — s'exécute avant chaque requête.
 * Injecte l'utilisateur courant dans `locals` si une session valide existe.
 */
import { getSession } from '$lib/server/data.js';

const SESSION_COOKIE = 'session_id';

export async function handle({ event, resolve }) {
	const sessionId = event.cookies.get(SESSION_COOKIE);

	if (sessionId) {
		try {
			const session = await getSession(sessionId);
			if (session) {
				event.locals.user    = session.utilisateur;
				event.locals.session = session;
			}
		} catch {
			// Ignorer les erreurs de session (ex: DB non accessible)
		}
	}

	return resolve(event);
}
