import { json } from '@sveltejs/kit';
import {
	readDemandes, createDemande, readSettings,
	createNotification, countDemandesParAgent
} from '$lib/server/data.js';
import { lookupVerifCode } from '$lib/server/verification.js';
import { TYPE_ACTE_LABELS } from '$lib/utils/helpers.js';

export async function GET({ url }) {
	const filters = {
		statut:         url.searchParams.get('statut')         || undefined,
		type_acte:      url.searchParams.get('type_acte')      || undefined,
		agent_id:       url.searchParams.get('agent_id')       || undefined,
		escalade_level: url.searchParams.get('escalade_level') || undefined
	};
	const demandes = await readDemandes(filters);
	return json(demandes);
}

export async function POST({ request }) {
	const body = await request.json();

	const settings = await readSettings();
	const modules  = settings.global?.modules || {};
	if (modules[body.type_acte] === false) {
		return json({ error: 'Ce service est temporairement indisponible.' }, { status: 403 });
	}

	const id  = generateId();
	const now = new Date().toISOString();

	const codeAttestation = await generateUniqueCode();
	const codePaiement    = body.paiement?.statut === 'paye'
		? await generateUniqueCode()
		: null;

	const agentId = await assignAgent();

	const data = {
		id,
		statut:             'recue',
		type_acte:          body.type_acte,
		concernant:         body.concernant,
		demandeur:          body.demandeur,
		personne_concernee: body.personne_concernee ?? null,
		copies:             body.copies ?? 1,
		mode_reception:     body.mode_reception ?? 'retrait',
		documents:          (body.documents || []).map(doc => renameDoc(doc, id, body.demandeur)),
		paiement:           body.paiement || {
			mode:    'mairie',
			statut:  'en_attente',
			montant: (body.copies ?? 1) * (settings.global?.frais_copie ?? 500)
		},
		agent_id:           agentId,
		escalade:           null,
		verification_codes: {
			attestation: codeAttestation,
			...(codePaiement ? { recu: codePaiement } : {})
		},
		historique: [{
			statut: 'recue',
			date:   now,
			note:   body.paiement?.statut === 'paye'
				? `Demande soumise en ligne · Paiement confirmé (${body.paiement.reference})`
				: 'Demande soumise en ligne · Paiement au retrait',
			par: 'citoyen'
		}]
	};

	const demande = await createDemande(data);

	await createNotification(
		'agent',
		'nouvelle_demande',
		`Nouvelle demande — ${body.demandeur.prenom} ${body.demandeur.nom} · ${TYPE_ACTE_LABELS[body.type_acte] || body.type_acte}`,
		id
	);

	return json(demande, { status: 201 });
}

function generateId() {
	const ts   = Math.floor(Date.now() / 1000);
	const rand = Math.floor(Math.random() * 9000) + 1000;
	return `CI-${Math.floor(ts / 10000)}${rand}`;
}

async function generateUniqueCode() {
	const { randomBytes } = await import('crypto');
	let code;
	do {
		code = randomBytes(4).toString('hex').toUpperCase();
	} while (await lookupVerifCode(code));
	return code;
}

async function assignAgent() {
	// TODO: charger les agents actifs depuis la DB plutôt que coder en dur
	const agentIds = ['agent_001', 'agent_002'];
	const counts   = await countDemandesParAgent(agentIds);
	return agentIds.reduce((best, id) => counts[id] <= counts[best] ? id : best, agentIds[0]);
}

const DOC_TYPE_KEYS = {
	cni: 'CNI', extrait: 'EXTRAIT-ACTE', passeport: 'PASSEPORT',
	justificatif: 'JUSTIFICATIF', autre: 'DOCUMENT'
};

function renameDoc(doc, dossierId, demandeur) {
	const parts     = (doc.nom || 'fichier').split('.');
	const ext       = parts.length > 1 ? parts.pop().toLowerCase() : 'pdf';
	const typeLabel = DOC_TYPE_KEYS[doc.type] || doc.type?.toUpperCase() || 'DOCUMENT';
	const nom       = demandeur.nom.toUpperCase().replace(/[\s'']/g, '-');
	const prenom    = demandeur.prenom.replace(/[\s'']/g, '-');
	return { ...doc, nom: `${dossierId}_${typeLabel}_${nom}-${prenom}.${ext}` };
}
