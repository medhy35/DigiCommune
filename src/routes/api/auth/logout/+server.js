import { json } from '@sveltejs/kit';
import { deleteSession, appendSecurityLog } from '$lib/server/data.js';

const SESSION_COOKIE = 'session_id';

export async function POST({ cookies }) {
	const sessionId = cookies.get(SESSION_COOKIE);

	if (sessionId) {
		await deleteSession(sessionId);
		await appendSecurityLog('deconnexion', 'utilisateur', { session_id: sessionId });
	}

	cookies.delete(SESSION_COOKIE, { path: '/' });
	return json({ ok: true });
}
