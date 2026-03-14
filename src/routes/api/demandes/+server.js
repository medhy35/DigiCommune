import { json } from '@sveltejs/kit';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createNotification } from '$lib/server/notifications.js';

const DATA_FILE = join(process.cwd(), 'data', 'demandes.json');
const SETTINGS_FILE = join(process.cwd(), 'data', 'settings.json');

function readDemandes() {
	return JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
}

function writeDemandes(demandes) {
	writeFileSync(DATA_FILE, JSON.stringify(demandes, null, 2), 'utf-8');
}

export function GET({ url }) {
	const demandes = readDemandes();
	const statut = url.searchParams.get('statut');
	const type_acte = url.searchParams.get('type_acte');
	const agent_id = url.searchParams.get('agent_id');
	const escalade_level = url.searchParams.get('escalade_level');

	let result = demandes;

	if (statut) result = result.filter(d => d.statut === statut);
	if (type_acte) result = result.filter(d => d.type_acte === type_acte);
	if (agent_id) result = result.filter(d => d.agent_id === agent_id);
	if (escalade_level) result = result.filter(d => d.escalade?.level === escalade_level && !d.escalade?.resolu);

	return json(result);
}

export async function POST({ request }) {
	const body = await request.json();

	// Vérifier que le module est actif
	const settings = JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8'));
	const modules = settings.global?.modules || {};
	if (modules[body.type_acte] === false) {
		return json({ error: 'Ce service est temporairement indisponible.' }, { status: 403 });
	}

	const demandes = readDemandes();

	// Génère un ID sur 10 chiffres : base timestamp secondes (6 chiffres, change ~toutes les 2h45)
	// + suffixe aléatoire 4 chiffres → imprévisible, jamais séquentiel, garanti unique
	const id = generateId(demandes);

	const now = new Date().toISOString();
	const newDemande = {
		id,
		created_at: now,
		updated_at: now,
		statut: 'recue',
		type_acte: body.type_acte,
		concernant: body.concernant,
		demandeur: body.demandeur,
		personne_concernee: body.personne_concernee,
		copies: body.copies,
		mode_reception: body.mode_reception,
		documents: (body.documents || []).map(doc => renameDoc(doc, id, body.demandeur)),
		paiement: body.paiement || { mode: 'mairie', statut: 'en_attente', montant: body.copies * 500 },
		agent_id: assignAgent(demandes),
		escalade: null,
		historique: [
			{
				statut: 'recue',
				date: now,
				note: body.paiement?.statut === 'paye'
					? `Demande soumise en ligne · Paiement confirmé (${body.paiement.reference})`
					: 'Demande soumise en ligne · Paiement au retrait',
				par: 'citoyen'
			}
		]
	};

	demandes.push(newDemande);
	writeDemandes(demandes);

	// Notifier l'agent assigné
	const agentId = newDemande.agent_id;
	const agentNum = agentId?.split('_')[1];
	const TYPE_LABELS = { naissance: 'Acte de naissance', mariage: 'Acte de mariage', deces: 'Acte de décès' };
	createNotification(
		'agent',
		'nouvelle_demande',
		`Nouvelle demande — ${body.demandeur.prenom} ${body.demandeur.nom} · ${TYPE_LABELS[body.type_acte] || body.type_acte}`,
		id
	);

	return json(newDemande, { status: 201 });
}

/** Génère un numéro de dossier unique sur 10 chiffres.
 *  Format : CI-XXXXXXXXXX
 *  - 6 premiers chiffres : Math.floor(timestamp_s / 10000) → ancrage temporel, change ~toutes les 2h45
 *  - 4 derniers chiffres : random 1000-9999 → casse toute séquentialité prévisible
 *  Collision check : si le même ID existe déjà (astronomiquement rare), on régénère.
 */
function generateId(demandes) {
	const ts = Math.floor(Date.now() / 1000);
	const rand = Math.floor(Math.random() * 9000) + 1000;
	const id = `CI-${Math.floor(ts / 10000)}${rand}`;
	return demandes.some(d => d.id === id) ? generateId(demandes) : id;
}

/** Renomme un document uploadé avec une convention lisible et traçable.
 *  Résultat : CI-1741231234_CNI_KONAN-Amara.pdf
 */
const DOC_TYPE_LABELS = {
	cni: 'CNI',
	extrait: 'EXTRAIT-ACTE',
	passeport: 'PASSEPORT',
	justificatif: 'JUSTIFICATIF',
	autre: 'DOCUMENT'
};

function renameDoc(doc, dossierId, demandeur) {
	const parts = (doc.nom || 'fichier').split('.');
	const ext = parts.length > 1 ? parts.pop().toLowerCase() : 'pdf';
	const typeLabel = DOC_TYPE_LABELS[doc.type] || doc.type?.toUpperCase() || 'DOCUMENT';
	// Normalise : majuscules, remplace espaces et apostrophes par tirets
	const nom = demandeur.nom.toUpperCase().replace(/[\s'']/g, '-');
	const prenom = demandeur.prenom.replace(/[\s'']/g, '-');
	return { ...doc, nom: `${dossierId}_${typeLabel}_${nom}-${prenom}.${ext}` };
}

function assignAgent(demandes) {
	// Simple round-robin between the two agents
	const agents = ['agent_001', 'agent_002'];
	const counts = agents.map(a => demandes.filter(d => d.agent_id === a).length);
	return agents[counts[0] <= counts[1] ? 0 : 1];
}
