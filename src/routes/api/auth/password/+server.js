import { json } from '@sveltejs/kit';
import bcrypt from 'bcrypt';
import { prisma } from '$lib/server/db.js';
import { appendSecurityLog } from '$lib/server/data.js';

/** POST /api/auth/password — changer son propre mot de passe */
export async function POST({ request, locals }) {
	const user = locals.user;
	if (!user) return json({ error: 'Non authentifié.' }, { status: 401 });

	const { current_password, new_password } = await request.json();

	if (!current_password || !new_password) {
		return json({ error: 'Tous les champs sont requis.' }, { status: 400 });
	}

	if (new_password.length < 8) {
		return json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' }, { status: 400 });
	}

	// Récupérer le hash actuel depuis la DB
	const utilisateur = await prisma.utilisateur.findUnique({ where: { id: user.id } });
	if (!utilisateur) return json({ error: 'Utilisateur introuvable.' }, { status: 404 });

	// Vérifier l'ancien mot de passe (si vide = premier changement après création par admin)
	if (utilisateur.password_hash !== '') {
		const ok = await bcrypt.compare(current_password, utilisateur.password_hash);
		if (!ok) {
			await appendSecurityLog('password_change_fail', user.role, { email: user.email });
			return json({ error: 'Mot de passe actuel incorrect.' }, { status: 403 });
		}
	}

	const new_hash = await bcrypt.hash(new_password, 12);
	await prisma.utilisateur.update({
		where: { id: user.id },
		data:  { password_hash: new_hash }
	});

	await appendSecurityLog('password_change', user.role, { email: user.email });

	return json({ ok: true });
}
