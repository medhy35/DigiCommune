import { json, error } from '@sveltejs/kit';
import { readDemandes, writeDemandes, readUsers } from '$lib/server/data.js';
import { createNotification } from '$lib/server/notifications.js';

function resolveUserName(userId) {
	try {
		const { agents, superviseurs, maire } = readUsers();
		const u = [...agents, ...superviseurs, maire].find(p => p.id === userId);
		return u ? `${u.prenom} ${u.nom}` : userId;
	} catch {
		return userId;
	}
}

export function GET({ params }) {
	const demande = readDemandes().find(d => d.id === params.id);
	if (!demande) throw error(404, 'Demande non trouvée');
	return json(demande);
}

export async function PATCH({ params, request }) {
	const body     = await request.json();
	const demandes = readDemandes();
	const index    = demandes.findIndex(d => d.id === params.id);
	if (index === -1) throw error(404, 'Demande non trouvée');

	const demande = demandes[index];
	const now     = new Date().toISOString();
	const par     = () => resolveUserName(body.par) || 'agent';

	// Changement de statut
	if (body.statut && body.statut !== demande.statut) {
		demande.statut = body.statut;
		demande.historique.push({ statut: body.statut, date: now, note: body.note || '', par: par() });

		// Remboursement automatique si rejet + paiement en ligne
		if (body.statut === 'rejetee') {
			const p = demande.paiement;
			if (p?.statut === 'paye' && ['mobile_money', 'en_ligne', 'online'].includes(p.mode)) {
				demande.paiement.remboursement = { statut: 'en_attente', date_demande: now, reference: null, date_remboursement: null, traite_par: null };
				demande.historique.push({
					statut: 'rejetee', date: now, type: 'remboursement', par: par(),
					note: `Remboursement initié — ${p.montant?.toLocaleString('fr-FR')} FCFA via ${p.mode === 'mobile_money' ? 'Mobile Money' : 'paiement en ligne'} (réf. ${p.reference || 'N/A'})`
				});
				createNotification('superviseur', 'remboursement', `Remboursement requis — dossier ${params.id} rejeté, ${p.montant?.toLocaleString('fr-FR')} FCFA à rembourser`, params.id);
			}
		}
	}

	// Réassignation d'agent
	if (body.agent_id) {
		demande.agent_id = body.agent_id;
		demande.historique.push({ statut: demande.statut, date: now, note: `Réassignée à ${resolveUserName(body.agent_id)}`, par: par() });
		createNotification('agent', 'nouvelle_demande', `Dossier réassigné — ${params.id} vous a été confié par le superviseur`, params.id);
	}

	// Données de l'acte validé
	if (body.acte) demande.acte = { ...(demande.acte || {}), ...body.acte };

	// Note interne
	if (body.note_interne) {
		demande.historique.push({ statut: demande.statut, date: now, note: body.note_interne, par: par(), type: 'note' });
	}

	// Validation remboursement (superviseur)
	if (body.remboursement_valide && demande.paiement?.remboursement) {
		demande.paiement.remboursement = {
			...demande.paiement.remboursement,
			statut: 'effectue',
			reference: body.remboursement_valide.reference || null,
			date_remboursement: now,
			traite_par: par()
		};
		demande.historique.push({
			statut: demande.statut, date: now, type: 'remboursement', par: par(),
			note: `Remboursement effectué — ${demande.paiement.montant?.toLocaleString('fr-FR')} FCFA${body.remboursement_valide.reference ? ` · Réf. ${body.remboursement_valide.reference}` : ''}`
		});
	}

	// Paiement en mairie
	if (body.paiement_valide) {
		demande.paiement = { ...demande.paiement, statut: 'paye', mode: 'mairie' };
		demande.historique.push({ statut: demande.statut, date: now, par: par(), note: `Paiement de ${demande.paiement.montant?.toLocaleString('fr-FR')} FCFA encaissé en mairie` });
	}

	// Escalade
	if (body.escalade !== undefined) {
		demande.escalade = body.escalade;
		if (body.escalade) {
			demande.historique.push({ statut: demande.statut, date: now, note: `Escalade ${body.escalade.level} : ${body.escalade.motif}`, par: body.escalade.par || 'agent' });
			if (body.escalade.level === 'superviseur') createNotification('superviseur', 'escalade', `Escalade reçue — dossier ${params.id} nécessite votre intervention`, params.id);
			else if (body.escalade.level === 'maire')  createNotification('maire', 'escalade_critique', `Cas critique — dossier ${params.id} escaladé au Maire pour décision`, params.id);
		} else {
			demande.historique.push({ statut: demande.statut, date: now, note: 'Escalade résolue', par: body.par || 'superviseur' });
			createNotification('agent', 'info', `Escalade résolue — dossier ${params.id} a été traité par le superviseur`, params.id);
		}
	}

	demande.updated_at  = now;
	demandes[index]     = demande;
	writeDemandes(demandes);
	return json(demande);
}
