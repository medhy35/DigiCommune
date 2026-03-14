import { json } from '@sveltejs/kit';
import { readFileSync } from 'fs';
import { join } from 'path';

const DATA_FILE = join(process.cwd(), 'data', 'demandes.json');

/** GET /api/audit?limit=100&type=&role= */
export function GET({ url }) {
	const limit  = parseInt(url.searchParams.get('limit')  || '200');
	const typeFilter = url.searchParams.get('type') || '';
	const roleFilter = url.searchParams.get('role') || '';

	const demandes = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));

	/** Flatten all historique entries with demande context */
	const entries = [];
	for (const d of demandes) {
		for (const h of d.historique || []) {
			const action = h.type === 'note'
				? 'note_interne'
				: h.type === 'remboursement'
					? 'remboursement'
					: h.type === 'escalade'
						? 'escalade'
						: 'changement_statut';

			// Detect role from user id or name
			const par = h.par || '';
			const inferredRole = par.includes('sup_') ? 'superviseur'
				: par.includes('maire') ? 'maire'
				: par.includes('Système') || par.includes('admin') ? 'superadmin'
				: 'agent';

			if (typeFilter && action !== typeFilter) continue;
			if (roleFilter && inferredRole !== roleFilter) continue;

			entries.push({
				id:           `${d.id}_${h.date}`,
				demande_id:   d.id,
				type_acte:    d.type_acte,
				demandeur:    `${d.demandeur?.prenom} ${d.demandeur?.nom}`,
				action,
				statut:       h.statut,
				note:         h.note || '',
				par:          par,
				role:         inferredRole,
				date:         h.date
			});
		}
	}

	// Sort newest first, apply limit
	entries.sort((a, b) => new Date(b.date) - new Date(a.date));
	return json(entries.slice(0, limit));
}
