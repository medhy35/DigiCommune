import { json } from '@sveltejs/kit';
import { readDemandes, writeDemandes, readSettings } from '$lib/server/data.js';
import { createNotification } from '$lib/server/notifications.js';
import { TYPE_ACTE_LABELS } from '$lib/utils/helpers.js';

export function GET({ url }) {
	const demandes     = readDemandes();
	const statut       = url.searchParams.get('statut');
	const type_acte    = url.searchParams.get('type_acte');
	const agent_id     = url.searchParams.get('agent_id');
	const escalade_level = url.searchParams.get('escalade_level');

	let result = demandes;
	if (statut)        result = result.filter(d => d.statut === statut);
	if (type_acte)     result = result.filter(d => d.type_acte === type_acte);
	if (agent_id)      result = result.filter(d => d.agent_id === agent_id);
	if (escalade_level) result = result.filter(d => d.escalade?.level === escalade_level && !d.escalade?.resolu);

	return json(result);
}

export async function POST({ request }) {
	const body = await request.json();

	// Vérifier que le module est actif
	const settings = readSettings();
	const modules  = settings.global?.modules || {};
	if (modules[body.type_acte] === false) {
		return json({ error: 'Ce service est temporairement indisponible.' }, { status: 403 });
	}

	const demandes = readDemandes();
	const id  = generateId(demandes);
	const now = new Date().toISOString();

	const newDemande = {
		id,
		created_at: now,
		updated_at: now,
		statut: 'recue',
		type_acte:         body.type_acte,
		concernant:        body.concernant,
		demandeur:         body.demandeur,
		personne_concernee: body.personne_concernee,
		copies:            body.copies,
		mode_reception:    body.mode_reception,
		documents: (body.documents || []).map(doc => renameDoc(doc, id, body.demandeur)),
		paiement: body.paiement || { mode: 'mairie', statut: 'en_attente', montant: body.copies * (settings.global?.frais_copie ?? 500) },
		agent_id: assignAgent(demandes),
		escalade: null,
		historique: [{
			statut: 'recue',
			date: now,
			note: body.paiement?.statut === 'paye'
				? `Demande soumise en ligne · Paiement confirmé (${body.paiement.reference})`
				: 'Demande soumise en ligne · Paiement au retrait',
			par: 'citoyen'
		}]
	};

	demandes.push(newDemande);
	writeDemandes(demandes);

	createNotification(
		'agent',
		'nouvelle_demande',
		`Nouvelle demande — ${body.demandeur.prenom} ${body.demandeur.nom} · ${TYPE_ACTE_LABELS[body.type_acte] || body.type_acte}`,
		id
	);

	return json(newDemande, { status: 201 });
}

/**
 * Génère un ID unique sur 10 chiffres.
 * Format : CI-XXXXXXXXXX
 * 6 chiffres temporels (timestamp/10000) + 4 chiffres aléatoires.
 */
function generateId(demandes) {
	const ts   = Math.floor(Date.now() / 1000);
	const rand = Math.floor(Math.random() * 9000) + 1000;
	const id   = `CI-${Math.floor(ts / 10000)}${rand}`;
	return demandes.some(d => d.id === id) ? generateId(demandes) : id;
}

const DOC_TYPE_KEYS = { cni: 'CNI', extrait: 'EXTRAIT-ACTE', passeport: 'PASSEPORT', justificatif: 'JUSTIFICATIF', autre: 'DOCUMENT' };

function renameDoc(doc, dossierId, demandeur) {
	const parts     = (doc.nom || 'fichier').split('.');
	const ext       = parts.length > 1 ? parts.pop().toLowerCase() : 'pdf';
	const typeLabel = DOC_TYPE_KEYS[doc.type] || doc.type?.toUpperCase() || 'DOCUMENT';
	const nom       = demandeur.nom.toUpperCase().replace(/[\s'']/g, '-');
	const prenom    = demandeur.prenom.replace(/[\s'']/g, '-');
	return { ...doc, nom: `${dossierId}_${typeLabel}_${nom}-${prenom}.${ext}` };
}

function assignAgent(demandes) {
	const agents = ['agent_001', 'agent_002'];
	const counts = agents.map(a => demandes.filter(d => d.agent_id === a).length);
	return agents[counts[0] <= counts[1] ? 0 : 1];
}
