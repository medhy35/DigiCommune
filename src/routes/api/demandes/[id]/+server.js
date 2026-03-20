import { json, error } from '@sveltejs/kit';
import {
	readDemande, updateDemande, resolveUserName,
	createNotification, batchSecurityLog
} from '$lib/server/data.js';
import { registerVerifCode } from '$lib/server/verification.js';
import { notifierCitoyen } from '$lib/server/notify-citoyen.js';

/** Déduit le rôle de l'auteur d'après son identifiant */
function resolveRole(par) {
	if (!par) return 'agent';
	if (par.startsWith('sup_') || par.toLowerCase().includes('superviseur')) return 'superviseur';
	if (par.startsWith('maire') || par.toLowerCase().includes('maire')) return 'maire';
	if (par.toLowerCase().includes('admin') || par === 'Système') return 'superadmin';
	return 'agent';
}

export async function GET({ params }) {
	const demande = await readDemande(params.id);
	if (!demande) throw error(404, 'Demande non trouvée');
	return json(demande);
}

export async function PATCH({ params, request }) {
	const body    = await request.json();
	const demande = await readDemande(params.id);
	if (!demande) throw error(404, 'Demande non trouvée');

	const now     = new Date().toISOString();
	const parName = await resolveUserName(body.par) || body.par || 'agent';
	const acteur  = body.par || 'agent';
	const role    = resolveRole(acteur);
	const secLogs = [];

	// Copie mutable des champs JSONB
	const historique         = [...(demande.historique || [])];
	let   statut             = demande.statut;
	let   agent_id           = demande.agent_id;
	let   acte               = demande.acte ? { ...demande.acte } : null;
	let   verification_codes = { ...(demande.verification_codes || {}) };
	let   complement_demande = demande.complement_demande ? { ...demande.complement_demande } : null;
	let   complement_fourni  = demande.complement_fourni  ? { ...demande.complement_fourni  } : null;
	let   escalade           = demande.escalade ? { ...demande.escalade } : null;
	let   paiement           = { ...(demande.paiement || {}) };

	// ── Changement de statut ─────────────────────────────────
	if (body.statut && body.statut !== statut) {
		const ancienStatut = statut;
		statut = body.statut;
		historique.push({ statut, date: now, note: body.note || '', par: parName });

		secLogs.push({ type: 'statut_change', acteur: role, details: {
			demande_id:     params.id,
			type_acte:      demande.type_acte,
			ancien_statut:  ancienStatut,
			nouveau_statut: statut,
			par:            parName
		}});

		// Remboursement automatique si rejet + paiement en ligne
		if (statut === 'rejetee') {
			const p = paiement;
			if (p?.statut === 'paye' && ['mobile_money', 'en_ligne', 'online'].includes(p.mode)) {
				paiement.remboursement = {
					statut: 'en_attente', date_demande: now,
					reference: null, date_remboursement: null, traite_par: null
				};
				historique.push({
					statut: 'rejetee', date: now, type: 'remboursement', par: parName,
					note: `Remboursement initié — ${p.montant?.toLocaleString('fr-FR')} FCFA via ${p.mode === 'mobile_money' ? 'Mobile Money' : 'paiement en ligne'} (réf. ${p.reference || 'N/A'})`
				});
				await createNotification('superviseur', 'remboursement',
					`Remboursement requis — dossier ${params.id} rejeté, ${p.montant?.toLocaleString('fr-FR')} FCFA à rembourser`, params.id);
				secLogs.push({ type: 'remboursement_initie', acteur: role, details: { demande_id: params.id, montant: p.montant, mode: p.mode } });
			}
		}
	}

	// ── Réassignation d'agent ────────────────────────────────
	if (body.agent_id) {
		const nomAgent = await resolveUserName(body.agent_id);
		agent_id = body.agent_id;
		historique.push({ statut, date: now, note: `Réassignée à ${nomAgent}`, par: parName });
		await createNotification('agent', 'nouvelle_demande',
			`Dossier réassigné — ${params.id} vous a été confié par le superviseur`, params.id);
		secLogs.push({ type: 'reassignation', acteur: role, details: {
			demande_id: params.id, agent_id: body.agent_id, agent_nom: nomAgent, par: parName
		}});
	}

	// ── Données de l'acte validé ─────────────────────────────
	if (body.acte) {
		acte = { ...(acte || {}), ...body.acte };
		if (!verification_codes.acte) {
			verification_codes.acte = await registerVerifCode('acte', params.id);
		}
		secLogs.push({ type: 'acte_valide', acteur: role, details: {
			demande_id:   params.id, type_acte: demande.type_acte,
			numero_acte:  body.acte.numero_acte || '', officier_nom: body.acte.officier_nom || '', par: parName
		}});
	}

	// ── Demande de compléments ───────────────────────────────
	if (body.complement_demande) {
		complement_demande = { ...body.complement_demande, date: now, par: parName };
		secLogs.push({ type: 'complement_demande', acteur: role, details: {
			demande_id: params.id, motif: body.complement_demande.motif || '',
			items: body.complement_demande.items || [], par: parName
		}});
	}

	// ── Dépôt de compléments par le citoyen ─────────────────
	if (body.complement_fourni) {
		complement_fourni = { ...body.complement_fourni, date: now };
		statut = 'complements_fournis';
		historique.push({
			statut: 'complements_fournis', date: now,
			note:   `Le citoyen a déposé ${body.complement_fourni.documents?.length || 0} document(s) en ligne`,
			par:    demande.demandeur ? `${demande.demandeur.prenom} ${demande.demandeur.nom}` : 'Citoyen'
		});
		await createNotification('agent', 'info',
			`Compléments reçus — le citoyen a déposé ses documents pour le dossier ${params.id}`, params.id);
		secLogs.push({ type: 'complement_fourni', acteur: 'citoyen', details: {
			demande_id: params.id, nb_docs: body.complement_fourni.documents?.length || 0
		}});
	}

	// ── Note interne ─────────────────────────────────────────
	if (body.note_interne) {
		historique.push({ statut, date: now, note: body.note_interne, par: parName, type: 'note' });
		secLogs.push({ type: 'note_interne', acteur: role, details: { demande_id: params.id, par: parName } });
	}

	// ── Validation remboursement ─────────────────────────────
	if (body.remboursement_valide && paiement.remboursement) {
		paiement.remboursement = {
			...paiement.remboursement,
			statut:             'effectue',
			reference:          body.remboursement_valide.reference || null,
			date_remboursement: now,
			traite_par:         parName
		};
		historique.push({
			statut, date: now, type: 'remboursement', par: parName,
			note: `Remboursement effectué — ${paiement.montant?.toLocaleString('fr-FR')} FCFA${body.remboursement_valide.reference ? ` · Réf. ${body.remboursement_valide.reference}` : ''}`
		});
		secLogs.push({ type: 'remboursement_valide', acteur: role, details: {
			demande_id: params.id, montant: paiement.montant, reference: body.remboursement_valide.reference || null, par: parName
		}});
	}

	// ── Paiement en mairie ───────────────────────────────────
	if (body.paiement_valide) {
		paiement = { ...paiement, statut: 'paye', mode: 'mairie' };
		historique.push({ statut, date: now, par: parName, note: `Paiement de ${paiement.montant?.toLocaleString('fr-FR')} FCFA encaissé en mairie` });
		if (!verification_codes.recu) {
			verification_codes.recu = await registerVerifCode('recu', params.id);
		}
		secLogs.push({ type: 'paiement_valide', acteur: role, details: { demande_id: params.id, montant: paiement.montant, par: parName } });
	}

	// ── Escalade ─────────────────────────────────────────────
	if (body.escalade !== undefined) {
		escalade = body.escalade;
		if (escalade) {
			historique.push({ statut, date: now, note: `Escalade ${escalade.level} : ${escalade.motif}`, par: escalade.par || 'agent' });
			if (escalade.level === 'superviseur')
				await createNotification('superviseur', 'escalade', `Escalade reçue — dossier ${params.id} nécessite votre intervention`, params.id);
			else if (escalade.level === 'maire')
				await createNotification('maire', 'escalade_critique', `Cas critique — dossier ${params.id} escaladé au Maire pour décision`, params.id);
			secLogs.push({ type: 'escalade_ajout', acteur: resolveRole(escalade.par || acteur), details: {
				demande_id: params.id, level: escalade.level, motif: escalade.motif, par: escalade.par || parName
			}});
		} else {
			historique.push({ statut, date: now, note: 'Escalade résolue', par: body.par || 'superviseur' });
			await createNotification('agent', 'info', `Escalade résolue — dossier ${params.id} a été traité par le superviseur`, params.id);
			secLogs.push({ type: 'escalade_resolue', acteur: role, details: { demande_id: params.id, par: parName } });
		}
	}

	const ancienStatut = demande.statut;
	const updated = await updateDemande(params.id, {
		statut, agent_id, acte, verification_codes,
		complement_demande, complement_fourni, escalade, paiement, historique
	});
	await batchSecurityLog(secLogs);
	await notifierCitoyen(updated, ancienStatut, updated.statut);
	return json(updated);
}
