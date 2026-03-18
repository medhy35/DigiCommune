import { json } from '@sveltejs/kit';
import { readRendezVous, updateRendezVous, appendSecurityLog } from '$lib/server/data.js';

/** PATCH /api/rdv/:id — Mise à jour par l'agent (statut, note) */
export async function PATCH({ params, request }) {
	const { id } = params;
	const body   = await request.json();

	const updated = await updateRendezVous(id, { ...body, updated_at: new Date().toISOString() });
	if (!updated) return json({ error: 'Rendez-vous introuvable.' }, { status: 404 });

	await appendSecurityLog('rdv_update', 'agent', { rdv_id: id, ...body });
	return json(updated);
}

/** DELETE /api/rdv/:id — Annulation (citoyen ou agent) */
export async function DELETE({ params, url }) {
	const { id }   = params;
	const acteur   = url.searchParams.get('acteur') || 'agent';

	const list = await readRendezVous({});
	const rdv  = list.find(r => r.id === id);

	if (!rdv) return json({ error: 'Rendez-vous introuvable.' }, { status: 404 });
	if (rdv.statut === 'effectue') {
		return json({ error: 'Un rendez-vous effectué ne peut pas être annulé.' }, { status: 400 });
	}

	await updateRendezVous(id, { statut: 'annule', updated_at: new Date().toISOString() });
	await appendSecurityLog('rdv_annule', acteur, { rdv_id: id, demande_id: rdv.demande_id });
	return json({ ok: true });
}
