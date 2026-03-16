import { json } from '@sveltejs/kit';
import { readSecurityLog, writeSecurityLog, appendSecurityLog } from '$lib/server/data.js';

const TYPE_LABELS = {
	// Authentification
	connexion:              'Connexion',
	deconnexion:            'Déconnexion',
	// Gestion utilisateurs
	user_add:               'Utilisateur ajouté',
	user_update:            'Utilisateur modifié',
	user_toggle:            'Utilisateur activé/désactivé',
	// Configuration système (superadmin)
	module_toggle:          'Module activé/désactivé',
	settings_change:        'Paramètres modifiés',
	role_settings_change:   'Paramètres rôle modifiés',
	param_lock:             'Paramètre verrouillé',
	param_unlock:           'Paramètre déverrouillé',
	identite_change:        'Identité mairie modifiée',
	template_upload:        'Modèle de document chargé',
	template_delete:        'Modèle de document supprimé',
	journal_efface:         'Journal de sécurité effacé',
	// Actions sur les dossiers
	statut_change:          'Changement de statut',
	reassignation:          'Réassignation de dossier',
	acte_valide:            'Acte validé',
	complement_demande:     'Compléments demandés',
	note_interne:           'Note interne ajoutée',
	escalade_ajout:         'Escalade créée',
	escalade_resolue:       'Escalade résolue',
	paiement_valide:        'Paiement validé',
	remboursement_initie:   'Remboursement initié',
	remboursement_valide:   'Remboursement effectué'
};

/**
 * GET /api/security-log
 * Paramètres: limit, type, acteur, search, from, to
 */
export function GET({ url }) {
	const limit    = Math.min(parseInt(url.searchParams.get('limit') || '500'), 2000);
	const type     = url.searchParams.get('type')   || '';
	const acteur   = url.searchParams.get('acteur') || '';
	const search   = (url.searchParams.get('search') || '').toLowerCase();
	const from     = url.searchParams.get('from');
	const to       = url.searchParams.get('to');

	let entries = readSecurityLog();

	if (type)   entries = entries.filter(e => e.type === type);
	if (acteur) entries = entries.filter(e => e.acteur === acteur);
	if (from)   entries = entries.filter(e => e.date >= from);
	if (to)     entries = entries.filter(e => e.date <= to + 'T23:59:59');
	if (search) {
		entries = entries.filter(e =>
			e.acteur.includes(search) ||
			e.type.includes(search)   ||
			JSON.stringify(e.details).toLowerCase().includes(search)
		);
	}

	return json({
		entries: entries.slice(0, limit),
		total:   entries.length,
		types:   TYPE_LABELS
	});
}

/**
 * POST /api/security-log — enregistre un événement (appelé depuis le client pour connexion/déconnexion)
 * Body: { type, acteur, details }
 */
export async function POST({ request }) {
	const { type, acteur, details } = await request.json();
	if (!type || !acteur) return json({ error: 'Champs manquants' }, { status: 400 });

	// Autoriser uniquement les types initiés côté client
	const CLIENT_TYPES = ['connexion', 'deconnexion'];
	if (!CLIENT_TYPES.includes(type)) return json({ error: 'Type non autorisé' }, { status: 403 });

	appendSecurityLog(type, acteur, details || {});
	return json({ ok: true });
}

/**
 * DELETE /api/security-log — efface tout le journal (superadmin uniquement)
 */
export function DELETE() {
	writeSecurityLog([]);
	appendSecurityLog('journal_efface', 'superadmin', { message: 'Journal de sécurité effacé' });
	return json({ ok: true });
}
