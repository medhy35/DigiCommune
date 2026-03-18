import { json } from '@sveltejs/kit';
import { readDemandes } from '$lib/server/data.js';

/** GET /api/audit?limit=200&type=&role= */
export async function GET({ url }) {
	const limit      = parseInt(url.searchParams.get('limit') || '200');
	const typeFilter = url.searchParams.get('type') || '';
	const roleFilter = url.searchParams.get('role') || '';

	const demandes = await readDemandes();
	const entries  = [];

	for (const d of demandes) {
		for (const h of d.historique || []) {
			const action = h.type === 'note'          ? 'note_interne'
				: h.type === 'remboursement' ? 'remboursement'
				: h.type === 'escalade'      ? 'escalade'
				: 'changement_statut';

			const par = h.par || '';
			const role = par.includes('sup_')    ? 'superviseur'
				: par.includes('maire')  ? 'maire'
				: par.includes('Système') || par.includes('admin') ? 'superadmin'
				: 'agent';

			if (typeFilter && action !== typeFilter) continue;
			if (roleFilter && role   !== roleFilter) continue;

			entries.push({
				id:         `${d.id}_${h.date}`,
				demande_id: d.id,
				type_acte:  d.type_acte,
				demandeur:  `${d.demandeur?.prenom} ${d.demandeur?.nom}`,
				action, statut: h.statut,
				note: h.note || '', par, role,
				date: h.date
			});
		}
	}

	entries.sort((a, b) => new Date(b.date) - new Date(a.date));
	return json(entries.slice(0, limit));
}
