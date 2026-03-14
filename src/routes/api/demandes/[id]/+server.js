import { json, error } from '@sveltejs/kit';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createNotification } from '$lib/server/notifications.js';

const DATA_FILE = join(process.cwd(), 'data', 'demandes.json');
const UTILISATEURS_FILE = join(process.cwd(), 'data', 'utilisateurs.json');

function resolveUserName(userId) {
	try {
		const { agents, superviseurs, maire } = JSON.parse(readFileSync(UTILISATEURS_FILE, 'utf-8'));
		const all = [...agents, ...superviseurs, maire];
		const u = all.find(p => p.id === userId);
		return u ? `${u.prenom} ${u.nom}` : userId;
	} catch {
		return userId;
	}
}

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
			par: resolveUserName(body.par) || 'agent'
		});

		// Rejet + paiement mobile/en ligne déjà encaissé → déclencher remboursement automatiquement
		if (body.statut === 'rejetee') {
			const p = demande.paiement;
			if (p?.statut === 'paye' && ['mobile_money', 'en_ligne', 'online'].includes(p.mode)) {
				demande.paiement.remboursement = {
					statut: 'en_attente',
					date_demande: now,
					reference: null,
					date_remboursement: null,
					traite_par: null
				};
				demande.historique.push({
					statut: 'rejetee',
					date: now,
					note: `Remboursement initié — ${p.montant?.toLocaleString('fr-FR')} FCFA via ${p.mode === 'mobile_money' ? 'Mobile Money' : 'paiement en ligne'} (réf. transaction : ${p.reference || 'N/A'})`,
					par: resolveUserName(body.par) || 'agent',
					type: 'remboursement'
				});
				createNotification(
					'superviseur',
					'remboursement',
					`Remboursement requis — dossier ${params.id} rejeté, paiement de ${p.montant?.toLocaleString('fr-FR')} FCFA à rembourser`,
					params.id
				);
			}
		}
	}

	// Update agent assignment
	if (body.agent_id) {
		demande.agent_id = body.agent_id;
		demande.historique.push({
			statut: demande.statut,
			date: now,
			note: `Réassignée à ${resolveUserName(body.agent_id)}`,
			par: resolveUserName(body.par) || 'superviseur'
		});
		createNotification(
			'agent',
			'nouvelle_demande',
			`Dossier réassigné — ${params.id} vous a été confié par le superviseur`,
			params.id
		);
	}

	// Données de l'acte officiel validé par l'agent
	if (body.acte) {
		demande.acte = { ...(demande.acte || {}), ...body.acte };
	}

	// Note interne sans changement de statut
	if (body.note_interne) {
		demande.historique.push({
			statut: demande.statut,
			date: now,
			note: body.note_interne,
			par: resolveUserName(body.par) || 'agent',
			type: 'note'
		});
	}

	// Valider remboursement mobile money (superviseur)
	if (body.remboursement_valide) {
		if (demande.paiement?.remboursement) {
			demande.paiement.remboursement = {
				...demande.paiement.remboursement,
				statut: 'effectue',
				reference: body.remboursement_valide.reference || null,
				date_remboursement: now,
				traite_par: resolveUserName(body.par) || 'superviseur'
			};
			demande.historique.push({
				statut: demande.statut,
				date: now,
				note: `Remboursement effectué — ${demande.paiement.montant?.toLocaleString('fr-FR')} FCFA${body.remboursement_valide.reference ? ` · Réf. ${body.remboursement_valide.reference}` : ''}`,
				par: resolveUserName(body.par) || 'superviseur',
				type: 'remboursement'
			});
		}
	}

	// Valider paiement en mairie
	if (body.paiement_valide) {
		demande.paiement = { ...demande.paiement, statut: 'paye', mode: 'mairie' };
		demande.historique.push({
			statut: demande.statut,
			date: now,
			note: `Paiement de ${demande.paiement.montant?.toLocaleString('fr-FR')} FCFA encaissé en mairie`,
			par: resolveUserName(body.par) || 'agent'
		});
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
