import { json, error } from '@sveltejs/kit';
import { readDemandes, writeDemandes, readUsers, batchSecurityLog } from '$lib/server/data.js';
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
	// Résolution unique — évite de re-lire utilisateurs.json à chaque appel
	const parName  = resolveUserName(body.par) || 'agent';
	const acteur   = body.par || 'agent';
	const role     = resolveRole(acteur);
	const secLogs  = []; // collecte toutes les entrées, écriture unique en fin de handler

	// ── Changement de statut ────────────────────────────────
	if (body.statut && body.statut !== demande.statut) {
		const ancienStatut = demande.statut;
		demande.statut = body.statut;
		demande.historique.push({ statut: body.statut, date: now, note: body.note || '', par: parName });

		secLogs.push({ type: 'statut_change', acteur: role, details: {
			demande_id:     params.id,
			type_acte:      demande.type_acte,
			ancien_statut:  ancienStatut,
			nouveau_statut: body.statut,
			par:            parName
		}});

		// Remboursement automatique si rejet + paiement en ligne
		if (body.statut === 'rejetee') {
			const p = demande.paiement;
			if (p?.statut === 'paye' && ['mobile_money', 'en_ligne', 'online'].includes(p.mode)) {
				demande.paiement.remboursement = { statut: 'en_attente', date_demande: now, reference: null, date_remboursement: null, traite_par: null };
				demande.historique.push({
					statut: 'rejetee', date: now, type: 'remboursement', par: parName,
					note: `Remboursement initié — ${p.montant?.toLocaleString('fr-FR')} FCFA via ${p.mode === 'mobile_money' ? 'Mobile Money' : 'paiement en ligne'} (réf. ${p.reference || 'N/A'})`
				});
				createNotification('superviseur', 'remboursement', `Remboursement requis — dossier ${params.id} rejeté, ${p.montant?.toLocaleString('fr-FR')} FCFA à rembourser`, params.id);
				secLogs.push({ type: 'remboursement_initie', acteur: role, details: { demande_id: params.id, montant: p.montant, mode: p.mode } });
			}
		}
	}

	// ── Réassignation d'agent ───────────────────────────────
	if (body.agent_id) {
		const nomAgent = resolveUserName(body.agent_id);
		demande.agent_id = body.agent_id;
		demande.historique.push({ statut: demande.statut, date: now, note: `Réassignée à ${nomAgent}`, par: parName });
		createNotification('agent', 'nouvelle_demande', `Dossier réassigné — ${params.id} vous a été confié par le superviseur`, params.id);
		secLogs.push({ type: 'reassignation', acteur: role, details: { demande_id: params.id, agent_id: body.agent_id, agent_nom: nomAgent, par: parName } });
	}

	// ── Données de l'acte validé ────────────────────────────
	if (body.acte) {
		demande.acte = { ...(demande.acte || {}), ...body.acte };
		secLogs.push({ type: 'acte_valide', acteur: role, details: {
			demande_id:   params.id,
			type_acte:    demande.type_acte,
			numero_acte:  body.acte.numero_acte || '',
			officier_nom: body.acte.officier_nom || '',
			par:          parName
		}});
	}

	// ── Demande de compléments ──────────────────────────────
	if (body.complement_demande) {
		demande.complement_demande = { ...body.complement_demande, date: now, par: parName };
		// Le changement de statut (complements_requis) est géré par le bloc statut_change ci-dessus
		secLogs.push({ type: 'complement_demande', acteur: role, details: {
			demande_id: params.id,
			motif:      body.complement_demande.motif || '',
			items:      body.complement_demande.items || [],
			par:        parName
		}});
	}

	// ── Dépôt de compléments par le citoyen ─────────────────
	if (body.complement_fourni) {
		demande.complement_fourni = { ...body.complement_fourni, date: now };
		demande.statut = 'complements_fournis';
		demande.historique.push({
			statut: 'complements_fournis',
			date:   now,
			note:   `Le citoyen a déposé ${body.complement_fourni.documents?.length || 0} document(s) en ligne`,
			par:    demande.demandeur ? `${demande.demandeur.prenom} ${demande.demandeur.nom}` : 'Citoyen'
		});
		createNotification('agent', 'info', `Compléments reçus — le citoyen a déposé ses documents pour le dossier ${params.id}`, params.id);
		secLogs.push({ type: 'complement_fourni', acteur: 'citoyen', details: {
			demande_id: params.id,
			nb_docs:    body.complement_fourni.documents?.length || 0
		}});
	}

	// ── Note interne ────────────────────────────────────────
	if (body.note_interne) {
		demande.historique.push({ statut: demande.statut, date: now, note: body.note_interne, par: parName, type: 'note' });
		secLogs.push({ type: 'note_interne', acteur: role, details: { demande_id: params.id, par: parName } });
	}

	// ── Validation remboursement (superviseur) ──────────────
	if (body.remboursement_valide && demande.paiement?.remboursement) {
		demande.paiement.remboursement = {
			...demande.paiement.remboursement,
			statut:             'effectue',
			reference:          body.remboursement_valide.reference || null,
			date_remboursement: now,
			traite_par:         parName
		};
		demande.historique.push({
			statut: demande.statut, date: now, type: 'remboursement', par: parName,
			note: `Remboursement effectué — ${demande.paiement.montant?.toLocaleString('fr-FR')} FCFA${body.remboursement_valide.reference ? ` · Réf. ${body.remboursement_valide.reference}` : ''}`
		});
		secLogs.push({ type: 'remboursement_valide', acteur: role, details: {
			demande_id: params.id,
			montant:    demande.paiement.montant,
			reference:  body.remboursement_valide.reference || null,
			par:        parName
		}});
	}

	// ── Paiement en mairie ──────────────────────────────────
	if (body.paiement_valide) {
		demande.paiement = { ...demande.paiement, statut: 'paye', mode: 'mairie' };
		demande.historique.push({ statut: demande.statut, date: now, par: parName, note: `Paiement de ${demande.paiement.montant?.toLocaleString('fr-FR')} FCFA encaissé en mairie` });
		secLogs.push({ type: 'paiement_valide', acteur: role, details: { demande_id: params.id, montant: demande.paiement.montant, par: parName } });
	}

	// ── Escalade ────────────────────────────────────────────
	if (body.escalade !== undefined) {
		demande.escalade = body.escalade;
		if (body.escalade) {
			demande.historique.push({ statut: demande.statut, date: now, note: `Escalade ${body.escalade.level} : ${body.escalade.motif}`, par: body.escalade.par || 'agent' });
			if (body.escalade.level === 'superviseur') createNotification('superviseur', 'escalade', `Escalade reçue — dossier ${params.id} nécessite votre intervention`, params.id);
			else if (body.escalade.level === 'maire')  createNotification('maire', 'escalade_critique', `Cas critique — dossier ${params.id} escaladé au Maire pour décision`, params.id);
			secLogs.push({ type: 'escalade_ajout', acteur: resolveRole(body.escalade.par || acteur), details: {
				demande_id: params.id,
				level:      body.escalade.level,
				motif:      body.escalade.motif,
				par:        body.escalade.par || parName
			}});
		} else {
			demande.historique.push({ statut: demande.statut, date: now, note: 'Escalade résolue', par: body.par || 'superviseur' });
			createNotification('agent', 'info', `Escalade résolue — dossier ${params.id} a été traité par le superviseur`, params.id);
			secLogs.push({ type: 'escalade_resolue', acteur: role, details: { demande_id: params.id, par: parName } });
		}
	}

	demande.updated_at = now;
	demandes[index]    = demande;
	writeDemandes(demandes);
	batchSecurityLog(secLogs); // une seule lecture+écriture pour tous les événements
	return json(demande);
}
