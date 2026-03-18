import { json } from '@sveltejs/kit';
import { readRendezVous, createRendezVous, readSettings, appendSecurityLog } from '$lib/server/data.js';

/** Génère les créneaux disponibles pour une date donnée (YYYY-MM-DD). */
function getCreneaux(date, rdvCfg, allRdv) {
	const [hDeb, mDeb] = rdvCfg.heure_debut.split(':').map(Number);
	const [hFin, mFin] = rdvCfg.heure_fin.split(':').map(Number);
	const duree = rdvCfg.duree_creneau || 30;
	const max   = rdvCfg.max_rdv_par_creneau || 3;

	const slots = [];
	let h = hDeb, m = mDeb;
	while (h * 60 + m < hFin * 60 + mFin) {
		const heure = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
		const pris  = allRdv.filter(r => r.date_rdv === date && r.heure_rdv === heure && r.statut !== 'annule').length;
		slots.push({ heure, disponible: pris < max, pris, max });
		m += duree;
		if (m >= 60) { h += Math.floor(m / 60); m = m % 60; }
	}
	return slots;
}

/** Vérifie que le jour de la date est dans jours_ouvrables (0=dim,1=lun…6=sam). */
function isJourOuvrable(dateStr, jours) {
	const dow = new Date(dateStr + 'T12:00:00').getDay();
	return jours.includes(dow);
}

/** GET /api/rdv
 *  ?demande_id=CI-XXX   → RDV du dossier
 *  ?creneaux=YYYY-MM-DD → créneaux disponibles ce jour-là
 *  ?statut=confirme     → filtre par statut
 *  (sans params)        → tous les RDV (usage agent/admin)
 */
export async function GET({ url }) {
	const demandeId     = url.searchParams.get('demande_id');
	const dateCreneaux  = url.searchParams.get('creneaux');
	const statut        = url.searchParams.get('statut');

	if (dateCreneaux) {
		const settings = await readSettings();
		const rdvCfg   = settings.rdv || { heure_debut:'08:00', heure_fin:'16:00', duree_creneau:30, max_rdv_par_creneau:3, jours_ouvrables:[1,2,3,4,5] };
		if (!isJourOuvrable(dateCreneaux, rdvCfg.jours_ouvrables)) {
			return json([]);
		}
		const allRdv = await readRendezVous({ date_rdv: dateCreneaux });
		return json(getCreneaux(dateCreneaux, rdvCfg, allRdv));
	}

	const filters = {};
	if (demandeId) filters.demande_id = demandeId;
	if (statut)    filters.statut     = statut;

	const result = await readRendezVous(filters);
	result.sort((a, b) => {
		const da = new Date(a.date_rdv + 'T' + a.heure_rdv);
		const db = new Date(b.date_rdv + 'T' + b.heure_rdv);
		return da - db;
	});
	return json(result);
}

/** POST /api/rdv — Prise de rendez-vous (citoyen) */
export async function POST({ request }) {
	const body = await request.json();
	const { demande_id, demandeur, date_rdv, heure_rdv } = body;

	if (!demande_id || !date_rdv || !heure_rdv) {
		return json({ error: 'Champs obligatoires manquants.' }, { status: 400 });
	}

	const settings = await readSettings();

	if (!settings.global?.modules?.rdv) {
		return json({ error: 'Le module de prise de rendez-vous est désactivé.' }, { status: 403 });
	}

	const rdvCfg = settings.rdv || { max_rdv_par_creneau: 3, jours_ouvrables: [1,2,3,4,5] };

	// Vérifier qu'il n'existe pas déjà un RDV actif pour ce dossier
	const existants = await readRendezVous({ demande_id });
	const existant  = existants.find(r => r.statut !== 'annule');
	if (existant) {
		return json({ error: 'Un rendez-vous existe déjà pour ce dossier.', rdv: existant }, { status: 409 });
	}

	// Vérifier que le créneau est disponible
	const creneauRdv = await readRendezVous({ date_rdv, heure_rdv });
	const pris = creneauRdv.filter(r => r.statut !== 'annule').length;
	if (pris >= (rdvCfg.max_rdv_par_creneau || 3)) {
		return json({ error: 'Ce créneau est complet. Veuillez en choisir un autre.' }, { status: 409 });
	}

	// Vérifier que le jour est ouvrable
	if (!isJourOuvrable(date_rdv, rdvCfg.jours_ouvrables)) {
		return json({ error: 'La mairie est fermée ce jour-là.' }, { status: 400 });
	}

	const rdv = await createRendezVous({
		demande_id,
		demandeur:   demandeur || {},
		date_rdv,
		heure_rdv,
		lieu:        rdvCfg.lieu || 'Mairie',
		statut:      'en_attente',
		note_agent:  ''
	});

	await appendSecurityLog('rdv_pris', 'citoyen', { rdv_id: rdv.id, demande_id, date_rdv, heure_rdv });
	return json(rdv, { status: 201 });
}
