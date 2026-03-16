import { json, error } from '@sveltejs/kit';
import { readDemandes, writeDemandes, readUsers, appendSecurityLog } from '$lib/server/data.js';
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

/** Déduit le rôle de l'auteur d'après son identifiant */
function resolveRole(par) {
	if (!par) return 'agent';
	if (par.startsWith('sup_') || par.toLowerCase().includes('superviseur')) return 'superviseur';
	if (par.startsWith('maire') || par.toLowerCase().includes('maire')) return 'maire';
	if (par.toLowerCase().includes('admin') || par === 'Système') return 'superadmin';
	return 'agent';
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

	const demande  = demandes[index];
	const now      = new Date().toISOString();
	const par      = () => resolveUserName(body.par) || 'agent';
	const acteur   = body.par || 'agent';
	const role     = resolveRole(acteur);

	// ── Changement de statut ────────────────────────────────
	if (body.statut && body.statut !== demande.statut) {
		const ancienStatut = demande.statut;
		demande.statut = body.statut;
		demande.historique.push({ statut: body.statut, date: now, note: body.note || '', par: par() });

		appendSecurityLog('statut_change', role, {
			demande_id:    params.id,
			type_acte:     demande.type_acte,
			ancien_statut: ancienStatut,
			nouveau_statut: body.statut,
			par:           par()
		});

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
				appendSecurityLog('remboursement_initie', role, { demande_id: params.id, montant: p.montant, mode: p.mode });
			}
		}
	}

	// ── Réassignation d'agent ───────────────────────────────
	if (body.agent_id) {
		demande.agent_id = body.agent_id;
		const nomAgent = resolveUserName(body.agent_id);
		demande.historique.push({ statut: demande.statut, date: now, note: `Réassignée à ${nomAgent}`, par: par() });
		createNotification('agent', 'nouvelle_demande', `Dossier réassigné — ${params.id} vous a été confié par le superviseur`, params.id);
		appendSecurityLog('reassignation', role, { demande_id: params.id, agent_id: body.agent_id, agent_nom: nomAgent, par: par() });
	}

	// ── Données de l'acte validé ────────────────────────────
	if (body.acte) {
		demande.acte = { ...(demande.acte || {}), ...body.acte };
		appendSecurityLog('acte_valide', role, {
			demande_id:     params.id,
			type_acte:      demande.type_acte,
			numero_acte:    body.acte.numero_acte || '',
			officier_nom:   body.acte.officier_nom || '',
			par:            par()
		});
	}

	// ── Note interne ────────────────────────────────────────
	if (body.note_interne) {
		demande.historique.push({ statut: demande.statut, date: now, note: body.note_interne, par: par(), type: 'note' });
		appendSecurityLog('note_interne', role, { demande_id: params.id, par: par() });
	}

	// ── Validation remboursement (superviseur) ──────────────
	if (body.remboursement_valide && demande.paiement?.remboursement) {
		demande.paiement.remboursement = {
			...demande.paiement.remboursement,
			statut:             'effectue',
			reference:          body.remboursement_valide.reference || null,
			date_remboursement: now,
			traite_par:         par()
		};
		demande.historique.push({
			statut: demande.statut, date: now, type: 'remboursement', par: par(),
			note: `Remboursement effectué — ${demande.paiement.montant?.toLocaleString('fr-FR')} FCFA${body.remboursement_valide.reference ? ` · Réf. ${body.remboursement_valide.reference}` : ''}`
		});
		appendSecurityLog('remboursement_valide', role, {
			demande_id: params.id,
			montant:    demande.paiement.montant,
			reference:  body.remboursement_valide.reference || null,
			par:        par()
		});
	}

	// ── Paiement en mairie ──────────────────────────────────
	if (body.paiement_valide) {
		demande.paiement = { ...demande.paiement, statut: 'paye', mode: 'mairie' };
		demande.historique.push({ statut: demande.statut, date: now, par: par(), note: `Paiement de ${demande.paiement.montant?.toLocaleString('fr-FR')} FCFA encaissé en mairie` });
		appendSecurityLog('paiement_valide', role, { demande_id: params.id, montant: demande.paiement.montant, par: par() });
	}

	// ── Escalade ────────────────────────────────────────────
	if (body.escalade !== undefined) {
		demande.escalade = body.escalade;
		if (body.escalade) {
			demande.historique.push({ statut: demande.statut, date: now, note: `Escalade ${body.escalade.level} : ${body.escalade.motif}`, par: body.escalade.par || 'agent' });
			if (body.escalade.level === 'superviseur') createNotification('superviseur', 'escalade', `Escalade reçue — dossier ${params.id} nécessite votre intervention`, params.id);
			else if (body.escalade.level === 'maire')  createNotification('maire', 'escalade_critique', `Cas critique — dossier ${params.id} escaladé au Maire pour décision`, params.id);
			appendSecurityLog('escalade_ajout', resolveRole(body.escalade.par || acteur), {
				demande_id: params.id,
				level:      body.escalade.level,
				motif:      body.escalade.motif,
				par:        body.escalade.par || par()
			});
		} else {
			demande.historique.push({ statut: demande.statut, date: now, note: 'Escalade résolue', par: body.par || 'superviseur' });
			createNotification('agent', 'info', `Escalade résolue — dossier ${params.id} a été traité par le superviseur`, params.id);
			appendSecurityLog('escalade_resolue', role, { demande_id: params.id, par: par() });
		}
	}

	demande.updated_at  = now;
	demandes[index]     = demande;
	writeDemandes(demandes);
	return json(demande);
}
