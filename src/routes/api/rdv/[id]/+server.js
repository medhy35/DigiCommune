import { json } from '@sveltejs/kit';
import { readRendezVous, writeRendezVous, appendSecurityLog } from '$lib/server/data.js';

/** PATCH /api/rdv/:id — Mise à jour par l'agent (statut, note) */
export async function PATCH({ params, request }) {
	const { id } = params;
	const body   = await request.json();
	const list   = readRendezVous();
	const idx    = list.findIndex(r => r.id === id);

	if (idx === -1) return json({ error: 'Rendez-vous introuvable.' }, { status: 404 });

	list[idx] = { ...list[idx], ...body, updated_at: new Date().toISOString() };
	writeRendezVous(list);
	appendSecurityLog('rdv_update', 'agent', { rdv_id: id, ...body });
	return json(list[idx]);
}

/** DELETE /api/rdv/:id — Annulation (citoyen ou agent) */
export async function DELETE({ params, url }) {
	const { id }   = params;
	const acteur   = url.searchParams.get('acteur') || 'agent';
	const list     = readRendezVous();
	const idx      = list.findIndex(r => r.id === id);

	if (idx === -1) return json({ error: 'Rendez-vous introuvable.' }, { status: 404 });
	if (list[idx].statut === 'effectue') {
		return json({ error: 'Un rendez-vous effectué ne peut pas être annulé.' }, { status: 400 });
	}

	list[idx].statut     = 'annule';
	list[idx].updated_at = new Date().toISOString();
	writeRendezVous(list);
	appendSecurityLog('rdv_annule', acteur, { rdv_id: id, demande_id: list[idx].demande_id });
	return json({ ok: true });
}
