import { json, error } from '@sveltejs/kit';
import { lookupVerifCode } from '$lib/server/verification.js';
import { TYPE_ACTE_LABELS } from '$lib/utils/helpers.js';

const TYPE_DOC_LABELS = {
	attestation: 'Attestation de dépôt de demande',
	recu:        'Reçu de paiement',
	acte:        'Acte officiel d\'état civil'
};

export function GET({ params }) {
	const data = lookupVerifCode(params.code);
	if (!data) throw error(404, 'Code invalide ou document introuvable');

	return json({
		valide:       true,
		code:         params.code,
		type:         data.type,
		type_label:   TYPE_DOC_LABELS[data.type] || data.type,
		type_acte:    data.type_acte ? (TYPE_ACTE_LABELS[data.type_acte] || data.type_acte) : null,
		demande_id:   data.demande_id,
		demandeur:    data.demandeur,
		created_at:   data.created_at,
		numero_acte:  data.numero_acte || null,
		officier:     data.officier    || null,
		montant:      data.montant     || null
	});
}
