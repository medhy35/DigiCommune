import { json } from '@sveltejs/kit';
import bcrypt from 'bcrypt';
import { prisma, getCommuneId } from '$lib/server/db.js';
import { createSession, appendSecurityLog } from '$lib/server/data.js';

const SESSION_COOKIE = 'session_id';
const SESSION_MAX_AGE = 8 * 3600; // 8 heures en secondes

// ── Rate limiting en mémoire ─────────────────────────────────────────────────
// Clé : IP — Valeur : { count, resetAt }
const loginAttempts = new Map();
const MAX_ATTEMPTS  = 5;
const WINDOW_MS     = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip) {
	const now    = Date.now();
	const record = loginAttempts.get(ip);

	if (!record || now > record.resetAt) {
		loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
		return { blocked: false };
	}
	if (record.count >= MAX_ATTEMPTS) {
		const retryAfter = Math.ceil((record.resetAt - now) / 1000);
		return { blocked: true, retryAfter };
	}
	record.count++;
	return { blocked: false };
}

function resetRateLimit(ip) {
	loginAttempts.delete(ip);
}

// Nettoyage toutes les heures pour éviter les fuites mémoire
setInterval(() => {
	const now = Date.now();
	for (const [key, val] of loginAttempts) {
		if (now > val.resetAt) loginAttempts.delete(key);
	}
}, 60 * 60 * 1000);

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST({ request, cookies, url, getClientAddress }) {
	const ip = getClientAddress();
	const rl = checkRateLimit(ip);

	if (rl.blocked) {
		return json(
			{ error: `Trop de tentatives. Réessayez dans ${Math.ceil(rl.retryAfter / 60)} minute(s).` },
			{ status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
		);
	}

	const { email, password } = await request.json();

	if (!email || !password) {
		return json({ error: 'Email et mot de passe requis.' }, { status: 400 });
	}

	const commune_id = getCommuneId();

	const utilisateur = await prisma.utilisateur.findFirst({
		where: { email: email.toLowerCase().trim(), commune_id, actif: true }
	});

	if (!utilisateur) {
		await new Promise(r => setTimeout(r, 200));
		return json({ error: 'Identifiants incorrects.' }, { status: 401 });
	}

	const passwordOk = await bcrypt.compare(password, utilisateur.password_hash);
	if (!passwordOk) {
		await appendSecurityLog('connexion_echec', utilisateur.role, { email, commune_id, ip });
		return json({ error: 'Identifiants incorrects.' }, { status: 401 });
	}

	// Connexion réussie → on efface le compteur
	resetRateLimit(ip);

	const settings = await prisma.settings.findUnique({ where: { commune_id } });
	const heures   = settings?.data?.global?.securite_session_heures ?? 8;

	const session = await createSession(utilisateur.id, heures);

	const isHttps = url.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
	cookies.set(SESSION_COOKIE, session.id, {
		path:     '/',
		httpOnly: true,
		sameSite: 'lax',
		secure:   isHttps,
		maxAge:   SESSION_MAX_AGE
	});

	await appendSecurityLog('connexion', utilisateur.role, {
		email:      utilisateur.email,
		nom:        `${utilisateur.prenom} ${utilisateur.nom}`,
		session_id: session.id,
		ip
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
