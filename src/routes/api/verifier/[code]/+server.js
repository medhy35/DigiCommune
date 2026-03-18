import { json, error } from '@sveltejs/kit';
import { lookupVerifCode, readDemande } from '$lib/server/data.js';
import { TYPE_ACTE_LABELS } from '$lib/utils/helpers.js';

const TYPE_DOC_LABELS = {
	attestation: 'Attestation de dépôt de demande',
	recu:        'Reçu de paiement',
	acte:        "Acte officiel d'état civil"
};

export async function GET({ params }) {
	const entry = await lookupVerifCode(params.code);
	if (!entry) throw error(404, 'Code invalide ou document introuvable');

	const demande = await readDemande(entry.demande_id);
	if (!demande) throw error(404, 'Dossier introuvable');

	const base = {
		valide:     true,
		code:       params.code,
		type:       entry.type,
		type_label: TYPE_DOC_LABELS[entry.type] || entry.type,
		demande_id: demande.id,
		demandeur:  `${demande.demandeur.prenom} ${demande.demandeur.nom}`,
		type_acte:  TYPE_ACTE_LABELS[demande.type_acte] || demande.type_acte
	};

	if (entry.type === 'recu') {
		return json({ ...base, montant: demande.paiement?.montant || null });
	}
	if (entry.type === 'acte') {
		return json({ ...base, numero_acte: demande.acte?.numero_acte || null, officier: demande.acte?.officier_nom || null });
	}
	// attestation
	return json({ ...base, created_at: demande.created_at });
}
