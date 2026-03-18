import { json } from '@sveltejs/kit';
import bcrypt from 'bcrypt';
import { prisma, getCommuneId } from '$lib/server/db.js';
import { createSession, appendSecurityLog } from '$lib/server/data.js';

const SESSION_COOKIE = 'session_id';
const SESSION_MAX_AGE = 8 * 3600; // 8 heures en secondes

export async function POST({ request, cookies }) {
	const { email, password } = await request.json();

	if (!email || !password) {
		return json({ error: 'Email et mot de passe requis.' }, { status: 400 });
	}

	const commune_id = getCommuneId();

	const utilisateur = await prisma.utilisateur.findFirst({
		where: { email: email.toLowerCase().trim(), commune_id, actif: true }
	});

	if (!utilisateur) {
		// Délai pour contrer les attaques par timing
		await new Promise(r => setTimeout(r, 200));
		return json({ error: 'Identifiants incorrects.' }, { status: 401 });
	}

	const passwordOk = await bcrypt.compare(password, utilisateur.password_hash);
	if (!passwordOk) {
		await appendSecurityLog('connexion_echec', utilisateur.role, { email, commune_id });
		return json({ error: 'Identifiants incorrects.' }, { status: 401 });
	}

	const settings = await prisma.settings.findUnique({ where: { commune_id } });
	const heures   = settings?.data?.global?.securite_session_heures ?? 8;

	const session = await createSession(utilisateur.id, heures);

	cookies.set(SESSION_COOKIE, session.id, {
		path:     '/',
		httpOnly: true,
		sameSite: 'lax',
		secure:   process.env.NODE_ENV === 'production',
		maxAge:   SESSION_MAX_AGE
	});

	await appendSecurityLog('connexion', utilisateur.role, {
		email:        utilisateur.email,
		nom:          `${utilisateur.prenom} ${utilisateur.nom}`,
		session_id:   session.id
	});

	return json({
		ok:   true,
		user: {
			id:     utilisateur.id,
			nom:    utilisateur.nom,
			prenom: utilisateur.prenom,
			role:   utilisateur.role,
			email:  utilisateur.email,
			avatar: utilisateur.avatar
		}
	});
}
