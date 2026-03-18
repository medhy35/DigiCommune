import { json } from '@sveltejs/kit';
import { getSession } from '$lib/server/data.js';

const SESSION_COOKIE = 'session_id';

/** GET /api/auth/session — retourne l'utilisateur courant ou 401 */
export async function GET({ cookies }) {
	const sessionId = cookies.get(SESSION_COOKIE);
	if (!sessionId) return json({ user: null }, { status: 401 });

	const session = await getSession(sessionId);
	if (!session) {
		cookies.delete(SESSION_COOKIE, { path: '/' });
		return json({ user: null }, { status: 401 });
	}

	const { utilisateur: u } = session;
	return json({
		user: {
			id:     u.id,
			nom:    u.nom,
			prenom: u.prenom,
			role:   u.role,
			email:  u.email,
			avatar: u.avatar,
			actif:  u.actif
		}
	});
}
