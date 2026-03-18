import { json } from '@sveltejs/kit';
import { readSecurityLog, clearSecurityLog, appendSecurityLog } from '$lib/server/data.js';

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
	remboursement_valide:   'Remboursement effectué',
	// Rendez-vous
	rdv_pris:              'RDV pris par le citoyen',
	rdv_update:            'RDV mis à jour',
	rdv_annule:            'RDV annulé',
	rdv_settings_change:   'Paramètres RDV modifiés'
};

/**
 * GET /api/security-log
 * Paramètres: limit, type, acteur, search, from, to
 */
export async function GET({ url }) {
	const limit    = Math.min(parseInt(url.searchParams.get('limit') || '500'), 2000);
	const type     = url.searchParams.get('type')   || '';
	const acteur   = url.searchParams.get('acteur') || '';
	const search   = (url.searchParams.get('search') || '').toLowerCase();
	const from     = url.searchParams.get('from');
	const to       = url.searchParams.get('to');

	// Pass supported filters to data layer; search is handled in JS
	const filters = {};
	if (type)   filters.type   = type;
	if (acteur) filters.acteur = acteur;
	if (from)   filters.from   = from;
	if (to)     filters.to     = to;

	let entries = await readSecurityLog(filters);

	// search is not supported at DB level — filter in JS
	if (search) {
		entries = entries.filter(e =>
			e.acteur.includes(search) ||
			e.type.includes(search)   ||
			JSON.stringify(e.details).toLowerCase().includes(search)
		);
	}

	// Normalise date field: SecurityLog has .date as Date object
	const serialised = entries.slice(0, limit).map(e => ({
		...e,
		date: e.date instanceof Date ? e.date.toISOString() : e.date
	}));

	return json({
		entries: serialised,
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

	await appendSecurityLog(type, acteur, details || {});
	return json({ ok: true });
}

/**
 * DELETE /api/security-log — efface tout le journal (superadmin uniquement)
 */
export async function DELETE() {
	await clearSecurityLog();
	await appendSecurityLog('journal_efface', 'superadmin', { message: 'Journal de sécurité effacé' });
	return json({ ok: true });
}
