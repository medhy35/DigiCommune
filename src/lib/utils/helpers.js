export const TYPE_ACTE_LABELS = {
	naissance: 'Acte de naissance',
	mariage: 'Acte de mariage',
	deces: 'Acte de décès',
	attestation_concubinage: 'Attestation de concubinage',
	attestation_domicile: 'Attestation de domicile',
	certification_documents: 'Certification de documents',
	legalisation: 'Légalisation',
	inscription_livret: 'Inscription au livret de famille',
	duplicata_livret: 'Duplicata du livret de famille',
	certificat_vie_entretien: 'Certificat de vie et entretien',
	certificat_vie_adulte: 'Certificat de vie adulte',
	fiche_familiale: 'Fiche familiale d\'état civil',
	fiche_individuelle: 'Fiche individuelle d\'état civil',
	rdv: 'Prise de rendez-vous (retrait)'
};

export const TYPE_ACTE_ICONS = {
	naissance: '👶',
	mariage: '💍',
	deces: '🕊️',
	attestation_concubinage: '🤝',
	attestation_domicile: '🏠',
	certification_documents: '✅',
	legalisation: '🔏',
	inscription_livret: '📖',
	duplicata_livret: '📋',
	certificat_vie_entretien: '👨‍👩‍👧',
	certificat_vie_adulte: '👴',
	fiche_familiale: '👪',
	fiche_individuelle: '🙋',
	rdv: '📅'
};

export const RDV_STATUT_LABELS = {
	en_attente: 'En attente',
	confirme:   'Confirmé',
	effectue:   'Effectué',
	annule:     'Annulé'
};

export const RDV_STATUT_COLORS = {
	en_attente: 'bg-amber-100 text-amber-700',
	confirme:   'bg-green-100 text-green-700',
	effectue:   'bg-gray-100 text-gray-600',
	annule:     'bg-red-100 text-red-600'
};

/** Frais par type de service. mode: 'per_copy' | 'flat'. montant en FCFA. */
export const SERVICE_FRAIS = {
	naissance:               { mode: 'per_copy', montant: 500 },
	mariage:                 { mode: 'per_copy', montant: 500 },
	deces:                   { mode: 'per_copy', montant: 500 },
	attestation_concubinage: { mode: 'flat',     montant: 500 },
	attestation_domicile:    { mode: 'flat',     montant: 0 },
	certification_documents: { mode: 'per_copy', montant: 500 },
	legalisation:            { mode: 'flat',     montant: 500 },
	inscription_livret:      { mode: 'flat',     montant: 0 },
	duplicata_livret:        { mode: 'flat',     montant: 5500 },
	certificat_vie_entretien:{ mode: 'flat',     montant: 1000 },
	certificat_vie_adulte:   { mode: 'flat',     montant: 500 },
	fiche_familiale:         { mode: 'flat',     montant: 5500 },
	fiche_individuelle:      { mode: 'flat',     montant: 5500 }
};

export const CONCERNANT_LABELS = {
	'soi-meme': 'Soi-même',
	enfant: 'Un enfant',
	parent: 'Un parent'
};

export const STATUT_LABELS = {
	recue:               'Reçue',
	en_cours:            'En cours',
	complements_requis:  'Compléments requis',
	traitee:             'Traitée',
	disponible:          'Disponible',
	rejetee:             'Rejetée'
};

export const STATUT_COLORS = {
	recue:               'badge-recue',
	en_cours:            'badge-en_cours',
	complements_requis:  'badge-complements_requis',
	traitee:             'badge-traitee',
	disponible:          'badge-disponible',
	rejetee:             'badge-rejetee'
};

export const MODE_RECEPTION_LABELS = {
	retrait: 'Retrait en mairie',
	whatsapp: 'Copie PDF par WhatsApp'
};

export const NOTIFICATION_ICONS = {
	nouvelle_demande:   '📋',
	escalade:           '⚠️',
	escalade_critique:  '🚨',
	remboursement:      '💰',
	info:               'ℹ️'
};

export const DOC_TYPE_LABELS = {
	cni:          "Pièce d'identité",
	extrait:      'Extrait d\'acte',
	passeport:    'Passeport',
	justificatif: 'Justificatif',
	autre:        'Document'
};

export const DOC_TYPE_ICONS = {
	cni:          '🪪',
	extrait:      '📋',
	passeport:    '📕',
	justificatif: '📎',
	autre:        '📄'
};

export function formatDate(isoString) {
	if (!isoString) return '—';
	return new Intl.DateTimeFormat('fr-FR', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric'
	}).format(new Date(isoString));
}

export function formatDateTime(isoString) {
	if (!isoString) return '—';
	return new Intl.DateTimeFormat('fr-FR', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	}).format(new Date(isoString));
}

export function timeAgo(isoString) {
	if (!isoString) return '';
	const diff = Date.now() - new Date(isoString).getTime();
	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(diff / 3600000);
	const days = Math.floor(diff / 86400000);

	if (days > 0) return `il y a ${days}j`;
	if (hours > 0) return `il y a ${hours}h`;
	if (minutes > 0) return `il y a ${minutes}min`;
	return 'à l\'instant';
}

export function getStatutStep(statut) {
	const steps = ['recue', 'en_cours', 'traitee', 'disponible'];
	return steps.indexOf(statut);
}

export function isEscaladee(demande) {
	return demande.escalade && !demande.escalade.resolu;
}

/** Retourne true si la demande est en retard selon le seuil SLA */
export function isSLADepassee(demande, heures = 48) {
	if (['traitee', 'disponible', 'rejetee'].includes(demande.statut)) return false;
	const ref = demande.updated_at || demande.created_at;
	return (Date.now() - new Date(ref).getTime()) > heures * 3600000;
}
