export const TYPE_ACTE_LABELS = {
	naissance: 'Acte de naissance',
	mariage: 'Acte de mariage',
	deces: 'Acte de décès'
};

export const TYPE_ACTE_ICONS = {
	naissance: '👶',
	mariage: '💍',
	deces: '🕊️'
};

export const CONCERNANT_LABELS = {
	'soi-meme': 'Soi-même',
	enfant: 'Un enfant',
	parent: 'Un parent'
};

export const STATUT_LABELS = {
	recue: 'Reçue',
	en_cours: 'En cours',
	traitee: 'Traitée',
	disponible: 'Disponible',
	rejetee: 'Rejetée'
};

export const STATUT_COLORS = {
	recue: 'badge-recue',
	en_cours: 'badge-en_cours',
	traitee: 'badge-traitee',
	disponible: 'badge-disponible',
	rejetee: 'badge-rejetee'
};

export const MODE_RECEPTION_LABELS = {
	retrait: 'Retrait en mairie',
	whatsapp: 'Copie PDF par WhatsApp'
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
