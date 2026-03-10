import { json, error } from '@sveltejs/kit';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createNotification } from '$lib/server/notifications.js';const DATA_FILE = join(process.cwd(), 'data', 'demandes.json');

function readDemandes() {
	return JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
}

function writeDemandes(demandes) {
	writeFileSync(DATA_FILE, JSON.stringify(demandes, null, 2), 'utf-8');
}

export function GET({ params }) {
	const demandes = readDemandes();
	const demande = demandes.find(d => d.id === params.id);
	if (!demande) throw error(404, 'Demande non trouvée');
	return json(demande);
}

export async function PATCH({ params, request }) {
	const body = await request.json();
	const demandes = readDemandes();
	const index = demandes.findIndex(d => d.id === params.id);

	if (index === -1) throw error(404, 'Demande non trouvée');

	const demande = demandes[index];
	const now = new Date().toISOString();

	// Update statut
	if (body.statut && body.statut !== demande.statut) {
		demande.statut = body.statut;
		demande.historique.push({
			statut: body.statut,
			date: now,
			note: body.note || '',
			par: body.par || 'agent'
		});
	}

	// Update agent assignment
	if (body.agent_id) {
		demande.agent_id = body.agent_id;
		demande.historique.push({
			statut: demande.statut,
			date: now,
			note: `Réassignée à ${body.agent_id}`,
			par: body.par || 'superviseur'
		});
		createNotification(
			'agent',
			'nouvelle_demande',
			`Dossier réassigné — ${params.id} vous a été confié par le superviseur`,
			params.id
		);
	}

	// Handle escalade
	if (body.escalade !== undefined) {
		demande.escalade = body.escalade;
		if (body.escalade) {
			demande.historique.push({
				statut: demande.statut,
				date: now,
				note: `Escalade ${body.escalade.level} : ${body.escalade.motif}`,
				par: body.escalade.par || 'agent'
			});
			// Notifier le destinataire de l'escalade
			if (body.escalade.level === 'superviseur') {
				createNotification(
					'superviseur',
					'escalade',
					`Escalade reçue — dossier ${params.id} nécessite votre intervention`,
					params.id
				);
			} else if (body.escalade.level === 'maire') {
				createNotification(
					'maire',
					'escalade_critique',
					`Cas critique — dossier ${params.id} escaladé au Maire pour décision`,
					params.id
				);
			}
		} else {
			demande.historique.push({
				statut: demande.statut,
				date: now,
				note: 'Escalade résolue',
				par: body.par || 'superviseur'
			});
			// Notifier l'agent que son escalade a été traitée
			createNotification(
				'agent',
				'info',
				`Escalade résolue — dossier ${params.id} a été traité par le superviseur`,
				params.id
			);
		}
	}

	demande.updated_at = now;
	demandes[index] = demande;
	writeDemandes(demandes);

	return json(demande);
}
