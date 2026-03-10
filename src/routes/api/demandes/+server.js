import { json } from '@sveltejs/kit';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createNotification } from '$lib/server/notifications.js';const DATA_FILE = join(process.cwd(), 'data', 'demandes.json');

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
	const demandes = readDemandes();

	// Generate ID
	const year = new Date().getFullYear();
	const maxNum = demandes
		.map(d => parseInt(d.id.split('-')[2] || '0'))
		.reduce((a, b) => Math.max(a, b), 0);
	const newNum = String(maxNum + 1).padStart(4, '0');
	const id = `CI-${year}-${newNum}`;

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
		documents: body.documents || [],
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

function assignAgent(demandes) {
	// Simple round-robin between the two agents
	const agents = ['agent_001', 'agent_002'];
	const counts = agents.map(a => demandes.filter(d => d.agent_id === a).length);
	return agents[counts[0] <= counts[1] ? 0 : 1];
}
